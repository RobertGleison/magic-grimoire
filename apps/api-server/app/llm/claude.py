import anthropic

from app.llm.base import LLMService, LLMServiceError


class ClaudeService(LLMService):
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic(api_key=api_key)
        # The chat path awaits this one so a stopped message can cancel the request.
        self.async_client = anthropic.AsyncAnthropic(api_key=api_key)
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

    async def _acomplete(self, system: str, messages: list[dict], *, max_tokens: int, json_mode: bool) -> str:
        # Cancelling this coroutine closes the HTTP request, which ends the generation on Anthropic's side.
        try:
            message = await self.async_client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
        except anthropic.AnthropicError as exc:
            raise LLMServiceError(f"Claude API error: {exc}") from exc
        return message.content[0].text
