import base64
import binascii
import logging
import math
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_optional_user
from app.core.database import get_db
from app.core.enums import DeckFormat, DeckStatus, MTGColor, TaskStatus
from app.core.guards import sanitize_prompt
from app.core.rate_limit import SlidingWindowLimiter, rate_limited
from app.decks.dispatch import GenerationJob, dispatch_generation
from app.decks.dtos import (
    DeckGenerateRequestDTO,
    DeckGenerateResponseDTO,
    DeckListResponseDTO,
    DeckResponseDTO,
    DeckTagsRequestDTO,
    DeckVisibilityRequestDTO,
    ExploreDeckListResponseDTO,
)
from app.decks.model import Deck
from app.decks.pipeline import mark_generation_failed
from app.decks.tags import normalize_tag
from app.tasks.model import Task

_log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/decks/generate", response_model=DeckGenerateResponseDTO, status_code=status.HTTP_202_ACCEPTED)
async def generate_deck(
    request: DeckGenerateRequestDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
    # Generation spends LLM tokens, so it needs an account.
    user_id: Annotated[str, Depends(get_current_user)],
) -> DeckGenerateResponseDTO:
    valid, rejection = sanitize_prompt(request.prompt)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=rejection)

    deck = Deck(
        id=uuid.uuid4(),
        prompt=request.prompt,
        format=request.format,
        status=DeckStatus.PENDING,
        user_id=user_id,
    )
    db.add(deck)

    # Generate task_id here so we can commit before dispatching — eliminates the race
    # where the worker tries to read the Task record before it's committed.
    task_id = str(uuid.uuid4())
    task = Task(id=task_id, deck_id=deck.id, status=TaskStatus.QUEUED)
    db.add(task)

    try:
        await db.commit()
    except SQLAlchemyError:
        _log.exception("Database error creating deck/task (prompt=%r, format=%s)", request.prompt, request.format)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deck storage is temporarily unavailable. Please try again shortly.",
        )

    job = GenerationJob(
        task_id=task_id,
        deck_id=str(deck.id),
        prompt=request.prompt,
        format=request.format,
        colors=[c.value for c in request.colors],
        deck_size=request.deck_size,
    )
    try:
        await dispatch_generation(job)
    except Exception:
        _log.exception("Error dispatching generation (deck_id=%s, task_id=%s)", deck.id, task_id)
        mark_generation_failed(deck, task, "Failed to enqueue deck generation.")
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deck generation service is temporarily unavailable. Please try again.",
        )

    return DeckGenerateResponseDTO(
        task_id=task_id,
        deck_id=deck.id,
        status=DeckStatus.PENDING,
    )


@router.get("/decks", response_model=DeckListResponseDTO)
async def list_decks(
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> DeckListResponseDTO:
    offset = (page - 1) * limit

    # Only saved snapshots reach the library. A draft is the deck-builder's
    # working copy — the forge and every refine overwrites it, so listing it
    # would show a deck the user never chose to keep.
    count_result = await db.execute(
        select(func.count())
        .select_from(Deck)
        .where(Deck.user_id == user_id, Deck.saved_at.is_not(None))
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Deck)
        .where(Deck.user_id == user_id, Deck.saved_at.is_not(None))
        .order_by(Deck.saved_at.desc())
        .offset(offset)
        .limit(limit)
    )
    decks = result.scalars().all()

    pages = math.ceil(total / limit) if total > 0 else 1

    return DeckListResponseDTO(
        decks=[_owned_response(d) for d in decks],
        total=total,
        page=page,
        pages=pages,
    )


def _owned_response(deck: Deck) -> DeckResponseDTO:
    """`deck` as seen by its owner."""
    return DeckResponseDTO.model_validate(deck).model_copy(update={"is_owner": True})


def _publicly_readable(deck: Deck) -> bool:
    """A saved deck its owner marked public. Drafts are never public: they are
    the owner's working copy, overwritten by every refine."""
    return deck.is_public and deck.saved_at is not None


# --- community feed ---------------------------------------------------------

# Public and unauthenticated, so it gets an app-level limit (see rate_limit.py).
_explore_limiter = SlidingWindowLimiter(limit=60, window_seconds=60)


def _encode_cursor(deck: Deck) -> str:
    raw = f"{deck.created_at.isoformat()}|{deck.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        created_at, deck_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|", 1)
        return datetime.fromisoformat(created_at), uuid.UUID(deck_id)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor.")


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _feed_item(deck: Deck) -> DeckResponseDTO:
    """`deck` as a feed entry: cards trimmed to the cover card."""
    item = DeckResponseDTO.model_validate(deck)
    cover = next((card for card in item.cards or [] if card.art_crop_uri or card.image_uri), None)
    return item.model_copy(update={"cards": [cover] if cover else []})


@router.get(
    "/explore/decks",
    response_model=ExploreDeckListResponseDTO,
    dependencies=[Depends(rate_limited(_explore_limiter))],
)
async def explore_decks(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=100, description="Matches deck names")] = None,
    colors: Annotated[list[MTGColor] | None, Query(description="Deck includes every one")] = None,
    tags: Annotated[list[str] | None, Query(max_length=10, description="Deck has every one")] = None,
    format: DeckFormat | None = None,
    cursor: str | None = None,
    limit: int = Query(default=24, ge=1, le=50),
) -> ExploreDeckListResponseDTO:
    """Public saved decks, newest first. No auth. Filters combine with AND."""
    stmt = select(Deck).where(Deck.is_public.is_(True), Deck.saved_at.is_not(None))

    if q and q.strip():
        stmt = stmt.where(func.coalesce(Deck.title, Deck.prompt).ilike(f"%{_escape_like(q.strip())}%", escape="\\"))
    if colors:
        stmt = stmt.where(Deck.colors.contains(array([c.value for c in colors])))
    wanted_tags = [t for t in (normalize_tag(tag) for tag in tags or []) if t]
    if wanted_tags:
        stmt = stmt.where(Deck.tags.contains(array(wanted_tags)))
    if format:
        stmt = stmt.where(Deck.format == format.value)
    if cursor:
        created_at, deck_id = _decode_cursor(cursor)
        stmt = stmt.where(tuple_(Deck.created_at, Deck.id) < tuple_(created_at, deck_id))

    # One extra row tells us whether another page exists without a COUNT.
    stmt = stmt.order_by(Deck.created_at.desc(), Deck.id.desc()).limit(limit + 1)
    rows = list((await db.execute(stmt)).scalars().all())
    page, more = rows[:limit], len(rows) > limit

    return ExploreDeckListResponseDTO(
        decks=[_feed_item(deck) for deck in page],
        next_cursor=_encode_cursor(page[-1]) if more else None,
    )


