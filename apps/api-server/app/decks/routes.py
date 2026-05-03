import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_optional_user
from app.core.database import get_db
from app.core.enums import DeckStatus, TaskStatus
from app.core.guards import sanitize_prompt
from app.decks.dtos import (
    DeckGenerateRequestDTO,
    DeckGenerateResponseDTO,
    DeckListResponseDTO,
    DeckResponseDTO,
)
from app.decks.model import Deck
from app.services import redis_cache
from app.tasks.model import Task

router = APIRouter()

_GUEST_RATE_LIMIT_TTL = 30 * 24 * 60 * 60


@router.post("/decks/generate", response_model=DeckGenerateResponseDTO, status_code=status.HTTP_202_ACCEPTED)
async def generate_deck(
    request: DeckGenerateRequestDTO,
    req: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> DeckGenerateResponseDTO:
    from app.decks.worker import generate_deck_task

    valid, rejection = sanitize_prompt(request.prompt)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=rejection)

    if not user_id:
        client_ip = req.client.host if req.client else "unknown"
        rate_key = f"ratelimit:ip:{client_ip}"
        if await redis_cache.get(rate_key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Guest generation limit reached. Sign in to generate more decks.",
            )
        await redis_cache.set(rate_key, "1", ttl=_GUEST_RATE_LIMIT_TTL)

    deck = Deck(
        prompt=request.prompt,
        format=request.format,
        status=DeckStatus.PENDING,
        user_id=user_id,
    )
    db.add(deck)
    await db.flush()

    # Generate task_id here so we can commit before apply_async — eliminates the race
    # condition where the worker tries to read the Task record before it's committed.
    task_id = str(uuid.uuid4())
    task = Task(id=task_id, deck_id=deck.id, status=TaskStatus.QUEUED)
    db.add(task)

    await db.commit()

    generate_deck_task.apply_async(
        args=[str(deck.id), request.prompt, request.format],
        task_id=task_id,
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

    count_result = await db.execute(
        select(func.count()).select_from(Deck).where(Deck.user_id == user_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Deck)
        .where(Deck.user_id == user_id)
        .order_by(Deck.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    decks = result.scalars().all()

    pages = math.ceil(total / limit) if total > 0 else 1

    return DeckListResponseDTO(
        decks=[DeckResponseDTO.model_validate(d) for d in decks],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/decks/{deck_id}", response_model=DeckResponseDTO)
async def get_deck(
    deck_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> DeckResponseDTO:
    result = await db.execute(select(Deck).where(Deck.id == deck_id))
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    if deck.user_id is not None and deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return DeckResponseDTO.model_validate(deck)


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
