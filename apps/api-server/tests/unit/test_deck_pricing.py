import uuid
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.decks.dtos import DeckCardEditDTO, DeckResponseDTO
from app.decks.pricing import deck_price


def _card(quantity: int, price_eur: str | None) -> dict:
    return {"name": "x", "quantity": quantity, "price_eur": price_eur, "section": "spells"}


# --- deck_price (pure) ---

def test_total_is_quantity_times_price_rounded_to_cents():
    price = deck_price([_card(4, "0.25"), _card(2, "1.105"), _card(1, "10")])
    assert price.total_eur == Decimal("13.21")
    assert price.unpriced_card_count == 0


def test_unpriced_copies_are_counted_and_left_out_of_the_total():
    price = deck_price([_card(4, "0.50"), _card(3, None), _card(1, None)])
    assert price.total_eur == Decimal("2.00")
    assert price.unpriced_card_count == 4


def test_cards_from_before_prices_existed_count_as_unpriced():
    price = deck_price([{"name": "Old", "quantity": 2, "section": "spells"}])
    assert price.total_eur is None
    assert price.unpriced_card_count == 2


@pytest.mark.parametrize("bad", ["", "abc", "NaN", "-1", "Infinity"])
def test_malformed_prices_count_as_unpriced(bad):
    price = deck_price([_card(1, bad), _card(1, "2.00")])
    assert price.total_eur == Decimal("2.00")
    assert price.unpriced_card_count == 1


@pytest.mark.parametrize("cards", [None, []])
def test_a_deck_without_cards_has_no_total(cards):
    price = deck_price(cards)
    assert price.total_eur is None
    assert price.unpriced_card_count == 0


# --- DeckResponseDTO ---

def _deck(cards):
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(), title="t", description=None, prompt="p", format="standard", colors=["R"],
        cards=cards, card_count=sum(c["quantity"] for c in cards or []), version_no=None,
        status="completed", error_message=None, created_at=now, completed_at=now, failed_at=None,
    )


def test_deck_response_serializes_the_total_from_its_current_cards():
    dto = DeckResponseDTO.model_validate(_deck([_card(4, "0.25"), _card(1, None)]))
    body = dto.model_dump(mode="json")
    assert body["total_price_eur"] == "1.00"
    assert body["unpriced_card_count"] == 1
    assert body["cards"][0]["price_eur"] == "0.25"


def test_deck_response_without_cards_has_a_null_total():
    body = DeckResponseDTO.model_validate(_deck(None)).model_dump(mode="json")
    assert body["total_price_eur"] is None
    assert body["unpriced_card_count"] == 0


# --- DeckCardEditDTO ---

def test_edited_cards_round_trip_their_price():
    card = DeckCardEditDTO(name="Shock", quantity=4, section="spells", price_eur="0.25")
    assert card.price_eur == "0.25"


@pytest.mark.parametrize("bad", ["abc", "-1", "1e9", "12345678.00", "0.123"])
def test_edited_cards_refuse_malformed_prices(bad):
    with pytest.raises(ValidationError):
        DeckCardEditDTO(name="Shock", quantity=4, section="spells", price_eur=bad)
