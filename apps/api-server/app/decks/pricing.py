"""Deck prices in euros, derived from the per-card `price_eur` Scryfall gives us.

Computed from the card list on demand, never stored, so a total always matches the
cards it is shown next to — including right after a hand edit (PUT /decks/{id}/cards).
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

_CENT = Decimal("0.01")


@dataclass(frozen=True)
class DeckPrice:
    # None when no card in the deck has a price (including an empty deck).
    total_eur: Decimal | None
    # Copies (quantity-weighted, like card_count) left out of the total for lack of a price.
    unpriced_card_count: int


def _parse_price(raw: Any) -> Decimal | None:
    """A card's euro price, or None when it is missing or not a sane amount."""
    if raw is None:
        return None
    try:
        price = Decimal(str(raw))
    except InvalidOperation:
        return None
    return price if price.is_finite() and price >= 0 else None


def deck_price(cards: Iterable[Mapping[str, Any]] | None) -> DeckPrice:
    """Sum quantity × price_eur over a deck's cards, as stored on `Deck.cards`."""
    total = Decimal(0)
    priced = False
    unpriced = 0
    for card in cards or []:
        quantity = int(card.get("quantity") or 0)
        price = _parse_price(card.get("price_eur"))
        if price is None:
            unpriced += quantity
            continue
        total += price * quantity
        priced = True
    return DeckPrice(
        total_eur=total.quantize(_CENT, rounding=ROUND_HALF_UP) if priced else None,
        unpriced_card_count=unpriced,
    )
