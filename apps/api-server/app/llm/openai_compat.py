import logging

import httpx

from app.llm.base import LLMService, LLMServiceError

_log = logging.getLogger(__name__)


class OpenAICompatService(LLMService):
    """Any provider that speaks OpenAI's /chat/completions — DeepSeek in production."""

    # 60s: parse_intent + compose_deck × 2 attempts each = 240s worst case, which leaves the
    # Scryfall steps room inside the worker Lambda's timeout. A slower provider then fails
    # as a recorded LLM error instead of a Lambda timeout that retries (and re-bills) the run.
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float = 60.0,
        disable_thinking: bool = False,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.disable_thinking = disable_thinking

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                json=self._payload(system, messages, max_tokens, json_mode),
                headers=self._headers(),
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise self._normalize(exc) from exc
        return self._content(response)

    async def _acomplete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        # Cancelling this coroutine closes the connection, which is how an
        # OpenAI-style provider learns to stop generating a chat reply.
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=self._payload(system, messages, max_tokens, json_mode),
                    headers=self._headers(),
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise self._normalize(exc) from exc
        return self._content(response)

    def _payload(self, system: str, messages: list[dict], max_tokens: int, json_mode: bool) -> dict:
        payload: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if self.disable_thinking:
            payload["thinking"] = {"type": "disabled"}
        return payload

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"}

    def _normalize(self, exc: httpx.HTTPError) -> LLMServiceError:
        if isinstance(exc, httpx.HTTPStatusError):
            # The body says why (e.g. DeepSeek's 402 "Insufficient Balance"); keep it out of
            # the raised message, which ends up on the task row the user sees.
            _log.warning("LLM provider returned %s: %s", exc.response.status_code, exc.response.text[:500])
            return LLMServiceError(f"LLM provider error: {exc.response.status_code}")
        return LLMServiceError(f"Cannot reach LLM provider at {self.base_url}: {exc}")

    @staticmethod
    def _content(response: httpx.Response) -> str:
        try:
            choice = response.json()["choices"][0]
            content = choice["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMServiceError("LLM provider returned an unexpected response shape") from exc
        # A reasoning model can spend the whole budget before writing any answer.
        if not content and choice.get("finish_reason") == "length":
            raise LLMServiceError("LLM ran out of tokens before answering")
        # DeepSeek can return null content in JSON mode.
        if not isinstance(content, str):
            raise LLMServiceError("LLM provider returned no content")
        return content
