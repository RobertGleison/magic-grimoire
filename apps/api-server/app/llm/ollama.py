import httpx

from app.llm.base import LLMService, LLMServiceError

_TIMEOUT = 300.0


class OllamaService(LLMService):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2:3b"):
        self.base_url = base_url
        self.model = model

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat", json=self._payload(system, messages, json_mode), timeout=_TIMEOUT
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise self._normalize(exc) from exc
        return response.json()["message"]["content"]

    async def _acomplete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        # Cancelling this coroutine closes the connection, and Ollama aborts a
        # generation whose client has gone — so a stopped chat stops the model.
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat", json=self._payload(system, messages, json_mode)
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise self._normalize(exc) from exc
        return response.json()["message"]["content"]

    def _payload(self, system: str, messages: list[dict], json_mode: bool) -> dict:
        payload: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"
        return payload

    def _normalize(self, exc: httpx.HTTPError) -> LLMServiceError:
        if isinstance(exc, httpx.HTTPStatusError):
            if exc.response.status_code == 404:
                return LLMServiceError(f"Ollama model not found. Run: ollama pull {self.model}")
            return LLMServiceError(f"Ollama error: {exc.response.status_code}")
        if isinstance(exc, httpx.ConnectError):
            return LLMServiceError(f"Cannot connect to Ollama at {self.base_url}. Is it running?")
        return LLMServiceError(f"Ollama request failed: {exc}")
