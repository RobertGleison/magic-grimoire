import asyncio
import json
import uuid
from datetime import UTC, datetime

import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.decks.model import Deck
from app.services import claude_service, scryfall_service
from app.tasks.model import Task
from app.workers.celery_app import celery_app


def _make_session() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def _publish(redis_client: aioredis.Redis, channel: str, payload: dict) -> None:
    await redis_client.publish(channel, json.dumps(payload))


async def _run_generate_deck(
    task_id: str,
    deck_id: str,
    prompt: str,
    format: str,
) -> None:
    session_factory = _make_session()
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    channel = f"task:{task_id}"

    deck_uuid = uuid.UUID(deck_id)

    try:
        async with session_factory() as db:
            # Step 1: Mark task as processing
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "processing"
                task.updated_at = datetime.now(tz=UTC)
                await db.commit()

            await _publish(redis_client, channel, {"status": "parsing_intent", "message": "Parsing your request..."})

        # Step 2: Parse intent (sync Claude call, run in executor to avoid blocking)
        loop = asyncio.get_event_loop()
        intent = await loop.run_in_executor(None, claude_service.parse_intent, prompt)

        await _publish(redis_client, channel, {"status": "searching_cards", "message": "Searching for cards..."})

        # Step 3: Search Scryfall for candidate cards
        candidate_cards = await scryfall_service.search_cards(intent)

        await _publish(redis_client, channel, {"status": "composing_deck", "message": "Building your deck..."})

        # Step 4: Compose deck with Claude
        deck_composition = await loop.run_in_executor(
            None, claude_service.compose_deck, intent, candidate_cards, format
        )

        await _publish(redis_client, channel, {"status": "enriching", "message": "Fetching card images..."})

        # Step 5: Enrich cards with Scryfall data
        enriched_cards = await scryfall_service.enrich_cards(deck_composition.get("cards", []))

        # Step 6: Save completed deck to DB
        async with session_factory() as db:
            result = await db.execute(select(Deck).where(Deck.id == deck_uuid))
            deck = result.scalar_one_or_none()
            if deck:
                deck.title = deck_composition.get("title")
                deck.cards = enriched_cards
                deck.card_count = sum(c.get("quantity", 1) for c in enriched_cards)
                deck.colors = intent.get("colors", [])
                deck.status = "completed"
                deck.completed_at = datetime.now(tz=UTC)

            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = "completed"
                task.updated_at = datetime.now(tz=UTC)

            await db.commit()

        await _publish(redis_client, channel, {"status": "completed", "message": "Your deck is ready!"})

    except Exception as exc:
        try:
            async with session_factory() as db:
                result = await db.execute(select(Deck).where(Deck.id == deck_uuid))
                deck = result.scalar_one_or_none()
                if deck:
                    deck.status = "failed"
                    deck.error_message = str(exc)

                result = await db.execute(select(Task).where(Task.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.updated_at = datetime.now(tz=UTC)

                await db.commit()
        except Exception:
            pass  # Best effort DB update on failure path

        await _publish(redis_client, channel, {"status": "failed", "message": str(exc)})
        raise

    finally:
        await redis_client.aclose()


@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(
    self,
    deck_id: str,
    prompt: str,
    format: str,
) -> dict:
    task_id: str = self.request.id

    asyncio.run(
        _run_generate_deck(
            task_id=task_id,
            deck_id=deck_id,
            prompt=prompt,
            format=format,
        )
    )

    return {"task_id": task_id, "deck_id": deck_id, "status": "completed"}
