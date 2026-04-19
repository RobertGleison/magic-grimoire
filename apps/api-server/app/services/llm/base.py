from abc import ABC, abstractmethod


class LLMService(ABC):
    @abstractmethod
    def parse_intent(self, prompt: str) -> dict:
        ...

    @abstractmethod
    def compose_deck(self, intent: dict, cards: list[dict], format: str) -> dict:
        ...
