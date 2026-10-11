from datetime import datetime, timedelta

from app.core.enums import TaskProgress, TaskStatus
from app.tasks.dtos import TaskStatusResponseDTO
from app.tasks.model import Task

STALE_MESSAGE = "Deck generation stopped responding. Please try again."
CANCELLED_MESSAGE = "Generation cancelled."

# A task in one of these states never changes again: the worker skips it and
# POST /tasks/{id}/cancel refuses it.
TERMINAL_TASK_STATUSES = frozenset({TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED})


def effective_task_status(task: Task, now: datetime, stale_after: int) -> TaskStatusResponseDTO:
    """What the poller should see: the row as stored, unless the worker has gone silent.

    A worker that died (timeouts and retries exhausted, crash before the failure was
    recorded) leaves the row unfinished forever, and the frontend would poll it forever.
    So an unfinished task that hasn't been touched in `stale_after` seconds reads as failed.
    Within an attempt the pipeline bumps updated_at at every stage and an attempt can't
    outlive the worker's 360s timeout; between Lambda's retry attempts the gap is at most
    about 360s + 120s. The 600s default therefore never fails a task that is still alive.
    """
    unfinished = task.status not in TERMINAL_TASK_STATUSES
    if unfinished and now - task.updated_at > timedelta(seconds=stale_after):
        return TaskStatusResponseDTO(
            id=task.id, status=TaskStatus.FAILED, progress=TaskProgress.FAILED, message=STALE_MESSAGE
        )
    return TaskStatusResponseDTO(id=task.id, status=task.status, progress=task.progress, message=task.message)
