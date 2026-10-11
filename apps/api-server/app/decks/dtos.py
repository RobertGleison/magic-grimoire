import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.enums import DeckFormat, DeckStatus, MTGColor
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


class DeckGenerateRequestDTO(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    format: DeckFormat = DeckFormat.STANDARD
    colors: list[MTGColor] | None = None
    deck_size: int = Field(default=60, ge=60, le=250)


class DeckGenerateResponseDTO(BaseModel):
    task_id: str
    deck_id: uuid.UUID
    status: DeckStatus


class DeckResponseDTO(BaseModel):
    id: uuid.UUID
    title: str | None
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
