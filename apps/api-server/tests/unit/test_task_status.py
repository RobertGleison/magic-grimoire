from datetime import UTC, datetime, timedelta

import pytest

from app.core.enums import TaskProgress, TaskStatus
from app.tasks.model import Task
from app.tasks.status import STALE_MESSAGE, effective_task_status

NOW = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)
STALE_AFTER = 600


def _task(status: TaskStatus, age_seconds: int) -> Task:
    return Task(
        id="t-1",
        status=status,
        progress=TaskProgress.COMPOSING_DECK,
        message="Building your deck...",
        updated_at=NOW - timedelta(seconds=age_seconds),
    )


@pytest.mark.parametrize("status", [TaskStatus.QUEUED, TaskStatus.PROCESSING])
def test_unfinished_task_past_the_threshold_reads_as_failed(status):
    result = effective_task_status(_task(status, STALE_AFTER + 1), NOW, STALE_AFTER)

    assert result.id == "t-1"
    assert result.status == TaskStatus.FAILED
    assert result.progress == TaskProgress.FAILED
    assert result.message == STALE_MESSAGE


@pytest.mark.parametrize("status", [TaskStatus.QUEUED, TaskStatus.PROCESSING])
def test_unfinished_task_within_the_threshold_is_reported_as_is(status):
    result = effective_task_status(_task(status, STALE_AFTER - 1), NOW, STALE_AFTER)

    assert result.status == status
    assert result.progress == TaskProgress.COMPOSING_DECK
    assert result.message == "Building your deck..."


@pytest.mark.parametrize("status", [TaskStatus.COMPLETED, TaskStatus.FAILED])
def test_finished_task_is_never_stale(status):
    result = effective_task_status(_task(status, STALE_AFTER * 10), NOW, STALE_AFTER)

    assert result.status == status
    assert result.message == "Building your deck..."
