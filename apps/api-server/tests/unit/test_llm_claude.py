from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services.llm.base import LLMServiceError
from app.services.llm.claude import ClaudeService


def _service_with_reply(reply: str) -> tuple[ClaudeService, MagicMock]:
    client = MagicMock()
    client.messages.create.return_value = SimpleNamespace(content=[SimpleNamespace(text=reply)])
    with patch("app.services.llm.claude.anthropic.Anthropic", return_value=client):
        service = ClaudeService(api_key="test-key", model="claude-test")
    return service, client


def test_parse_intent_returns_parsed_json():
    service, _ = _service_with_reply('{"colors": ["R"], "themes": ["burn"]}')
    assert service.parse_intent("red burn deck") == {"colors": ["R"], "themes": ["burn"]}


def test_parse_intent_raises_llm_error_on_invalid_json_after_retry():
    service, client = _service_with_reply("Sorry, I cannot do that.")
    with pytest.raises(LLMServiceError, match="invalid JSON"):
        service.parse_intent("red burn deck")
    assert client.messages.create.call_count == 2  # one retry before giving up


def test_compose_deck_lists_candidate_names_in_prompt():
    service, client = _service_with_reply('{"title": "Burn", "cards": []}')
    cards = [{"name": "Lightning Bolt"}, {"name": "Mountain"}, {}]
    result = service.compose_deck({"colors": ["R"]}, cards, "modern", 60)

    assert result == {"title": "Burn", "cards": []}
    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "- Lightning Bolt" in sent
    assert "- Mountain" in sent
    assert "- Unknown" in sent  # card without a name
    assert "modern" in sent


def test_chat_returns_plain_text_and_passes_system():
    service, client = _service_with_reply("Which colors call to you?")
    reply = service.chat([{"role": "user", "content": "hi"}], system="be mystical")

    assert reply == "Which colors call to you?"
    assert client.messages.create.call_args.kwargs["system"] == "be mystical"


def test_anthropic_error_normalized_to_llm_error():
    service, client = _service_with_reply("unused")
    import anthropic

    client.messages.create.side_effect = anthropic.AnthropicError("boom")
    with pytest.raises(LLMServiceError, match="Claude API error"):
        service.chat([{"role": "user", "content": "hi"}], system="s")


def test_compose_deck_uses_requested_deck_size():
    service, client = _service_with_reply('{"title": "Commander Deck", "cards": []}')
    service.compose_deck({"colors": ["R"]}, [{"name": "Sol Ring"}], "commander", 100)

    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    system = client.messages.create.call_args.kwargs["system"]
    assert "100-card" in sent
    assert "equal 100" in sent
    assert "100-card" in system
