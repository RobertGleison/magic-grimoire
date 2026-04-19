import json

import httpx

from app.services.llm.base import LLMService

PARSE_INTENT_SYSTEM = (
    "You are a Magic: The Gathering deck-building assistant. "
    "Given a user's deck description, extract structured intent. "
    "Respond ONLY with valid JSON, no markdown fences."
)

PARSE_INTENT_TEMPLATE = (
    "Extract deck-building intent from this description:\n\n"
    '"{prompt}"\n\n'
    "Return JSON with keys: colors (list of single-letter color codes like W, U, B, R, G), "
    "creature_types (list), keywords (list), themes (list), format (string, default 'standard'), "
    "strategy (string, one sentence)."
)

COMPOSE_DECK_SYSTEM = (
    "You are a Magic: The Gathering deck-building assistant. "
    "Build a valid 60-card deck from the provided candidate cards. "
    "Respond ONLY with valid JSON, no markdown fences."
)

COMPOSE_DECK_TEMPLATE = (
    "Build a 60-card {format} deck.\n\n"
    "Intent: {intent}\n\n"
    "Candidate cards:\n{cards}\n\n"
    "Return JSON with keys: title (string), cards (list of objects with name, quantity, section). "
    "Sections: creatures, spells, lands. Total quantity must equal 60."
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
