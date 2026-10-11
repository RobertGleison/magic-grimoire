import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.enums import DeckStatus
from app.decks.model import Deck
from tests.conftest import TEST_USER_ID, make_token

AUTH = {"Authorization": f"Bearer {make_token()}"}

_CARDS = [
    {"name": "Lightning Bolt", "quantity": 4, "mana_cost": "{R}", "type_line": "Instant", "section": "spells"},
    {"name": "Mountain", "quantity": 20, "mana_cost": "", "type_line": "Basic Land — Mountain", "section": "lands"},
]


@pytest.fixture
def llm():
    mock = MagicMock()
    mock.chat_with_context = AsyncMock(return_value="You run 4 removal spells.")
    with patch("app.chat.service.create_llm_service", return_value=mock):
        yield mock


async def _insert_deck(session_factory, user_id=TEST_USER_ID, cards=_CARDS) -> Deck:
    async with session_factory() as db:
        deck = Deck(prompt="mono red burn", user_id=user_id, status=DeckStatus.COMPLETED, cards=cards, format="modern")
        db.add(deck)
        await db.commit()
        await db.refresh(deck)
        return deck


def _payload(deck_id) -> dict:
    return {"messages": [{"role": "user", "content": "which cards are removal?"}], "deck_id": str(deck_id)}


async def test_chat_reads_own_deck_into_the_prompt(client, session_factory, llm):
    deck = await _insert_deck(session_factory)

    res = await client.post("/api/v1/chat", json=_payload(deck.id), headers=AUTH)

    assert res.status_code == 200
    deck_context = llm.chat_with_context.call_args.kwargs["deck_context"]
    assert "- 4x Lightning Bolt | {R} | Instant" in deck_context
    assert "Format: modern" in deck_context


async def test_chat_sees_the_latest_saved_cards(client, session_factory, llm):
    deck = await _insert_deck(session_factory)
    async with session_factory() as db:
        row = await db.get(Deck, deck.id)
        row.cards = [*_CARDS, {"name": "Shock", "quantity": 2, "mana_cost": "{R}", "type_line": "Instant"}]
        await db.commit()

    await client.post("/api/v1/chat", json=_payload(deck.id), headers=AUTH)

    assert "- 2x Shock | {R} | Instant" in llm.chat_with_context.call_args.kwargs["deck_context"]


async def test_another_users_deck_is_not_found(client, session_factory, llm):
    deck = await _insert_deck(session_factory, user_id="99999999-aaaa-bbbb-cccc-000000000000")

    res = await client.post("/api/v1/chat", json=_payload(deck.id), headers=AUTH)

    assert res.status_code == 404
    llm.chat_with_context.assert_not_called()


async def test_unknown_deck_is_not_found(client, llm):
    res = await client.post("/api/v1/chat", json=_payload(uuid.uuid4()), headers=AUTH)

    assert res.status_code == 404
    llm.chat_with_context.assert_not_called()


async def test_deck_still_forging_chats_without_a_deck_block(client, session_factory, llm):
    deck = await _insert_deck(session_factory, cards=None)

    res = await client.post("/api/v1/chat", json=_payload(deck.id), headers=AUTH)

    assert res.status_code == 200
    assert llm.chat_with_context.call_args.kwargs["deck_context"] is None
