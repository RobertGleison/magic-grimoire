import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.model import Deck
from app.tasks.model import Task
from tests.conftest import TEST_USER_ID, make_token


async def _seed_task(session_factory, **task_fields) -> str:
    task_id = str(uuid.uuid4())
    async with session_factory() as db:
        deck = Deck(prompt="mono red burn", status=DeckStatus.PROCESSING)
        db.add(deck)
        await db.flush()
        db.add(Task(id=task_id, deck_id=deck.id, **task_fields))
        await db.commit()
    return task_id


async def test_get_task_returns_progress_and_is_uncacheable(client, session_factory):
    task_id = await _seed_task(
        session_factory,
        status=TaskStatus.PROCESSING,
        progress=TaskProgress.COMPOSING_DECK,
        message="Building your deck...",
    )

    res = await client.get(f"/api/v1/tasks/{task_id}")

    assert res.status_code == 200
    assert res.json() == {
        "id": task_id,
        "status": "processing",
        "progress": "composing_deck",
        "message": "Building your deck...",
    }
    assert res.headers["cache-control"] == "no-store"


async def test_get_queued_task_has_no_progress_yet(client, session_factory):
    task_id = await _seed_task(session_factory, status=TaskStatus.QUEUED)

    body = (await client.get(f"/api/v1/tasks/{task_id}")).json()

    assert body["status"] == "queued"
    assert body["progress"] is None
    assert body["message"] is None


async def test_get_missing_task_404(client, db_engine):
    assert (await client.get(f"/api/v1/tasks/{uuid.uuid4()}")).status_code == 404


async def test_get_stale_processing_task_reports_failed_without_writing(client, session_factory):
    # Inserting with an explicit updated_at sidesteps the column's onupdate.
    long_ago = datetime.now(tz=UTC) - timedelta(seconds=settings.TASK_STALE_AFTER_SECONDS + 60)
    task_id = await _seed_task(
        session_factory,
        status=TaskStatus.PROCESSING,
        progress=TaskProgress.COMPOSING_DECK,
        message="Building your deck...",
        updated_at=long_ago,
    )

    body = (await client.get(f"/api/v1/tasks/{task_id}")).json()

    assert body == {
        "id": task_id,
        "status": "failed",
        "progress": "failed",
        "message": "Deck generation stopped responding. Please try again.",
    }
    async with session_factory() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()
    assert task.status == TaskStatus.PROCESSING  # the route only reads
    assert task.updated_at == long_ago


async def test_get_fresh_processing_task_is_not_stale(client, session_factory):
    task_id = await _seed_task(
        session_factory,
        status=TaskStatus.PROCESSING,
        progress=TaskProgress.ENRICHING,
        message="Fetching card images...",
    )

    body = (await client.get(f"/api/v1/tasks/{task_id}")).json()

    assert body["status"] == "processing"
    assert body["progress"] == "enriching"


# --- POST /tasks/{id}/cancel ---

AUTH = {"Authorization": f"Bearer {make_token()}"}
OTHER_USER_AUTH = {"Authorization": f"Bearer {make_token('99999999-aaaa-bbbb-cccc-000000000000')}"}


@pytest.fixture
def runtime_cancel(monkeypatch):
    """Stand in for the dispatcher's best-effort runtime stop."""
    mock = AsyncMock(return_value=True)
    monkeypatch.setattr("app.tasks.routes.cancel_generation", mock)
    return mock


async def _seed_owned(session_factory, *, user_id=TEST_USER_ID, deck_status=DeckStatus.PROCESSING, **task_fields):
    task_id = str(uuid.uuid4())
    async with session_factory() as db:
        deck = Deck(prompt="mono red burn", status=deck_status, user_id=user_id)
        db.add(deck)
        await db.flush()
        db.add(Task(id=task_id, deck_id=deck.id, **task_fields))
        await db.commit()
        return task_id, deck.id


@pytest.mark.parametrize("task_status", [TaskStatus.QUEUED, TaskStatus.PROCESSING])
async def test_cancel_ends_an_unfinished_task_and_its_deck(client, session_factory, runtime_cancel, task_status):
    task_id, deck_id = await _seed_owned(session_factory, status=task_status, progress=TaskProgress.SEARCHING_CARDS)

    res = await client.post(f"/api/v1/tasks/{task_id}/cancel", headers=AUTH)

    assert res.status_code == 200
    assert res.json() == {
        "id": task_id,
        "status": "cancelled",
        "progress": "cancelled",
        "message": "Generation cancelled.",
    }
    async with session_factory() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()
        deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one()
    assert task.status == TaskStatus.CANCELLED
    assert deck.status == DeckStatus.CANCELLED  # never left in processing
    assert deck.cards is None
    runtime_cancel.assert_awaited_once_with(task_id)

    # And the poller sees it as terminal.
    polled = (await client.get(f"/api/v1/tasks/{task_id}")).json()
    assert polled["status"] == "cancelled"


async def test_cancel_requires_auth(client, session_factory, runtime_cancel):
    task_id, _ = await _seed_owned(session_factory, status=TaskStatus.PROCESSING)
    assert (await client.post(f"/api/v1/tasks/{task_id}/cancel")).status_code == 401
    runtime_cancel.assert_not_awaited()


async def test_cancel_by_someone_else_is_forbidden(client, session_factory, runtime_cancel):
    task_id, _ = await _seed_owned(session_factory, status=TaskStatus.PROCESSING)

    res = await client.post(f"/api/v1/tasks/{task_id}/cancel", headers=OTHER_USER_AUTH)

    assert res.status_code == 403
    async with session_factory() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()
    assert task.status == TaskStatus.PROCESSING
    runtime_cancel.assert_not_awaited()


async def test_cancel_of_an_ownerless_task_is_forbidden(client, session_factory, runtime_cancel):
    task_id, _ = await _seed_owned(session_factory, user_id=None, status=TaskStatus.PROCESSING)
    assert (await client.post(f"/api/v1/tasks/{task_id}/cancel", headers=AUTH)).status_code == 403


async def test_cancel_missing_task_404(client, db_engine, runtime_cancel):
    assert (await client.post(f"/api/v1/tasks/{uuid.uuid4()}/cancel", headers=AUTH)).status_code == 404


@pytest.mark.parametrize("finished", [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED])
async def test_cancel_of_a_finished_task_is_a_clear_conflict(client, session_factory, runtime_cancel, finished):
    task_id, _ = await _seed_owned(session_factory, status=finished)

    res = await client.post(f"/api/v1/tasks/{task_id}/cancel", headers=AUTH)

    assert res.status_code == 409
    assert "already finished" in res.json()["detail"]
    async with session_factory() as db:
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()
    assert task.status == finished
    runtime_cancel.assert_not_awaited()


async def test_cancel_of_a_stale_task_is_a_conflict(client, session_factory, runtime_cancel):
    long_ago = datetime.now(tz=UTC) - timedelta(seconds=settings.TASK_STALE_AFTER_SECONDS + 60)
    task_id, _ = await _seed_owned(session_factory, status=TaskStatus.PROCESSING, updated_at=long_ago)

    assert (await client.post(f"/api/v1/tasks/{task_id}/cancel", headers=AUTH)).status_code == 409
