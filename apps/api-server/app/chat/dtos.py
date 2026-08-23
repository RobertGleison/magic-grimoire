from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.enums import DeckFormat
from app.core.guards import sanitize_prompt

_ManaColor = Literal["W", "U", "B", "R", "G"]


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


class ChatResponseDTO(BaseModel):
    message: str
