import json

import httpx
import pytest
import respx

from app.llm.base import LLMServiceError
from app.llm.openai_compat import OpenAICompatService

BASE = "https://llm.test"


def _service() -> OpenAICompatService:
    return OpenAICompatService(base_url=f"{BASE}/", api_key="sk-test", model="test-model")


def _reply(content: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": content}}]})


@respx.mock
def test_parse_intent_requests_json_object_and_parses():
    route = respx.post(f"{BASE}/chat/completions").mock(return_value=_reply('{"colors": ["G"]}'))

    assert _service().parse_intent("elf tribal") == {"colors": ["G"]}

    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer sk-test"
    body = json.loads(request.content)
    assert body["model"] == "test-model"
    assert body["response_format"] == {"type": "json_object"}
    assert body["max_tokens"] == 1024
    assert body["messages"][0]["role"] == "system"
    assert body["messages"][1]["role"] == "user"


@respx.mock
def test_chat_omits_response_format():
    route = respx.post(f"{BASE}/chat/completions").mock(return_value=_reply("Greetings."))

    assert _service().chat([{"role": "user", "content": "hi"}], system="be mystical") == "Greetings."

    body = json.loads(route.calls.last.request.content)
    assert "response_format" not in body
    assert body["messages"][0] == {"role": "system", "content": "be mystical"}


@respx.mock
def test_http_error_normalized_and_retried_once():
    route = respx.post(f"{BASE}/chat/completions").mock(return_value=httpx.Response(429))
    with pytest.raises(LLMServiceError, match="429"):
        _service().chat([{"role": "user", "content": "hi"}], system="s")
    assert route.call_count == 2


@respx.mock
def test_connect_error_normalized():
    respx.post(f"{BASE}/chat/completions").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(LLMServiceError, match="Cannot reach LLM provider"):
        _service().chat([{"role": "user", "content": "hi"}], system="s")


@respx.mock
def test_unexpected_shape_normalized():
    respx.post(f"{BASE}/chat/completions").mock(return_value=httpx.Response(200, json={"choices": []}))
    with pytest.raises(LLMServiceError, match="unexpected response"):
        _service().chat([{"role": "user", "content": "hi"}], system="s")
