from app.chat.dtos import ChatContextDTO, ChatMessageDTO
from app.core.guards import sanitize_prompt
from app.llm import create_llm_service
from app.llm.base import LLMServiceError


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

    # Awaited directly rather than on an executor thread: if the client stops the
    # message, the caller cancels this coroutine and the provider request with it.
    try:
        return await llm.chat_with_context(
            raw_messages,
            format=context.format if context else None,
            colors=context.colors if context else None,
            strategy=context.strategy if context else None,
        )
    except LLMServiceError as exc:
        raise ChatProviderUnavailable(str(exc)) from exc
