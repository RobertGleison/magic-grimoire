import logging
import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
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
from app.decks.pipeline import mark_generation_failed
from app.decks.worker import generate_deck_task
from app.tasks.model import Task

_log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/decks/generate", response_model=DeckGenerateResponseDTO, status_code=status.HTTP_202_ACCEPTED)
async def generate_deck(
    request: DeckGenerateRequestDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str | None, Depends(get_optional_user)],
) -> DeckGenerateResponseDTO:
    valid, rejection = sanitize_prompt(request.prompt)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=rejection)

    deck = Deck(
        prompt=request.prompt,
        format=request.format,
        status=DeckStatus.PENDING,
        user_id=user_id,
    )
    db.add(deck)

    try:
        await db.flush()

        # Generate task_id here so we can commit before apply_async — eliminates the race
        # condition where the worker tries to read the Task record before it's committed.
        task_id = str(uuid.uuid4())
        task = Task(id=task_id, deck_id=deck.id, status=TaskStatus.QUEUED)
        db.add(task)

        await db.commit()
    except SQLAlchemyError:
        _log.exception("Database error creating deck/task (prompt=%r, format=%s)", request.prompt, request.format)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deck storage is temporarily unavailable. Please try again shortly.",
        )

    try:
        generate_deck_task.apply_async(
            args=[str(deck.id), request.prompt, request.format],
            task_id=task_id,
        )
    except Exception:
        _log.exception("Broker error enqueueing task (deck_id=%s, task_id=%s)", deck.id, task_id)
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
