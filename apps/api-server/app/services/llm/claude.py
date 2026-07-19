import anthropic

from app.services.llm.base import LLMService, LLMServiceError


class ClaudeService(LLMService):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def _complete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        # No JSON output mode on the Messages API — the system prompts already demand bare JSON.
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
        except anthropic.AnthropicError as exc:
            raise LLMServiceError(f"Claude API error: {exc}") from exc
        return message.content[0].text
