import logging

import httpx

from app.llm.base import LLMService, LLMServiceError

_log = logging.getLogger(__name__)


class OpenAICompatService(LLMService):
    """Any provider that speaks OpenAI's /chat/completions — DeepSeek in production."""

    def __init__(self, base_url: str, api_key: str, model: str, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        payload: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            # The body says why (e.g. DeepSeek's 402 "Insufficient Balance"); keep it out of
            # the raised message, which ends up on the task row the user sees.
            _log.warning("LLM provider returned %s: %s", exc.response.status_code, exc.response.text[:500])
            raise LLMServiceError(f"LLM provider error: {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise LLMServiceError(f"Cannot reach LLM provider at {self.base_url}: {exc}") from exc

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMServiceError("LLM provider returned an unexpected response shape") from exc
        # DeepSeek can return null content in JSON mode.
        if not isinstance(content, str):
            raise LLMServiceError("LLM provider returned no content")
        return content
