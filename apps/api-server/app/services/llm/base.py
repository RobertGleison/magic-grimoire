import json
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import TypeVar

from app.services.llm.prompts import (
    CHAT_SYSTEM,
    COMPOSE_DECK_SYSTEM,
    COMPOSE_DECK_TEMPLATE,
    PARSE_INTENT_SYSTEM,
    PARSE_INTENT_TEMPLATE,
)

# One retry gives transient transport failures and one-off malformed completions a
# second chance without hiding a provider that is genuinely down.
_MAX_ATTEMPTS = 2

_T = TypeVar("_T")


class LLMServiceError(Exception):
    """Any LLM failure crossing the service seam — transport, provider, or unparseable output."""


class LLMService(ABC):
    """Deep interface for LLM providers.

    Owns prompt formatting, JSON parsing, error normalization, and retries.
    Adapters implement only ``_complete()`` — the raw provider request — and must
    raise :class:`LLMServiceError` for transport/provider failures.
    """

    @abstractmethod
    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        """Send one completion request to the provider and return the raw text reply."""
        ...

    def parse_intent(self, prompt: str) -> dict:
        """Parse a deck description into structured intent JSON."""
        return self._complete_json(
            PARSE_INTENT_SYSTEM,
            PARSE_INTENT_TEMPLATE.format(prompt=prompt),
            max_tokens=1024,
        )

    def compose_deck(self, intent: dict, cards: list[dict], format: str, deck_size: int) -> dict:
        """Compose a deck of the requested size from candidate cards and intent."""
        cards_text = "\n".join(f"- {c.get('name', 'Unknown')}" for c in cards)
        return self._complete_json(
            COMPOSE_DECK_SYSTEM.format(deck_size=deck_size),
            COMPOSE_DECK_TEMPLATE.format(
                format=format, intent=json.dumps(intent), cards=cards_text, deck_size=deck_size
            ),
            max_tokens=2048,
        )

    def chat(self, messages: list[dict], system: str) -> str:
        """Send a multi-turn conversation and return the assistant reply as plain text."""
        return self._with_retry(
            lambda: self._complete(system, messages, max_tokens=512, json_mode=False)
        )

    def chat_with_context(
        self,
        messages: list[dict],
        *,
        format: str | None = None,
        colors: list[str] | None = None,
        strategy: str | None = None,
    ) -> str:
        """Chat as the Grimoire, folding optional deck context into the system prompt.

        Unwraps the off-topic guard JSON (see prompts) to a plain string reply.
        """
        system = CHAT_SYSTEM
        parts: list[str] = []
        if format:
            parts.append(f"format: {format}")
        if colors:
            parts.append(f"colors: {', '.join(colors)}")
        if strategy:
            parts.append(f"strategy: {strategy}")
        if parts:
            system += f"\n\nCurrent deck context — {'; '.join(parts)}."

        reply = self.chat(messages, system)

        try:
            parsed = json.loads(reply)
        except json.JSONDecodeError:
            return reply
        if isinstance(parsed, dict) and parsed.get("error") == "off_topic":
            return parsed.get("message", "I only discuss Magic: The Gathering.")
        return reply

    def _complete_json(self, system: str, user_message: str, *, max_tokens: int) -> dict:
        def attempt() -> dict:
            raw = self._complete(
                system,
                [{"role": "user", "content": user_message}],
                max_tokens=max_tokens,
                json_mode=True,
            )
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                raise LLMServiceError(f"LLM returned invalid JSON: {raw[:200]!r}") from exc

        return self._with_retry(attempt)

    def _with_retry(self, attempt: Callable[[], _T]) -> _T:
        last_error: LLMServiceError | None = None
        for _ in range(_MAX_ATTEMPTS):
            try:
                return attempt()
            except LLMServiceError as exc:
                last_error = exc
        raise last_error
