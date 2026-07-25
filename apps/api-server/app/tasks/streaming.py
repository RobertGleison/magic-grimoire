"""The contract between the deck-generation worker (publisher) and the SSE
endpoint (subscriber): channel naming, event framing, the terminal-status
definition, and the subscription lifecycle all live here so neither side
can drift out of sync with the other."""

import json
import logging
from collections.abc import AsyncGenerator

from app.core.enums import TaskProgress
from app.services import redis_cache

_log = logging.getLogger(__name__)

# Worker events can be minutes apart (LLM calls); anything between the browser
# and this endpoint (Next.js rewrite proxy, load balancers) drops connections
# that stay silent longer than ~30-60s, so emit a keepalive comment in the gaps.
_KEEPALIVE_INTERVAL = 10.0


def task_channel(task_id: str) -> str:
    """Redis pub/sub channel carrying progress events for one task."""
    return f"task:{task_id}"


def sse_event(data: str) -> str:
    """Frame an already-serialized payload as a Server-Sent Events data event."""
    return f"data: {data}\n\n"


def is_terminal(progress_status: str) -> bool:
    """Whether a published progress status marks the end of a task's event stream."""
    return progress_status in (TaskProgress.COMPLETED, TaskProgress.FAILED)


async def subscribe_to_task(task_id: str) -> AsyncGenerator[str]:
    """Stream framed SSE events for one task's progress channel until a terminal status arrives."""
    channel = task_channel(task_id)
    pubsub = redis_cache.get_client().pubsub()

    try:
        await pubsub.subscribe(channel)

        while True:
            # get_message() only blocks when given a timeout — without one it
            # returns None immediately and no keepalive would ever be sent.
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=_KEEPALIVE_INTERVAL)
            if message is None:
                yield ": keepalive\n\n"
                continue

            if message["type"] != "message":
                continue

            data_str = message["data"]
            try:
                status = json.loads(data_str)["status"]
            except (json.JSONDecodeError, KeyError, TypeError):
                _log.warning("Dropping malformed SSE event on %s: %r", channel, data_str)
                continue

            yield sse_event(data_str)

            if is_terminal(status):
                break
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
