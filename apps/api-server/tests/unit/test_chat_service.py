import json
from unittest.mock import MagicMock, patch

from app.chat.dtos import ChatContextDTO, ChatStrategy
from app.chat.service import chat_with_grimoire
from app.core.enums import DeckFormat
from app.services.llm.prompts import CHAT_SYSTEM

_MESSAGES = [{"role": "user", "content": "help me build a deck"}]


def _mock_llm(reply: str) -> MagicMock:
    llm = MagicMock()
    llm.chat.return_value = reply
    return llm


async def test_no_context_uses_base_system_prompt():
    llm = _mock_llm("A fine quest.")
    with patch("app.chat.service.create_llm_service", return_value=llm):
        reply = await chat_with_grimoire(_MESSAGES, context=None)

    assert reply == "A fine quest."
    _, system = llm.chat.call_args.args
    assert system == CHAT_SYSTEM


async def test_context_appended_to_system_prompt():
    llm = _mock_llm("Noted.")
    context = ChatContextDTO(format=DeckFormat.MODERN, colors=["R", "G"], strategy=ChatStrategy.AGGRESSIVE)
    with patch("app.chat.service.create_llm_service", return_value=llm):
        await chat_with_grimoire(_MESSAGES, context=context)

    _, system = llm.chat.call_args.args
    assert "format: modern" in system
    assert "colors: R, G" in system
    assert "strategy: Aggressive" in system


async def test_off_topic_json_reply_is_unwrapped():
    llm = _mock_llm(json.dumps({"error": "off_topic", "message": "Only Magic, friend."}))
    with patch("app.chat.service.create_llm_service", return_value=llm):
        reply = await chat_with_grimoire(_MESSAGES, context=None)

    assert reply == "Only Magic, friend."


async def test_plain_reply_passes_through_unchanged():
    llm = _mock_llm("Consider red for aggression.")
    with patch("app.chat.service.create_llm_service", return_value=llm):
        assert await chat_with_grimoire(_MESSAGES, context=None) == "Consider red for aggression."
