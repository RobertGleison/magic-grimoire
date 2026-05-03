from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from app.core.enums import DeckFormat

_ManaColor = Literal["W", "U", "B", "R", "G"]


class ChatStrategy(StrEnum):
    BALANCED   = "Balanced"
    AGGRESSIVE = "Aggressive"
    DEFENSIVE  = "Defensive"
    BUDGET     = "Budget"
    SPICY      = "Spicy"


class ChatMessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatContextDTO(BaseModel):
    format: DeckFormat | None = None
    colors: list[_ManaColor] | None = None
    strategy: ChatStrategy | None = None


class ChatRequestDTO(BaseModel):
    messages: list[ChatMessageDTO] = Field(..., min_length=1, max_length=20)
    context: ChatContextDTO | None = None


class ChatResponseDTO(BaseModel):
    message: str
