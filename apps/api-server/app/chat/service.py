import asyncio

from app.chat.dtos import ChatContextDTO, ChatMessageDTO
from app.core.guards import sanitize_prompt
from app.services.llm import create_llm_service
from app.services.llm.base import LLMServiceError


class ChatValidationError(Exception):
    """A user message failed prompt screening."""


class ChatProviderUnavailable(Exception):
    """The LLM provider could not produce a reply."""


async def chat_with_grimoire(messages: list[ChatMessageDTO], context: ChatContextDTO | None) -> str:
    """Screen the conversation, call the LLM with optional deck context, and return the reply.

    Raises ChatValidationError for rejected input and ChatProviderUnavailable when
    the provider fails — callers map these to transport-level errors.
    """
    for m in messages:
        if m.role == "user":
            valid, rejection = sanitize_prompt(m.content)
            if not valid:
                raise ChatValidationError(rejection)

    llm = create_llm_service()
    raw_messages = [{"role": m.role, "content": m.content} for m in messages]

    def _call() -> str:
        return llm.chat_with_context(
            raw_messages,
            format=context.format if context else None,
            colors=context.colors if context else None,
            strategy=context.strategy if context else None,
        )

    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(None, _call)
    except LLMServiceError as exc:
        raise ChatProviderUnavailable(str(exc)) from exc
