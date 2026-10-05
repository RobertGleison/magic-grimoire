"""How a generation job reaches the worker — the only module that knows.

Production async-invokes the worker Lambda (Lambda itself supplies queueing,
retries and a DLQ); local dev runs the same pipeline inside the API process.
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass
from typing import Any, Protocol

from app.core.config import settings
from app.decks.pipeline import DeckGenerationPipeline

_log = logging.getLogger(__name__)


@dataclass(frozen=True)
class GenerationJob:
    """One deck generation. Its fields are DeckGenerationPipeline's constructor arguments."""

    task_id: str
    deck_id: str
    prompt: str
    format: str
    colors: list[str] | None = None
    deck_size: int = 60


class Dispatcher(Protocol):
    async def dispatch(self, job: GenerationJob) -> None: ...


class LambdaDispatcher:
    def __init__(self, function_name: str, client: Any = None):
        self._function_name = function_name
        self._client = client

    def _lambda(self) -> Any:
        if self._client is None:
            import boto3

            self._client = boto3.client("lambda")
        return self._client

    async def dispatch(self, job: GenerationJob) -> None:
        # boto3 is blocking; keep it off the event loop.
        await asyncio.to_thread(
            self._lambda().invoke,
            FunctionName=self._function_name,
            InvocationType="Event",
            Payload=json.dumps(asdict(job)).encode(),
        )


class InProcessDispatcher:
    """Local dev: run the pipeline as a background task in the API's event loop.

    Generations run one at a time, because local Ollama can't serve concurrent ones.
    """

    def __init__(self) -> None:
        self._gate = asyncio.Semaphore(1)
        # Strong references, or the event loop may garbage-collect a running task.
        self.running: set[asyncio.Task] = set()

    async def dispatch(self, job: GenerationJob) -> None:
        task = asyncio.create_task(self._run(job))
        self.running.add(task)
        task.add_done_callback(self.running.discard)

    async def _run(self, job: GenerationJob) -> None:
        async with self._gate:
            try:
                await DeckGenerationPipeline(**asdict(job)).run()
            except Exception:
                # The pipeline has already recorded the failure on the deck/task rows.
                _log.exception("Deck generation failed for task %s", job.task_id)


def create_dispatcher(kind: str, worker_function_name: str | None) -> Dispatcher:
    if kind == "lambda":
        if not worker_function_name:
            raise ValueError("WORKER_FUNCTION_NAME is required when TASK_DISPATCHER=lambda")
        return LambdaDispatcher(worker_function_name)
    if kind == "inprocess":
        return InProcessDispatcher()
    raise ValueError(f"Unknown TASK_DISPATCHER: {kind}")


_dispatcher = create_dispatcher(settings.TASK_DISPATCHER, settings.WORKER_FUNCTION_NAME)


async def dispatch_generation(job: GenerationJob) -> None:
    """Hand a committed deck/task pair to the worker. Raises if delivery fails."""
    await _dispatcher.dispatch(job)
