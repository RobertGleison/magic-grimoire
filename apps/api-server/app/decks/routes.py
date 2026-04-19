import math
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.decks.dtos import (
    DeckGenerateRequestDTO,
    DeckGenerateResponseDTO,
    DeckListResponseDTO,
    DeckResponseDTO,
)
from app.decks.model import Deck
from app.tasks.model import Task

router = APIRouter()


@router.post("/decks/generate", response_model=DeckGenerateResponseDTO, status_code=status.HTTP_202_ACCEPTED)
async def generate_deck(
    request: DeckGenerateRequestDTO,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DeckGenerateResponseDTO:
    from app.decks.worker import generate_deck_task

    deck = Deck(
        prompt=request.prompt,
        format=request.format,
        status="pending",
    )
    db.add(deck)
    await db.flush()

    celery_result = generate_deck_task.delay(
        str(deck.id),
        request.prompt,
        request.format,
    )

    task = Task(
        id=celery_result.id,
        deck_id=deck.id,
        status="queued",
    )
    db.add(task)
    await db.flush()

    return DeckGenerateResponseDTO(
        task_id=celery_result.id,
        deck_id=deck.id,
        status="queued",
    )


@router.get("/decks", response_model=DeckListResponseDTO)
async def list_decks(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> DeckListResponseDTO:
    offset = (page - 1) * limit

    count_result = await db.execute(
        select(func.count()).select_from(Deck)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Deck)
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
) -> DeckResponseDTO:
    result = await db.execute(
        select(Deck).where(Deck.id == deck_id)
    )
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    return DeckResponseDTO.model_validate(deck)


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    result = await db.execute(
        select(Deck).where(Deck.id == deck_id)
    )
    deck = result.scalar_one_or_none()

    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    await db.delete(deck)
