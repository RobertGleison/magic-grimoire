import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.enums import DeckFormat, DeckStatus, MTGColor
from app.decks.pricing import deck_price
from app.decks.tags import normalize_tags


class CardInDeckDTO(BaseModel):
    name: str
    quantity: int
    scryfall_id: str | None = None
    image_uri: str | None = None
    # Scryfall's `art_crop`: the artwork alone, no frame or rules text. Used
    # as the deck's cover. Absent on decks enriched before it was stored.
    art_crop_uri: str | None = None
    mana_cost: str | None = None
    type_line: str | None = None
    section: str
    # Scryfall's euro price as a decimal string (MTG-26). None when Scryfall has no
    # euro price, or on cards enriched before prices were stored.
    price_eur: str | None = None


# Card art is always Scryfall's CDN; anything else in an edited list is refused
# rather than rendered as an <img> from an arbitrary host.
_SCRYFALL_IMAGE_PREFIX = "https://cards.scryfall.io/"


class DeckCardEditDTO(BaseModel):
    """One entry of a hand-edited deck list (PUT /decks/{id}/cards)."""

    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=1, le=250)
    # Free-form like CardInDeckDTO.section: the composer's own values round-trip.
    section: str = Field(..., min_length=1, max_length=50)
    scryfall_id: str | None = Field(default=None, max_length=64)
    image_uri: str | None = Field(default=None, max_length=500)
    mana_cost: str | None = Field(default=None, max_length=100)
    type_line: str | None = Field(default=None, max_length=200)
    # Same shape as Scryfall's prices.eur; it only ever feeds the owner's own deck total.
    price_eur: str | None = Field(default=None, pattern=r"^\d{1,7}(\.\d{1,2})?$")

    @field_validator("image_uri")
    @classmethod
    def _scryfall_art_only(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(_SCRYFALL_IMAGE_PREFIX):
            raise ValueError("image_uri must be a Scryfall card image")
        return value


class DeckCardsUpdateDTO(BaseModel):
    cards: list[DeckCardEditDTO] = Field(..., min_length=1, max_length=250)

    @field_validator("cards")
    @classmethod
    def _total_within_limit(cls, cards: list[DeckCardEditDTO]) -> list[DeckCardEditDTO]:
        if sum(card.quantity for card in cards) > 250:
            raise ValueError("A deck can hold at most 250 cards")
        return cards


class DeckGenerateRequestDTO(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    # Both required: the builder blocks Generate until a format and at least one
    # colour are picked, and this is the server-side half of that rule.
    format: DeckFormat
    colors: list[MTGColor] = Field(..., min_length=1)
    deck_size: int = Field(default=60, ge=60, le=250)


class DeckGenerateResponseDTO(BaseModel):
    task_id: str
    deck_id: uuid.UUID
    status: DeckStatus


class DeckResponseDTO(BaseModel):
    id: uuid.UUID
    title: str | None
    # Short deck idea (sanitized, capped at DESCRIPTION_MAX); None on older decks.
    description: str | None = None
    prompt: str
    format: str
    colors: list[str] | None
    cards: list[CardInDeckDTO] | None
    card_count: int
    # None on a working draft; 1-based within its lineage on a saved snapshot.
    version_no: int | None = None
    is_public: bool = True
    tags: list[str] = Field(default_factory=list)
    # Whether the caller owns this deck: drives the Edit and visibility
    # controls. Computed per request, never stored.
    is_owner: bool = False
    status: DeckStatus
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
    failed_at: datetime | None

    model_config = {"from_attributes": True}

    # Euro prices (MTG-26), derived from `cards` whenever the DTO is built — never
    # stored, so they always match the card list, including right after a hand
    # edit. Set at validation rather than serialization so a copy with a trimmed
    # card list (e.g. a feed entry showing only its cover card) keeps the totals
    # of the whole deck.
    total_price_eur: Decimal | None = None
    unpriced_card_count: int = 0

    @model_validator(mode="after")
    def _price_from_cards(self) -> "DeckResponseDTO":
        price = deck_price(card.model_dump(include={"quantity", "price_eur"}) for card in self.cards or [])
        self.total_price_eur = price.total_eur
        self.unpriced_card_count = price.unpriced_card_count
        return self


class DeckListResponseDTO(BaseModel):
    decks: list[DeckResponseDTO]
    total: int
    page: int
    pages: int


class DeckVisibilityRequestDTO(BaseModel):
    is_public: bool


class DeckTagsRequestDTO(BaseModel):
    # Bounded before normalisation too, so a huge payload is rejected cheaply.
    tags: list[str] = Field(..., max_length=50)

    @field_validator("tags")
    @classmethod
    def _normalise(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)


class ExploreDeckListResponseDTO(BaseModel):
    """One page of the community feed.

    Each deck's `cards` is trimmed to its cover card (the first with an image),
    so a page stays small; `card_count` still reports the real size. Fetch
    GET /decks/{id} for the full list.
    """

    decks: list[DeckResponseDTO]
    # Opaque; pass back as `cursor` for the next page. None on the last page.
    next_cursor: str | None
