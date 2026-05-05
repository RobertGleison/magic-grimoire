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

# Created once when the worker process starts — not on every task call.
_engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
_session_factory = async_sessionmaker(bind=_engine, class_=AsyncSession, expire_on_commit=False)


async def _publish(redis_client: aioredis.Redis, channel: str, status: str, message: str) -> None:
    try:
        await redis_client.publish(channel, json.dumps({"status": status, "message": message}))
    except Exception:
        _log.warning("SSE publish failed (channel=%s, status=%s) — notification dropped", channel, status)


async def _update_and_publish(
    db: AsyncSession,
    redis_client: aioredis.Redis,
    channel: str,
    task: Task | None,
    deck: Deck | None,
    task_status: TaskStatus,
    deck_status: DeckStatus,
    message: str,
) -> None:
    """Update task/deck status in DB then publish a progress event."""
    now = datetime.now(tz=UTC)
    if task:
        task.status = task_status
        task.updated_at = now
    if deck:
        deck.status = deck_status
    await db.commit()
    await _publish(redis_client, channel, task_status, message)


async def _run_generate_deck(task_id: str, deck_id: str, prompt: str, format: str) -> None:
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    channel = f"task:{task_id}"
    deck_uuid = uuid.UUID(deck_id)

    try:
        async with _session_factory() as db:
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            result = await db.execute(select(Deck).where(Deck.id == deck_uuid))
            deck = result.scalar_one_or_none()
            await _update_and_publish(
                db, redis_client, channel, task, deck,
                TaskStatus.PROCESSING, DeckStatus.PROCESSING,
                "Parsing your request...",
            )

        llm = create_llm_service()
        loop = asyncio.get_running_loop()
        intent = await loop.run_in_executor(None, llm.parse_intent, prompt)

        # Belt-and-suspenders: LLM may flag off_topic even if the rule filter passed.
        if intent.get("error") == "off_topic":
            raise ValueError(intent.get("message", "I only discuss Magic: The Gathering."))

        await _publish(redis_client, channel, "searching_cards", "Searching for cards...")

        candidate_cards = await scryfall_service.search_cards(intent)

        await _publish(redis_client, channel, "composing_deck", "Building your deck...")

        deck_composition = await loop.run_in_executor(
            None, llm.compose_deck, intent, candidate_cards, format
        )

        await _publish(redis_client, channel, "enriching", "Fetching card images...")

        enriched_cards = await scryfall_service.enrich_cards(deck_composition.get("cards", []))

        async with _session_factory() as db:
            result = await db.execute(select(Deck).where(Deck.id == deck_uuid))
            deck = result.scalar_one_or_none()
            if deck:
                deck.title = deck_composition.get("title")
                deck.cards = enriched_cards
                deck.card_count = sum(c.get("quantity", 1) for c in enriched_cards)
                deck.colors = intent.get("colors", [])
                deck.status = DeckStatus.COMPLETED
                deck.completed_at = datetime.now(tz=UTC)

            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = TaskStatus.COMPLETED
                task.updated_at = datetime.now(tz=UTC)

            await db.commit()

        await _publish(redis_client, channel, TaskStatus.COMPLETED, "Your deck is ready!")

    except Exception as exc:
        try:
            async with _session_factory() as db:
                result = await db.execute(select(Deck).where(Deck.id == deck_uuid))
                deck = result.scalar_one_or_none()
                if deck:
                    deck.status = DeckStatus.FAILED
                    deck.error_message = str(exc)
                    deck.failed_at = datetime.now(tz=UTC)

                result = await db.execute(select(Task).where(Task.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    task.status = TaskStatus.FAILED
                    task.failed_at = datetime.now(tz=UTC)
                    task.updated_at = datetime.now(tz=UTC)

                await db.commit()
        except Exception:
            pass

        await _publish(redis_client, channel, TaskStatus.FAILED, str(exc))
        raise

    finally:
        await redis_client.aclose()


@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(self, deck_id: str, prompt: str, format: str) -> dict:
    task_id: str = self.request.id
    asyncio.run(_run_generate_deck(task_id=task_id, deck_id=deck_id, prompt=prompt, format=format))
    return {"task_id": task_id, "deck_id": deck_id, "status": TaskStatus.COMPLETED}
