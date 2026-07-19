import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from app.core.enums import DeckStatus, TaskStatus
from app.decks.model import Deck
from app.tasks.model import Task
from tests.conftest import TEST_USER_ID, make_token

AUTH = {"Authorization": f"Bearer {make_token()}"}
OTHER_USER_AUTH = {"Authorization": f"Bearer {make_token('99999999-aaaa-bbbb-cccc-000000000000')}"}


@pytest.fixture
def broker(monkeypatch):
    """Replace Celery enqueueing with a mock; returns it for assertions."""
    mock = MagicMock()
    monkeypatch.setattr("app.decks.routes.generate_deck_task.apply_async", mock)
    return mock


async def _insert_deck(session_factory, user_id=TEST_USER_ID, **overrides) -> Deck:
    async with session_factory() as db:
        deck = Deck(prompt="test deck", user_id=user_id, status=DeckStatus.COMPLETED, **overrides)
        db.add(deck)
        await db.commit()
        await db.refresh(deck)
        return deck


# --- POST /decks/generate ---

async def test_generate_persists_deck_and_task(client, session_factory, broker, fake_redis):
    res = await client.post(
        "/api/v1/decks/generate",
        json={"prompt": "mono red burn", "format": "modern"},
        headers=AUTH,
    )
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "pending"

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(body["deck_id"])))).scalar_one()
        task = (await db.execute(select(Task).where(Task.id == body["task_id"]))).scalar_one()

    assert deck.prompt == "mono red burn"
    assert deck.format == "modern"
    assert deck.user_id == TEST_USER_ID
    assert deck.status == DeckStatus.PENDING
    assert task.status == TaskStatus.QUEUED
    assert task.deck_id == deck.id

    broker.assert_called_once()
    assert broker.call_args.kwargs["task_id"] == body["task_id"]


async def test_generate_broker_down_returns_503_and_marks_failed(client, session_factory, broker, fake_redis):
    broker.side_effect = ConnectionError("redis down")

    res = await client.post("/api/v1/decks/generate", json={"prompt": "elf tribal"}, headers=AUTH)
    assert res.status_code == 503

    async with session_factory() as db:
        deck = (await db.execute(select(Deck))).scalars().one()
        task = (await db.execute(select(Task))).scalars().one()
    assert deck.status == DeckStatus.FAILED
    assert deck.error_message == "Failed to enqueue deck generation."
    assert task.status == TaskStatus.FAILED


# --- GET /decks ---

async def test_list_requires_auth(client):
    assert (await client.get("/api/v1/decks")).status_code == 401


async def test_list_paginates_own_decks_only(client, session_factory):
    for _ in range(3):
        await _insert_deck(session_factory)
    await _insert_deck(session_factory, user_id="someone-else")

    res = await client.get("/api/v1/decks?page=1&limit=2", headers=AUTH)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    assert body["pages"] == 2
    assert len(body["decks"]) == 2


# --- GET /decks/{id} ---

async def test_get_deck_404(client, db_engine):
    res = await client.get(f"/api/v1/decks/{uuid.uuid4()}")
    assert res.status_code == 404


async def test_get_foreign_deck_403(client, session_factory):
    deck = await _insert_deck(session_factory)
    res = await client.get(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)
    assert res.status_code == 403


async def test_get_guest_deck_is_public(client, session_factory):
    deck = await _insert_deck(session_factory, user_id=None)
    res = await client.get(f"/api/v1/decks/{deck.id}")
    assert res.status_code == 200
    assert res.json()["prompt"] == "test deck"


# --- DELETE /decks/{id} ---

async def test_delete_removes_deck_row(client, session_factory):
    """Regression: db.delete() was un-awaited, so 204 was returned but the row survived."""
    deck = await _insert_deck(session_factory)

    res = await client.delete(f"/api/v1/decks/{deck.id}", headers=AUTH)
    assert res.status_code == 204

    async with session_factory() as db:
        remaining = (await db.execute(select(Deck).where(Deck.id == deck.id))).scalar_one_or_none()
    assert remaining is None


async def test_delete_requires_auth(client, session_factory):
    deck = await _insert_deck(session_factory)
    assert (await client.delete(f"/api/v1/decks/{deck.id}")).status_code == 401


async def test_delete_foreign_deck_403(client, session_factory):
    deck = await _insert_deck(session_factory)
    assert (await client.delete(f"/api/v1/decks/{deck.id}", headers=OTHER_USER_AUTH)).status_code == 403


async def test_delete_missing_deck_404(client, db_engine):
    assert (await client.delete(f"/api/v1/decks/{uuid.uuid4()}", headers=AUTH)).status_code == 404


async def test_generate_forwards_colors_to_broker(client, session_factory, broker, fake_redis):
    res = await client.post(
        "/api/v1/decks/generate",
        json={"prompt": "azorius control", "format": "modern", "colors": ["W", "U"]},
        headers=AUTH,
    )
    assert res.status_code == 202
    body = res.json()

    broker.assert_called_once()
    assert broker.call_args.kwargs["args"] == [body["deck_id"], "azorius control", "modern", ["W", "U"]]
