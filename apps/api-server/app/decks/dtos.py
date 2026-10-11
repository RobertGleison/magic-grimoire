import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.enums import DeckFormat, DeckStatus, MTGColor


class CardInDeckDTO(BaseModel):
    name: str
    quantity: int
    scryfall_id: str | None = None
    image_uri: str | None = None
    mana_cost: str | None = None
    type_line: str | None = None
    section: str


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
    status: DeckStatus
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None
    failed_at: datetime | None

    model_config = {"from_attributes": True}


class DeckListResponseDTO(BaseModel):
    decks: list[DeckResponseDTO]
    total: int
    page: int
    pages: int
