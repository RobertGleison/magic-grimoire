import json
import uuid
from unittest.mock import MagicMock

import httpx
import pytest
import respx
from sqlalchemy import select

import app.decks.pipeline as pipeline_module
from app.core.enums import DeckStatus, TaskProgress, TaskStatus
from app.decks.model import Deck
from app.decks.pipeline import DeckGenerationPipeline
from app.services import scryfall_service
from app.services.scryfall_service import SCRYFALL_BASE
from app.tasks.model import Task
from app.tasks.streaming import task_channel

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


@pytest.fixture
def llm(monkeypatch):
    mock = MagicMock()
    mock.parse_intent.return_value = INTENT
    mock.compose_deck.return_value = COMPOSITION
    monkeypatch.setattr(pipeline_module, "create_llm_service", lambda: mock)
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


def _run(task_id: str, deck_id: str, prompt: str, format: str) -> DeckGenerationPipeline:
    return DeckGenerationPipeline(task_id=task_id, deck_id=deck_id, prompt=prompt, format=format)


@respx.mock
async def test_pipeline_success_completes_deck(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    # Subscribe before running so the progress events published over the shared
    # task channel are captured — pins the publisher/subscriber contract.
    async with fake_redis() as subscriber:
        pubsub = subscriber.pubsub()
        await pubsub.subscribe(task_channel(task_id))

        await _run(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern").run()

        events = []
        while (message := await pubsub.get_message(timeout=1)) is not None:
            if message["type"] == "message":
                events.append(json.loads(message["data"]))

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

    statuses = [e["status"] for e in events]
    assert statuses == [
        TaskProgress.PROCESSING,
        TaskProgress.SEARCHING_CARDS,
        TaskProgress.COMPOSING_DECK,
        TaskProgress.ENRICHING,
        TaskProgress.COMPLETED,
    ]


async def test_pipeline_off_topic_marks_failed(session_factory, llm, fake_redis):
    llm.parse_intent.return_value = {"error": "off_topic", "message": "Only Magic, friend."}
    deck_id, task_id = await _seed(session_factory)

    with pytest.raises(ValueError, match="Only Magic"):
        await _run(task_id=task_id, deck_id=deck_id, prompt="write me a poem", format="standard").run()

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
        await _run(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern").run()

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()
    assert deck.status == DeckStatus.FAILED


@respx.mock
async def test_pipeline_explicit_colors_override_parse_intent(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern", colors=["W", "U"],
    ).run()

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()

    assert deck.colors == ["W", "U"]


@respx.mock
async def test_pipeline_passes_deck_size_to_compose_deck(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern", deck_size=100,
    ).run()

    assert llm.compose_deck.call_args.args[-1] == 100


@respx.mock
async def test_pipeline_defaults_deck_size_to_60_when_omitted(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await _run(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern").run()

    assert llm.compose_deck.call_args.args[-1] == 60
