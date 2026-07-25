import asyncio
import json
import uuid

import app.tasks.streaming as tasks_streaming
from app.core.enums import DeckStatus, TaskStatus
from app.decks.model import Deck
from app.tasks.model import Task
from app.tasks.streaming import subscribe_to_task


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
        # no-transform stops proxies (Next.js rewrite) from gzip-buffering the
        # stream, which would hold events back from the browser indefinitely.
        assert "no-transform" in res.headers["cache-control"]
        body = ""
        async for chunk in res.aiter_text():
            body += chunk

    payload = json.loads(body.removeprefix("data: ").strip())
    assert payload["status"] == "completed"


async def test_generator_replays_events_until_terminal_status(fake_redis, fake_redis_server):
    async def _collect() -> list[str]:
        return [event async for event in subscribe_to_task("task-abc")]

    collector = asyncio.create_task(_collect())
    await asyncio.sleep(0.1)  # let the generator subscribe first

    publisher = fake_redis()
    await publisher.publish("task:task-abc", json.dumps({"status": "processing", "message": "Working..."}))
    await publisher.publish("task:task-abc", json.dumps({"status": "completed", "message": "Done!"}))
    await publisher.aclose()

    events = await asyncio.wait_for(collector, timeout=5)
    data_events = [e for e in events if not e.startswith(":")]
    assert len(data_events) == 2
    assert '"processing"' in data_events[0]
    assert '"completed"' in data_events[1]
    assert all(event.startswith("data: ") and event.endswith("\n\n") for event in data_events)


async def test_generator_emits_keepalive_during_silence(monkeypatch, fake_redis, fake_redis_server):
    """Long gaps between worker events (LLM calls take minutes) must produce
    keepalive comments, or proxies between the browser and the API silently
    drop the idle connection and the client never sees another event."""

    monkeypatch.setattr(tasks_streaming, "_KEEPALIVE_INTERVAL", 0.1)

    generator = subscribe_to_task("task-quiet")
    try:
        first_event = await asyncio.wait_for(anext(generator), timeout=2)
    finally:
        await generator.aclose()

    assert first_event == ": keepalive\n\n"
