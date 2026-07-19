"""Contract tests for the deep LLMService interface, run against a stub adapter.

Behavior pinned here (prompt building, JSON parsing, retries, off-topic unwrap)
applies to every provider — adapters only supply the transport call.
"""

import json

import pytest

from app.services.llm.base import LLMService, LLMServiceError
from app.services.llm.prompts import CHAT_SYSTEM


class StubService(LLMService):
    def __init__(self, replies: list[str | Exception]):
        self.replies = list(replies)
        self.calls: list[dict] = []

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        self.calls.append(
            {"system": system, "messages": messages, "max_tokens": max_tokens, "json_mode": json_mode}
        )
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def test_parse_intent_requests_json_mode_and_parses():
    service = StubService(['{"colors": ["W"]}'])
    assert service.parse_intent("angels") == {"colors": ["W"]}
    assert service.calls[0]["json_mode"] is True
    assert "angels" in service.calls[0]["messages"][0]["content"]


def test_transport_error_retried_once_then_raised():
    service = StubService([LLMServiceError("transient"), '{"colors": []}'])
    assert service.parse_intent("x") == {"colors": []}
    assert len(service.calls) == 2


def test_transport_error_exhausts_retries():
    service = StubService([LLMServiceError("down"), LLMServiceError("down")])
    with pytest.raises(LLMServiceError, match="down"):
        service.parse_intent("x")


def test_chat_with_context_appends_deck_context_to_system_prompt():
    service = StubService(["Noted."])
    service.chat_with_context(
        [{"role": "user", "content": "hi"}],
        format="modern",
        colors=["R", "G"],
        strategy="Aggressive",
    )
    system = service.calls[0]["system"]
    assert system.startswith(CHAT_SYSTEM)
    assert "format: modern" in system
    assert "colors: R, G" in system
    assert "strategy: Aggressive" in system


def test_chat_with_context_without_context_uses_base_prompt():
    service = StubService(["A fine quest."])
    assert service.chat_with_context([{"role": "user", "content": "hi"}]) == "A fine quest."
    assert service.calls[0]["system"] == CHAT_SYSTEM
    assert service.calls[0]["json_mode"] is False


def test_chat_with_context_unwraps_off_topic_json():
    service = StubService([json.dumps({"error": "off_topic", "message": "Only Magic, friend."})])
    reply = service.chat_with_context([{"role": "user", "content": "write a poem"}])
    assert reply == "Only Magic, friend."


def test_chat_with_context_passes_plain_reply_through():
    service = StubService(["Consider red for aggression."])
    reply = service.chat_with_context([{"role": "user", "content": "hi"}])
    assert reply == "Consider red for aggression."
