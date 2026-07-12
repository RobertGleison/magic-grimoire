import json

import anthropic

from app.services.llm.base import LLMService
from app.services.llm.prompts import (
    COMPOSE_DECK_SYSTEM,
    COMPOSE_DECK_TEMPLATE,
    PARSE_INTENT_SYSTEM,
    PARSE_INTENT_TEMPLATE,
)


class ClaudeService(LLMService):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def parse_intent(self, prompt: str) -> dict:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=PARSE_INTENT_SYSTEM,
            messages=[{"role": "user", "content": PARSE_INTENT_TEMPLATE.format(prompt=prompt)}],
        )
        return json.loads(message.content[0].text)

    def compose_deck(self, intent: dict, cards: list[dict], format: str) -> dict:
        cards_text = "\n".join(f"- {c.get('name', 'Unknown')}" for c in cards)
        message = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=COMPOSE_DECK_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": COMPOSE_DECK_TEMPLATE.format(
                        format=format, intent=json.dumps(intent), cards=cards_text
                    ),
                }
            ],
        )
        return json.loads(message.content[0].text)

    def chat(self, messages: list[dict], system: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=512,
            system=system,
            messages=messages,
        )
        return response.content[0].text
