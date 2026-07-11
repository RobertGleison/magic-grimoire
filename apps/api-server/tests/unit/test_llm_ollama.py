import json

import httpx
import pytest
import respx

from app.services.llm.ollama import OllamaService

BASE = "http://fake-ollama:11434"


def _service() -> OllamaService:
    return OllamaService(base_url=BASE, model="test-model")


@respx.mock
def test_parse_intent_posts_json_format_and_parses():
    route = respx.post(f"{BASE}/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": '{"colors": ["G"]}'}})
    )
    assert _service().parse_intent("elf tribal") == {"colors": ["G"]}

    body = json.loads(route.calls.last.request.content)
    assert body["model"] == "test-model"
    assert body["format"] == "json"
    assert body["stream"] is False


@respx.mock
def test_compose_deck_sends_candidates_and_parses():
    route = respx.post(f"{BASE}/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": '{"title": "Elves", "cards": []}'}})
    )
    result = _service().compose_deck({"colors": ["G"]}, [{"name": "Llanowar Elves"}], "standard")

    assert result == {"title": "Elves", "cards": []}
    body = json.loads(route.calls.last.request.content)
    assert "- Llanowar Elves" in body["messages"][1]["content"]


@respx.mock
def test_chat_prepends_system_message():
    route = respx.post(f"{BASE}/api/chat").mock(
        return_value=httpx.Response(200, json={"message": {"content": "Greetings, planeswalker."}})
    )
    reply = _service().chat([{"role": "user", "content": "hi"}], system="be mystical")

    assert reply == "Greetings, planeswalker."
    body = json.loads(route.calls.last.request.content)
    assert body["messages"][0] == {"role": "system", "content": "be mystical"}


@respx.mock
def test_http_error_propagates():
    respx.post(f"{BASE}/api/chat").mock(return_value=httpx.Response(404))
    with pytest.raises(httpx.HTTPStatusError):
        _service().chat([{"role": "user", "content": "hi"}], system="s")
