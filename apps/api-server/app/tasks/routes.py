from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.tasks.dtos import TaskStatusResponseDTO
from app.tasks.model import Task
from app.tasks.status import effective_task_status

router = APIRouter()


# Deliberately unauthenticated: decks can be forged signed out, so there may be no
# user to check. The task ID is an unguessable UUIDv4 acting as a capability URL,
# and the response carries only progress strings — never deck contents.
@router.get("/tasks/{task_id}", response_model=TaskStatusResponseDTO)
async def get_task(
    task_id: str,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TaskStatusResponseDTO:
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Polled every couple of seconds; no cache between here and the browser may hold it.
    response.headers["Cache-Control"] = "no-store"
    # Read-only: a stale task is reported as failed, never written back.
    return effective_task_status(task, datetime.now(tz=UTC), settings.TASK_STALE_AFTER_SECONDS)
