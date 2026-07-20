import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import DeckFormat, DeckStatus, MTGColor


class CardInDeckDTO(BaseModel):
    name: str
    quantity: int
    scryfall_id: str | None = None
    image_uri: str | None = None
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
