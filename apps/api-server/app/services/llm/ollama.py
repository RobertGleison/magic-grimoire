import httpx

from app.services.llm.base import LLMService, LLMServiceError


class OllamaService(LLMService):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2:3b"):
        self.base_url = base_url
        self.model = model

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        payload: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"

        try:
            response = httpx.post(f"{self.base_url}/api/chat", json=payload, timeout=300.0)
            response.raise_for_status()
        except httpx.ConnectError as exc:
            raise LLMServiceError(f"Cannot connect to Ollama at {self.base_url}. Is it running?") from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise LLMServiceError(f"Ollama model not found. Run: ollama pull {self.model}") from exc
            raise LLMServiceError(f"Ollama error: {exc.response.status_code}") from exc

        return response.json()["message"]["content"]
