from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.dispatch import cancel_generation
from app.decks.model import Deck
from app.tasks.dtos import TaskStatusResponseDTO
from app.tasks.model import Task
from app.tasks.status import CANCELLED_MESSAGE, TERMINAL_TASK_STATUSES, effective_task_status

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


@router.post("/tasks/{task_id}/cancel", response_model=TaskStatusResponseDTO)
async def cancel_task(
    task_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user)],
) -> TaskStatusResponseDTO:
    """Stop a queued or running generation. Owner only.

    Writes the terminal `cancelled` state on the task and its deck; that row is the
    cancel. The pipeline checks it at every stage boundary and exits without saving a
    deck, wherever it runs (worker Lambda or in-process). Locally the asyncio task is
    also cancelled so it stops sooner; an async-invoked Lambda can't be interrupted.
    """
    # Same lock the pipeline takes before each write, so a cancel can't slip in
    # between its status check and its "completed" write.
    task = (
        await db.execute(select(Task).where(Task.id == task_id).with_for_update())
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    deck = (await db.execute(select(Deck).where(Deck.id == task.deck_id))).scalar_one_or_none()
    # Generation requires an account, so every task has an owner. An ownerless deck
    # is a legacy anonymous one; nobody can prove they own it, so nobody cancels it.
    if deck is None or deck.user_id is None or deck.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    now = datetime.now(tz=UTC)
    # A stale task already reads as failed to the poller; cancelling it would only
    # rewrite history, so it is treated as finished too.
    effective = effective_task_status(task, now, settings.TASK_STALE_AFTER_SECONDS)
    if effective.status in TERMINAL_TASK_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This generation has already finished ({effective.status}); there is nothing to cancel.",
        )

    task.status = TaskStatus.CANCELLED
    task.progress = TaskProgress.CANCELLED
    task.message = CANCELLED_MESSAGE
    task.updated_at = now
    # Never left in `processing`, and never with cards: the pipeline saves only on
    # completion, which it can no longer reach.
    deck.status = DeckStatus.CANCELLED
    await db.commit()

    await cancel_generation(task_id)
    return TaskStatusResponseDTO(id=task.id, status=task.status, progress=task.progress, message=task.message)
