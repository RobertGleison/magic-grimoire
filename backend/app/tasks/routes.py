import asyncio
import json
from typing import Annotated, AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.tasks.model import Task

router = APIRouter()


async def _sse_event_generator(task_id: str) -> AsyncGenerator[str, None]:
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"task:{task_id}"

    try:
        await pubsub.subscribe(channel)

        while True:
            try:
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=30.0)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            if message is None:
                await asyncio.sleep(0.05)
                continue

            if message["type"] == "message":
                data_str = message["data"]
                yield f"data: {data_str}\n\n"

                try:
                    payload = json.loads(data_str)
                    if payload.get("status") in ("completed", "failed"):
                        break
                except (json.JSONDecodeError, AttributeError):
                    pass

    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis_client.aclose()


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

    return StreamingResponse(
        _sse_event_generator(task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
