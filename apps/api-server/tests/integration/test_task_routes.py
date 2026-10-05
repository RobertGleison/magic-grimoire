import uuid

from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.model import Deck
from app.tasks.model import Task


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
