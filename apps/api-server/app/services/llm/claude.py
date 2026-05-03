import json

import anthropic

from app.services.llm.base import LLMService

_OFF_TOPIC_INSTRUCTION = (
    "If the message is not about Magic: The Gathering deck-building, cards, formats, or strategy, "
    "respond ONLY with this JSON and nothing else: "
    '{"error": "off_topic", "message": "I only discuss Magic: The Gathering. How can I help you build a deck?"}'
)

PARSE_INTENT_SYSTEM = (
    "You are a Magic: The Gathering deck-building assistant. "
    "Given a user's deck description, extract structured intent. "
    f"{_OFF_TOPIC_INSTRUCTION} "
    "Otherwise respond ONLY with valid JSON, no markdown fences."
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

CHAT_SYSTEM = (
    "You are the Grimoire, a Magic: The Gathering deck-building oracle. "
    "Help the user refine their deck idea through focused questions about strategy, "
    "format, colors, playstyle, and budget. Keep responses to 2–4 sentences. "
    "Speak with a slightly mystical tone. "
    f"{_OFF_TOPIC_INSTRUCTION} "
    "Otherwise respond in plain text — no JSON, no markdown."
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
