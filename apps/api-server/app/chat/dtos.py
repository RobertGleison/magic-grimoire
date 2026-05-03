from typing import Literal

from pydantic import BaseModel, Field

from app.core.enums import DeckFormat


class ChatMessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatContextDTO(BaseModel):
    format: DeckFormat | None = None
    colors: list[str] | None = None
    strategy: str | None = None


class ChatRequestDTO(BaseModel):
    messages: list[ChatMessageDTO] = Field(..., min_length=1, max_length=20)
    context: ChatContextDTO | None = None


class ChatResponseDTO(BaseModel):
    message: str
