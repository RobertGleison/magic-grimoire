from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.tasks.dtos import TaskStatusResponseDTO
from app.tasks.model import Task

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
    return TaskStatusResponseDTO(id=task.id, status=task.status, progress=task.progress, message=task.message)
