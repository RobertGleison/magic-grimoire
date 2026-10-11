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

    async def cancel(self, task_id: str) -> bool:
        """Best-effort stop of a dispatched job; True when something was stopped.

        The authoritative cancel is the `cancelled` status on the task row, which the
        pipeline checks between stages. This only speeds it up where the runtime allows.
        """
        ...


class LambdaDispatcher:
    def __init__(self, function_name: str, client: Any = None):
        self._function_name = function_name
        self._client = client

    def _lambda(self) -> Any:
        if self._client is None:
            import boto3
            from botocore.config import Config

            # Tight limits so a slow invoke fails fast enough for the generate route's
            # 503 path to run inside the API Lambda's 60s timeout.
            config = Config(connect_timeout=3, read_timeout=5, retries={"max_attempts": 2, "mode": "standard"})
            self._client = boto3.client("lambda", config=config)
        return self._client

    async def cancel(self, task_id: str) -> bool:
        # An async-invoked Lambda can't be stopped from outside; the worker notices the
        # `cancelled` row at its next stage boundary and exits without saving.
        return False

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
        self._by_task_id: dict[str, asyncio.Task] = {}

    async def dispatch(self, job: GenerationJob) -> None:
        task = asyncio.create_task(self._run(job))
        self.running.add(task)
        self._by_task_id[job.task_id] = task

        def _forget(done: asyncio.Task) -> None:
            self.running.discard(done)
            if self._by_task_id.get(job.task_id) is done:
                del self._by_task_id[job.task_id]

        task.add_done_callback(_forget)

    async def cancel(self, task_id: str) -> bool:
        """Cancel the local asyncio task, so a queued job never runs and a running one
        stops at its next await. A blocking LLM call already handed to a thread finishes
        in that thread, but its result is discarded."""
        task = self._by_task_id.get(task_id)
        if task is None or task.done():
            return False
        task.cancel()
        return True

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


async def cancel_generation(task_id: str) -> bool:
    """Best-effort runtime stop for a task already marked cancelled. Never raises."""
    try:
        return await _dispatcher.cancel(task_id)
    except Exception:
        _log.exception("Could not stop the runtime job for task %s", task_id)
        return False
