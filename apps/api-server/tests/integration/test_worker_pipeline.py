import json
import uuid
from unittest.mock import MagicMock

import fakeredis.aioredis
import httpx
import pytest
import respx
from sqlalchemy import select

import app.decks.worker as worker
from app.core.enums import DeckStatus, TaskStatus
from app.decks.model import Deck
from app.decks.worker import _run_generate_deck
from app.services import scryfall_service
from app.services.scryfall_service import SCRYFALL_BASE
from app.tasks.model import Task

INTENT = {"colors": ["R"], "creature_types": [], "keywords": [], "themes": ["burn"], "strategy": "aggro"}
COMPOSITION = {
    "title": "Burn Baby Burn",
    "cards": [
        {"name": "Lightning Bolt", "quantity": 4, "section": "spells"},
        {"name": "Mountain", "quantity": 56, "section": "lands"},
    ],
}


@pytest.fixture(autouse=True)
def no_rate_limit_delay(monkeypatch):
    monkeypatch.setattr(scryfall_service, "REQUEST_DELAY", 0)


@pytest.fixture(autouse=True)
def worker_fake_redis(monkeypatch, fake_redis_server):
    def _fake_from_url(*args, **kwargs):
        return fakeredis.aioredis.FakeRedis(server=fake_redis_server, decode_responses=True)

    monkeypatch.setattr(worker.aioredis, "from_url", _fake_from_url)


@pytest.fixture
def llm(monkeypatch):
    mock = MagicMock()
    mock.parse_intent.return_value = INTENT
    mock.compose_deck.return_value = COMPOSITION
    monkeypatch.setattr(worker, "create_llm_service", lambda: mock)
    return mock


def _mock_scryfall():
    respx.get(f"{SCRYFALL_BASE}/cards/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {"id": "sc-1", "name": "Lightning Bolt", "mana_cost": "{R}", "type_line": "Instant",
                     "oracle_text": "", "colors": ["R"], "image_uris": {"normal": "https://img/bolt.jpg"}}
                ],
                "has_more": False,
            },
        )
    )
    respx.get(f"{SCRYFALL_BASE}/cards/named").mock(
        return_value=httpx.Response(
            200,
            json={"id": "sc-x", "name": "x", "mana_cost": "", "type_line": "Land",
                  "image_uris": {"normal": "https://img/x.jpg"}},
        )
    )


async def _seed(session_factory) -> tuple[str, str]:
    task_id = str(uuid.uuid4())
    async with session_factory() as db:
        deck = Deck(prompt="mono red burn", status=DeckStatus.PENDING)
        db.add(deck)
        await db.flush()
        db.add(Task(id=task_id, deck_id=deck.id, status=TaskStatus.QUEUED))
        await db.commit()
        return str(deck.id), task_id


@respx.mock
async def test_pipeline_success_completes_deck(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await _run_generate_deck(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern")

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()

    assert deck.status == DeckStatus.COMPLETED
    assert deck.title == "Burn Baby Burn"
    assert deck.card_count == 60
    assert deck.colors == ["R"]
    assert deck.completed_at is not None
    assert {c["name"] for c in deck.cards} == {"Lightning Bolt", "Mountain"}
    assert all(c["scryfall_id"] == "sc-x" for c in deck.cards)  # enrichment applied
    assert task.status == TaskStatus.COMPLETED


async def test_pipeline_off_topic_marks_failed(session_factory, llm, fake_redis):
    llm.parse_intent.return_value = {"error": "off_topic", "message": "Only Magic, friend."}
    deck_id, task_id = await _seed(session_factory)

    with pytest.raises(ValueError, match="Only Magic"):
        await _run_generate_deck(task_id=task_id, deck_id=deck_id, prompt="write me a poem", format="standard")

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()
        task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one()

    assert deck.status == DeckStatus.FAILED
    assert deck.error_message == "Only Magic, friend."
    assert deck.failed_at is not None
    assert task.status == TaskStatus.FAILED


@respx.mock
async def test_pipeline_llm_json_error_marks_failed(session_factory, llm, fake_redis):
    _mock_scryfall()
    llm.compose_deck.side_effect = json.JSONDecodeError("Expecting value", doc="", pos=0)
    deck_id, task_id = await _seed(session_factory)

    with pytest.raises(json.JSONDecodeError):
        await _run_generate_deck(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern")

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()
    assert deck.status == DeckStatus.FAILED
