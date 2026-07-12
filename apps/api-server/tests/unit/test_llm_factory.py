import pytest

from app.core.config import settings
from app.services.llm import create_llm_service
from app.services.llm.claude import ClaudeService
from app.services.llm.ollama import OllamaService
from app.services.llm.prompts import CHAT_SYSTEM, PARSE_INTENT_SYSTEM


def test_factory_returns_claude(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "claude")
    assert isinstance(create_llm_service(), ClaudeService)


def test_factory_returns_ollama(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "ollama")
    assert isinstance(create_llm_service(), OllamaService)


def test_factory_rejects_unknown_provider(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "gpt")
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        create_llm_service()


def test_prompts_contain_off_topic_guard():
    assert "off_topic" in PARSE_INTENT_SYSTEM
    assert "off_topic" in CHAT_SYSTEM
