import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.enums import DeckStatus, TaskStatus
from app.decks.model import Deck
from app.services import scryfall_service
from app.services.llm import create_llm_service
from app.tasks.model import Task
from app.workers.celery_app import celery_app

_log = logging.getLogger(__name__)

SessionFactory = async_sessionmaker[AsyncSession]


async def _publish(redis_client: aioredis.Redis, channel: str, status: str, message: str) -> None:
    try:
        await redis_client.publish(channel, json.dumps({"status": status, "message": message}))
    except Exception:
        _log.warning("SSE publish failed (channel=%s, status=%s) — notification dropped", channel, status)


async def _fetch_deck_and_task(db: AsyncSession, deck_uuid: uuid.UUID, task_id: str) -> tuple[Deck | None, Task | None]:
    deck = (await db.execute(select(Deck).where(Deck.id == deck_uuid))).scalar_one_or_none()
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    return deck, task


async def _mark_processing(session_factory: SessionFactory, deck_uuid: uuid.UUID, task_id: str) -> None:
    async with session_factory() as db:
        deck, task = await _fetch_deck_and_task(db, deck_uuid, task_id)
        if deck:
            deck.status = DeckStatus.PROCESSING
        if task:
            task.status = TaskStatus.PROCESSING
            task.updated_at = datetime.now(tz=UTC)
        await db.commit()


async def _save_completed_deck(
    session_factory: SessionFactory,
    deck_uuid: uuid.UUID,
    task_id: str,
    title: str | None,
    cards: list[dict],
    colors: list[str],
) -> None:
    now = datetime.now(tz=UTC)
    async with session_factory() as db:
        deck, task = await _fetch_deck_and_task(db, deck_uuid, task_id)
        if deck:
            deck.title = title
            deck.cards = cards
            deck.card_count = sum(card.get("quantity", 1) for card in cards)
            deck.colors = colors
            deck.status = DeckStatus.COMPLETED
            deck.completed_at = now
        if task:
            task.status = TaskStatus.COMPLETED
            task.updated_at = now
        await db.commit()


async def _mark_failed(session_factory: SessionFactory, deck_uuid: uuid.UUID, task_id: str, error: str) -> None:
    now = datetime.now(tz=UTC)
    try:
        async with session_factory() as db:
            deck, task = await _fetch_deck_and_task(db, deck_uuid, task_id)
            if deck:
                deck.status = DeckStatus.FAILED
                deck.error_message = error
                deck.failed_at = now
            if task:
                task.status = TaskStatus.FAILED
                task.failed_at = now
                task.updated_at = now
            await db.commit()
    except Exception:
        _log.exception("Could not mark deck %s / task %s as failed", deck_uuid, task_id)


async def _run_generate_deck(task_id: str, deck_id: str, prompt: str, format: str) -> None:
    # Engine is created fresh per task invocation — each Celery task call runs in its
    # own asyncio.run() event loop, and asyncpg connections can't cross event loops.
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    channel = f"task:{task_id}"
    deck_uuid = uuid.UUID(deck_id)

    try:
        await _mark_processing(session_factory, deck_uuid, task_id)
        await _publish(redis_client, channel, TaskStatus.PROCESSING, "Parsing your request...")

        llm = create_llm_service()
        loop = asyncio.get_running_loop()
        intent = await loop.run_in_executor(None, llm.parse_intent, prompt)

        # Belt-and-suspenders: LLM may flag off_topic even if the rule filter passed.
        if intent.get("error") == "off_topic":
            raise ValueError(intent.get("message", "I only discuss Magic: The Gathering."))

        await _publish(redis_client, channel, "searching_cards", "Searching for cards...")
        candidate_cards = await scryfall_service.search_cards(intent)

        await _publish(redis_client, channel, "composing_deck", "Building your deck...")
        deck_composition = await loop.run_in_executor(None, llm.compose_deck, intent, candidate_cards, format)

        await _publish(redis_client, channel, "enriching", "Fetching card images...")
        enriched_cards = await scryfall_service.enrich_cards(deck_composition.get("cards", []))

        await _save_completed_deck(
            session_factory,
            deck_uuid,
            task_id,
            title=deck_composition.get("title"),
            cards=enriched_cards,
            colors=intent.get("colors", []),
        )
        await _publish(redis_client, channel, TaskStatus.COMPLETED, "Your deck is ready!")

    except Exception as exc:
        await _mark_failed(session_factory, deck_uuid, task_id, str(exc))
        await _publish(redis_client, channel, TaskStatus.FAILED, str(exc))
        raise

    finally:
        await redis_client.aclose()
        await engine.dispose()


@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(self, deck_id: str, prompt: str, format: str) -> dict:
    task_id: str = self.request.id
    asyncio.run(_run_generate_deck(task_id=task_id, deck_id=deck_id, prompt=prompt, format=format))
    return {"task_id": task_id, "deck_id": deck_id, "status": TaskStatus.COMPLETED}
