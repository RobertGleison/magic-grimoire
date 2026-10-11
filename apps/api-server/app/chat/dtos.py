import uuid
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.enums import DeckFormat
from app.core.guards import sanitize_prompt

_ManaColor = Literal["W", "U", "B", "R", "G"]

# A 100-card singleton deck tops out near this many distinct non-basic names.
_MAX_SELECTED_CARDS = 100
# The longest real card names (split/adventure faces joined by " // ") are ~70.
_MAX_CARD_NAME_CHARS = 150


class ChatMessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatContextDTO(BaseModel):
    format: DeckFormat | None = None
    colors: list[_ManaColor] | None = None
    strategy: str | None = Field(default=None, max_length=50)

    @field_validator("strategy")
    @classmethod
    def _screen_strategy(cls, value: str | None) -> str | None:
        """Strategy is free-form but reaches the prompt verbatim, so screen it."""
        if value is None:
            return None
        valid, rejection = sanitize_prompt(value)
        if not valid:
            raise ValueError(rejection)
        return value


class ChatRequestDTO(BaseModel):
    messages: list[ChatMessageDTO] = Field(..., min_length=1, max_length=20)
    context: ChatContextDTO | None = None
    # The deck on screen. Only the id travels: the server reads the cards from
    # the caller's own deck row, so the model never sees client-supplied card
    # data and a foreign id gets a 404 rather than someone else's list.
    deck_id: uuid.UUID | None = None
    # Card names picked in the grid view: the turn is about these cards only.
    # Matched against the deck's own list server-side, so this is a pointer into
    # `deck_id`'s cards, never free text that reaches the prompt as given.
    selected_cards: list[str] = Field(default_factory=list, max_length=_MAX_SELECTED_CARDS)

    @field_validator("selected_cards")
    @classmethod
    def _bound_names(cls, names: list[str]) -> list[str]:
        if any(not name.strip() or len(name) > _MAX_CARD_NAME_CHARS for name in names):
            raise ValueError(f"Card names must be 1-{_MAX_CARD_NAME_CHARS} characters")
        return names

    @model_validator(mode="after")
    def _selection_needs_deck(self) -> "ChatRequestDTO":
        if self.selected_cards and self.deck_id is None:
            raise ValueError("selected_cards requires deck_id")
        return self


class ChatResponseDTO(BaseModel):
    message: str
