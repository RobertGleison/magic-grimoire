import json

from app.chat.dtos import ChatContextDTO
from app.services.llm import create_llm_service
from app.services.llm.claude import CHAT_SYSTEM


def chat_with_grimoire(messages: list[dict], context: ChatContextDTO | None) -> str:
    """Call the LLM with conversation history and optional deck context."""
    system = CHAT_SYSTEM

    if context:
        parts: list[str] = []
        if context.format:
            parts.append(f"format: {context.format}")
        if context.colors:
            parts.append(f"colors: {', '.join(context.colors)}")
        if context.strategy:
            parts.append(f"strategy: {context.strategy}")
        if parts:
            system += f"\n\nCurrent deck context — {'; '.join(parts)}."

    llm = create_llm_service()
    reply = llm.chat(
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        system=system,
    )

    # If the LLM fired the off-topic guard, unwrap the message to a clean string.
    try:
        parsed = json.loads(reply)
        if parsed.get("error") == "off_topic":
            return parsed.get("message", "I only discuss Magic: The Gathering.")
    except (json.JSONDecodeError, AttributeError):
        pass

    return reply
