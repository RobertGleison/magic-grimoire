import pytest

from app.core.config import settings
from app.llm import create_llm_service
from app.llm.claude import ClaudeService
from app.llm.ollama import OllamaService
from app.llm.prompts import CHAT_SYSTEM, PARSE_INTENT_SYSTEM


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


def test_factory_returns_openai_compat(monkeypatch):
    from app.llm.openai_compat import OpenAICompatService

    monkeypatch.setattr(settings, "LLM_PROVIDER", "openai_compat")
    monkeypatch.setattr(settings, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "https://llm.test")
    monkeypatch.setattr(settings, "LLM_MODEL", "test-model")
    monkeypatch.setattr(settings, "LLM_DISABLE_THINKING", True)
    service = create_llm_service()
    assert isinstance(service, OpenAICompatService)
    assert service.disable_thinking is True


@pytest.mark.parametrize("missing", ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"])
def test_factory_openai_compat_requires_settings(monkeypatch, missing):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "openai_compat")
    for name in ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"):
        monkeypatch.setattr(settings, name, None if name == missing else "x")
    with pytest.raises(ValueError, match=missing):
        create_llm_service()
