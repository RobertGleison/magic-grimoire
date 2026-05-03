from abc import ABC, abstractmethod


class LLMService(ABC):
    @abstractmethod
    def parse_intent(self, prompt: str) -> dict:
        """Parse a deck description into structured intent JSON."""
        ...

    @abstractmethod
    def compose_deck(self, intent: dict, cards: list[dict], format: str) -> dict:
        """Compose a 60-card deck from candidate cards and intent."""
        ...

    @abstractmethod
    def chat(self, messages: list[dict], system: str) -> str:
        """Send a multi-turn conversation and return the assistant reply as plain text."""
        ...
