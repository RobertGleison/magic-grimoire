import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.deck_context import format_deck_context
from app.chat.dtos import ChatContextDTO, ChatMessageDTO
from app.core.guards import sanitize_prompt
from app.decks.model import Deck
from app.llm import create_llm_service
from app.llm.base import LLMServiceError


class ChatValidationError(Exception):
    """A user message failed prompt screening."""


class ChatProviderUnavailable(Exception):
    """The LLM provider could not produce a reply."""


class ChatDeckNotFound(Exception):
    """The deck does not exist, or the caller may not read it."""


async def load_deck_context(db: AsyncSession, deck_id: uuid.UUID, user_id: str) -> str | None:
    """The "Current deck" prompt block for `deck_id`, read fresh from the caller's deck row.

    Read on every message, so edits saved to the deck since the last turn are in
    context. The access rule matches GET /decks/{id} — an owned deck only for its
    owner, a legacy anonymous one for whoever holds its id — but a foreign deck
    raises the same not-found as a missing one, so the id cannot be probed.

    Returns None while the deck has no cards yet (still being forged).
    """
    deck = (await db.execute(select(Deck).where(Deck.id == deck_id))).scalar_one_or_none()
    if deck is None or (deck.user_id is not None and deck.user_id != user_id):
        raise ChatDeckNotFound("Deck not found")
    return format_deck_context(deck)


async def chat_with_grimoire(
    messages: list[ChatMessageDTO],
    context: ChatContextDTO | None,
    deck_context: str | None = None,
) -> str:
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
            deck_context=deck_context,
        )
    except LLMServiceError as exc:
        raise ChatProviderUnavailable(str(exc)) from exc
