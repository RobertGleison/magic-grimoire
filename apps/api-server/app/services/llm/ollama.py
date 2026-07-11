import json

import httpx

from app.services.llm.base import LLMService
from app.services.llm.prompts import (
    COMPOSE_DECK_SYSTEM,
    COMPOSE_DECK_TEMPLATE,
    PARSE_INTENT_SYSTEM,
    PARSE_INTENT_TEMPLATE,
)


class OllamaService(LLMService):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2:3b"):
        self.base_url = base_url
        self.model = model

    def _chat(self, system: str, user_message: str) -> str:
        response = httpx.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_message},
                ],
                "stream": False,
                "format": "json",
            },
            timeout=300.0,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]

    def parse_intent(self, prompt: str) -> dict:
        raw = self._chat(PARSE_INTENT_SYSTEM, PARSE_INTENT_TEMPLATE.format(prompt=prompt))
        return json.loads(raw)

    def compose_deck(self, intent: dict, cards: list[dict], format: str) -> dict:
        cards_text = "\n".join(f"- {c.get('name', 'Unknown')}" for c in cards)
        raw = self._chat(
            COMPOSE_DECK_SYSTEM,
            COMPOSE_DECK_TEMPLATE.format(format=format, intent=json.dumps(intent), cards=cards_text),
        )
        return json.loads(raw)

    def chat(self, messages: list[dict], system: str) -> str:
        response = httpx.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": [{"role": "system", "content": system}, *messages],
                "stream": False,
            },
            timeout=300.0,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
