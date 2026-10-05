import asyncio
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import DatabaseSessionManager, engine_kwargs
from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.model import Deck
from app.llm import create_llm_service
from app.services import scryfall_service
from app.tasks.model import Task

_log = logging.getLogger(__name__)


class FailureNotRecorded(Exception):
    """A generation failed and the failure could not be written to the deck/task rows.

    The worker handler swallows ordinary failures because they're already recorded, and
    a retry would rerun the same prompt into the same error. This one must escape instead:
    nothing in the database says the task is finished, so Lambda's retries (and then the
    DLQ) are the only way it gets another attempt or is noticed at all.
    """


def mark_generation_failed(deck: Deck | None, task: Task | None, error: str) -> None:
    """Set the failure fields on a deck/task pair.

    The single definition of what a failed generation looks like — used by the
    pipeline mid-run and by the generate route when dispatching fails.
    """
    now = datetime.now(tz=UTC)
    if deck:
        deck.status = DeckStatus.FAILED
        deck.error_message = error
        deck.failed_at = now
    if task:
        task.status = TaskStatus.FAILED
        task.progress = TaskProgress.FAILED
        task.message = error
        task.failed_at = now
        task.updated_at = now


class DeckGenerationPipeline:
    """Owns the full deck-generation sequence: intent parsing, card search,
    composition, enrichment, persistence, progress on the task row, and failure handling."""

    def __init__(
        self,
        task_id: str,
        deck_id: str,
        prompt: str,
        format: str,
        colors: list[str] | None = None,
        deck_size: int = 60,
    ):
        self.task_id = task_id
        self.deck_uuid = uuid.UUID(deck_id)
        self.prompt = prompt
        self.format = format
        self.explicit_colors = colors
        self.deck_size = deck_size
        self._db: DatabaseSessionManager | None = None

    async def run(self) -> None:
        # Fresh per run: the worker Lambda calls asyncio.run() per invocation, and pooled
        # asyncpg connections can't cross event loops.
        self._db = DatabaseSessionManager(settings.DATABASE_URL, engine_kwargs())

        try:
            if await self._should_skip():
                return
            await self._generate()
        except Exception as exc:
            if not await self._mark_failed(str(exc)):
                raise FailureNotRecorded(f"Task {self.task_id} failed and could not be marked failed") from exc
            raise
        finally:
            await self._db.close()

    async def _generate(self) -> None:
        await self._mark_processing()

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
            None, llm.compose_deck, intent, candidate_cards, self.format, self.deck_size
        )

        await self._publish(TaskProgress.ENRICHING, "Fetching card images...")
        enriched_cards = await scryfall_service.enrich_cards(deck_composition.get("cards", []))

        await self._save_completed(
            title=deck_composition.get("title"),
            cards=enriched_cards,
            colors=intent.get("colors", []),
        )

    async def _publish(self, progress: TaskProgress, message: str) -> None:
        """Record the current stage on the task row; the frontend polls GET /tasks/{id}."""
        async with self._db.session() as db:
            _, task = await self._fetch_deck_and_task(db)
            if task:
                task.progress = progress
                task.message = message
                task.updated_at = datetime.now(tz=UTC)

    async def _fetch_deck_and_task(self, db: AsyncSession) -> tuple[Deck | None, Task | None]:
        deck = (await db.execute(select(Deck).where(Deck.id == self.deck_uuid))).scalar_one_or_none()
        task = (await db.execute(select(Task).where(Task.id == self.task_id))).scalar_one_or_none()
        return deck, task

    async def _should_skip(self) -> bool:
        """True when this delivery must do no work (and so make no LLM calls)."""
        async with self._db.session() as db:
            _, task = await self._fetch_deck_and_task(db)
        if task is None:
            # A stale or malformed event: there's no row to report progress on.
            _log.warning("Task %s not found; skipping generation", self.task_id)
            return True
        # Lambda async invoke is at-least-once; a redelivered job must not redo work.
        if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
            _log.info("Task %s already %s; skipping duplicate delivery", self.task_id, task.status)
            return True
        return False

    async def _mark_processing(self) -> None:
        async with self._db.session() as db:
            deck, task = await self._fetch_deck_and_task(db)
            if deck:
                deck.status = DeckStatus.PROCESSING
            if task:
                task.status = TaskStatus.PROCESSING
                task.progress = TaskProgress.PROCESSING
                task.message = "Parsing your request..."
                task.updated_at = datetime.now(tz=UTC)

    async def _save_completed(self, title: str | None, cards: list[dict], colors: list[str]) -> None:
        now = datetime.now(tz=UTC)
        async with self._db.session() as db:
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
                task.progress = TaskProgress.COMPLETED
                task.message = "Your deck is ready!"
                task.updated_at = now

    async def _mark_failed(self, error: str) -> bool:
        """Record the failure; returns False when the database write itself failed."""
        try:
            async with self._db.session() as db:
                deck, task = await self._fetch_deck_and_task(db)
                mark_generation_failed(deck, task, error)
        except Exception:
            _log.exception("Could not mark deck %s / task %s as failed", self.deck_uuid, self.task_id)
            return False
        return True
