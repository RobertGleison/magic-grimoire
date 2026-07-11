import asyncio
import json
import uuid

import fakeredis.aioredis

import app.tasks.routes as tasks_routes
from app.core.enums import DeckStatus, TaskStatus
from app.decks.model import Deck
from app.tasks.model import Task
from app.tasks.routes import _sse_event_generator


async def _insert_task(session_factory, status: TaskStatus) -> str:
    task_id = str(uuid.uuid4())
    async with session_factory() as db:
        deck = Deck(prompt="p", status=DeckStatus.PROCESSING)
        db.add(deck)
        await db.flush()
        db.add(Task(id=task_id, deck_id=deck.id, status=status))
        await db.commit()
    return task_id


async def test_stream_unknown_task_404(client, db_engine):
    res = await client.get(f"/api/v1/tasks/{uuid.uuid4()}/stream")
    assert res.status_code == 404


async def test_stream_finished_task_short_circuits(client, session_factory):
    task_id = await _insert_task(session_factory, TaskStatus.COMPLETED)

    async with client.stream("GET", f"/api/v1/tasks/{task_id}/stream") as res:
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/event-stream")
        body = ""
        async for chunk in res.aiter_text():
            body += chunk

    payload = json.loads(body.removeprefix("data: ").strip())
    assert payload["status"] == "completed"


async def test_generator_replays_events_until_terminal_status(monkeypatch, fake_redis_server):
    def _fake_from_url(*args, **kwargs):
        return fakeredis.aioredis.FakeRedis(server=fake_redis_server, decode_responses=True)

    monkeypatch.setattr(tasks_routes.aioredis, "from_url", _fake_from_url)

    async def _collect() -> list[str]:
        return [event async for event in _sse_event_generator("task-abc")]

    collector = asyncio.create_task(_collect())
    await asyncio.sleep(0.1)  # let the generator subscribe first

    publisher = _fake_from_url()
    await publisher.publish("task:task-abc", json.dumps({"status": "processing", "message": "Working..."}))
    await publisher.publish("task:task-abc", json.dumps({"status": "completed", "message": "Done!"}))
    await publisher.aclose()

    events = await asyncio.wait_for(collector, timeout=5)
    assert len(events) == 2
    assert '"processing"' in events[0]
    assert '"completed"' in events[1]
    assert all(event.startswith("data: ") and event.endswith("\n\n") for event in events)
