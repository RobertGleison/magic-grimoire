import json
from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.enums import TaskStatus
from app.tasks.model import Task
from app.tasks.streaming import sse_event, task_channel

router = APIRouter()

# Worker events can be minutes apart (LLM calls); anything between the browser
# and this endpoint (Next.js rewrite proxy, load balancers) drops connections
# that stay silent longer than ~30-60s, so emit a keepalive comment in the gaps.
_KEEPALIVE_INTERVAL = 15.0


async def _sse_event_generator(task_id: str) -> AsyncGenerator[str]:
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = task_channel(task_id)

    try:
        await pubsub.subscribe(channel)

        while True:
            # get_message() only blocks when given a timeout — without one it
            # returns None immediately and no keepalive would ever be sent.
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=_KEEPALIVE_INTERVAL)
            if message is None:
                yield ": keepalive\n\n"
                continue

            if message["type"] == "message":
                data_str = message["data"]
                yield sse_event(data_str)

                try:
                    payload = json.loads(data_str)
                    if payload.get("status") in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                        break
                except (json.JSONDecodeError, AttributeError):
                    pass

    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis_client.aclose()


# Deliberately unauthenticated: the frontend consumes this with native EventSource,
# which cannot send Authorization headers. The task ID is an unguessable UUIDv4 acting
# as a capability URL, and events carry only progress strings — never deck contents.
@router.get("/tasks/{task_id}/stream")
async def stream_task(
    task_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
        async def _already_done() -> AsyncGenerator[str]:
            yield sse_event(json.dumps({"status": task.status, "message": "Task already " + task.status}))

        return StreamingResponse(
            _already_done(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    return StreamingResponse(
        _sse_event_generator(task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
