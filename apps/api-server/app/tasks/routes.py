import json
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.enums import TaskStatus
from app.tasks.model import Task
from app.tasks.streaming import sse_event, subscribe_to_task

router = APIRouter()

_SSE_HEADERS = {"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"}


async def _event_stream(task_id: str, already_done_status: TaskStatus | None) -> AsyncGenerator[str]:
    """One synthetic event if the task already finished; otherwise the live progress subscription."""
    if already_done_status is not None:
        yield sse_event(json.dumps({"status": already_done_status, "message": f"Task already {already_done_status}"}))
        return

    async for event in subscribe_to_task(task_id):
        yield event


# Deliberately unauthenticated: the frontend consumes this with native EventSource,
# which cannot send Authorization headers. The task ID is an unguessable UUIDv4 acting
# as a capability URL, and events carry only progress strings — never deck contents.
@router.get("/tasks/{task_id}/stream")
async def stream_task(
    task_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    already_done = task.status if task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED) else None

    return StreamingResponse(
        _event_stream(task_id, already_done),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
