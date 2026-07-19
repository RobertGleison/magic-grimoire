import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.model import Deck
from app.services import redis_cache, scryfall_service
from app.services.llm import create_llm_service
from app.tasks.model import Task
from app.tasks.streaming import task_channel

_log = logging.getLogger(__name__)

SessionFactory = async_sessionmaker[AsyncSession]


def mark_generation_failed(deck: Deck | None, task: Task | None, error: str) -> None:
    """Set the failure fields on a deck/task pair.

    The single definition of what a failed generation looks like — used by the
    pipeline mid-run and by the generate route when enqueueing fails.
    """
    now = datetime.now(tz=UTC)
    if deck:
        deck.status = DeckStatus.FAILED
        deck.error_message = error
        deck.failed_at = now
    if task:
        task.status = TaskStatus.FAILED
        task.failed_at = now
        task.updated_at = now


class DeckGenerationPipeline:
    """Owns the full deck-generation sequence: intent parsing, card search,
    composition, enrichment, persistence, progress events, and failure handling."""

    def __init__(self, task_id: str, deck_id: str, prompt: str, format: str, colors: list[str] | None = None):
        self.task_id = task_id
        self.deck_uuid = uuid.UUID(deck_id)
        self.prompt = prompt
        self.format = format
        self.explicit_colors = colors
        self.channel = task_channel(task_id)
        self._session_factory: SessionFactory | None = None

    async def run(self) -> None:
        # Engine is created fresh per task invocation — each Celery task call runs in its
        # own asyncio.run() event loop, and asyncpg connections can't cross event loops.
        engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
        self._session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

        try:
            await self._generate()
        except Exception as exc:
            await self._mark_failed(str(exc))
            await self._publish(TaskProgress.FAILED, str(exc))
            raise
        finally:
            await engine.dispose()

    async def _generate(self) -> None:
        await self._mark_processing()
        await self._publish(TaskProgress.PROCESSING, "Parsing your request...")

        llm = create_llm_service()
        loop = asyncio.get_running_loop()
        intent = await loop.run_in_executor(None, llm.parse_intent, self.prompt)

        # Belt-and-suspenders: LLM may flag off_topic even if the rule filter passed.
        if intent.get("error") == "off_topic":
            raise ValueError(intent.get("message", "I only discuss Magic: The Gathering."))

        # Explicit user selection always wins over the LLM's guess from the prompt text.
        if self.explicit_colors is not None:
            intent["colors"] = self.explicit_colors

        await self._publish(TaskProgress.SEARCHING_CARDS, "Searching for cards...")
        candidate_cards = await scryfall_service.search_cards(intent)

        await self._publish(TaskProgress.COMPOSING_DECK, "Building your deck...")
        deck_composition = await loop.run_in_executor(
            None, llm.compose_deck, intent, candidate_cards, self.format
        )

        await self._publish(TaskProgress.ENRICHING, "Fetching card images...")
        enriched_cards = await scryfall_service.enrich_cards(deck_composition.get("cards", []))

        await self._save_completed(
            title=deck_composition.get("title"),
            cards=enriched_cards,
            colors=intent.get("colors", []),
        )
        await self._publish(TaskProgress.COMPLETED, "Your deck is ready!")

    async def _publish(self, status: str, message: str) -> None:
        try:
            await redis_cache.publish(self.channel, {"status": status, "message": message})
        except Exception:
            _log.warning(
                "SSE publish failed (channel=%s, status=%s) — notification dropped", self.channel, status
            )

    async def _fetch_deck_and_task(self, db: AsyncSession) -> tuple[Deck | None, Task | None]:
        deck = (await db.execute(select(Deck).where(Deck.id == self.deck_uuid))).scalar_one_or_none()
        task = (await db.execute(select(Task).where(Task.id == self.task_id))).scalar_one_or_none()
        return deck, task

    async def _mark_processing(self) -> None:
        async with self._session_factory() as db:
            deck, task = await self._fetch_deck_and_task(db)
            if deck:
                deck.status = DeckStatus.PROCESSING
            if task:
                task.status = TaskStatus.PROCESSING
                task.updated_at = datetime.now(tz=UTC)
            await db.commit()

    async def _save_completed(self, title: str | None, cards: list[dict], colors: list[str]) -> None:
        now = datetime.now(tz=UTC)
        async with self._session_factory() as db:
            deck, task = await self._fetch_deck_and_task(db)
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

    async def _mark_failed(self, error: str) -> None:
        try:
            async with self._session_factory() as db:
                deck, task = await self._fetch_deck_and_task(db)
                mark_generation_failed(deck, task, error)
                await db.commit()
        except Exception:
            _log.exception("Could not mark deck %s / task %s as failed", self.deck_uuid, self.task_id)