@router.get("/decks/{deck_id}", response_model=DeckResponseDTO)
async def get_deck(
    deck_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> DeckResponseDTO:
    """Read-only. Owners see anything they own; anyone, signed in or not, sees
    a public saved deck. Everything else is the same 404/403 as before."""
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    is_owner = deck.user_id is not None and deck.user_id == user_id
    if deck.user_id is not None and not is_owner and not _publicly_readable(deck):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return DeckResponseDTO.model_validate(deck).model_copy(update={"is_owner": is_owner})


@router.patch("/decks/{deck_id}/visibility", response_model=DeckResponseDTO)
async def set_deck_visibility(
    deck_id: uuid.UUID,
    request: DeckVisibilityRequestDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> DeckResponseDTO:
    """Make a deck public or private. Owner only — an anonymous deck has no
    owner, so nobody can change it."""
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    if deck.user_id is None or deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    deck.is_public = request.is_public
    try:
        await db.commit()
    except SQLAlchemyError:
        _log.exception("Database error changing visibility of deck %s", deck_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deck storage is temporarily unavailable. Please try again shortly.",
        )
    await db.refresh(deck)
    return _owned_response(deck)


async def _readable_deck_or_error(db: AsyncSession, deck_id: uuid.UUID, user_id: str | None) -> Deck:
    """The deck at `deck_id`, or the same 404/403 `get_deck` would raise.

    One definition of "may this caller see this deck", shared by get, save and
    refine: an anonymous deck is readable by anyone holding its id, an owned one
    only by its owner.
    """
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    if deck.user_id is not None and deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return deck


def _snapshot_of(source: Deck, user_id: str, version_no: int) -> Deck:
    """An immutable copy of `source`, owned by `user_id`, at `version_no`.

    This field list is deliberately exhaustive, not a convenient subset: a
    column added to `Deck` later must be added here too, or it is silently
    dropped from every snapshot. Three columns are intentionally left out,
    not forgotten: `error_message` and `failed_at` are always None on a
    COMPLETED deck (the only status this function is ever called with), and
    `created_at` is not carried over because the snapshot is a new row and
    should get its own.
    """
    return Deck(
        id=uuid.uuid4(),
        title=source.title,
        description=source.description,
        prompt=source.prompt,
        user_id=user_id,
        format=source.format,
        colors=source.colors,
        cards=source.cards,
        card_count=source.card_count,
        status=source.status,
        completed_at=source.completed_at,
        saved_at=datetime.now(tz=UTC),
        lineage_id=source.lineage_id,
        version_no=version_no,
        is_public=source.is_public,
        tags=list(source.tags or []),
    )


@router.post("/decks/{deck_id}/save", response_model=DeckResponseDTO)
async def save_deck(
    deck_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> DeckResponseDTO:
    """Persist the working deck as an immutable version in the caller's library.

    This is also what adopts a deck forged while signed out: the snapshot is
    written with the caller's `user_id` regardless of the source row's null one.
    """
    source = await _readable_deck_or_error(db, deck_id, user_id)

    if source.saved_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This version is already saved. Refine it to make a new one.",
        )
    if source.status != DeckStatus.COMPLETED or not source.cards:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a finished deck can be saved.",
        )

    # `version_no` comes from a read, so a concurrent save can take the number
    # first. The unique constraint on (lineage_id, version_no) turns that into an
    # IntegrityError rather than a duplicate, and one retry re-reads the max.
    for attempt in range(2):
        highest = await db.execute(
            select(func.max(Deck.version_no)).where(Deck.lineage_id == source.lineage_id)
        )
        snapshot = _snapshot_of(source, user_id, (highest.scalar() or 0) + 1)
        db.add(snapshot)
        try:
            await db.commit()
            return _owned_response(snapshot)
        except IntegrityError:
            await db.rollback()
            if attempt == 1:
                _log.warning("Version number contention saving deck %s", deck_id)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Could not save just now. Please try again.",
                )
        except SQLAlchemyError:
            _log.exception("Database error saving deck %s", deck_id)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Deck storage is temporarily unavailable. Please try again shortly.",
            )

    raise AssertionError("unreachable")  # pragma: no cover


@router.put("/decks/{deck_id}/tags", response_model=DeckResponseDTO)
async def set_deck_tags(
    deck_id: uuid.UUID,
    request: DeckTagsRequestDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> DeckResponseDTO:
    """Replace a deck's tags (already normalised by the DTO). Owner only."""
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    if deck.user_id is None or deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    deck.tags = request.tags
    try:
        await db.commit()
    except SQLAlchemyError:
        _log.exception("Database error changing tags of deck %s", deck_id)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deck storage is temporarily unavailable. Please try again shortly.",
        )
    await db.refresh(deck)
    return _owned_response(deck)


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> None:
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    if deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.delete(deck)
