from app.core.config import settings
from app.services.llm.base import LLMService


def create_llm_service() -> LLMService:
    provider = settings.LLM_PROVIDER

    if provider == "claude":
        from app.services.llm.claude import ClaudeService

        return ClaudeService(
            api_key=settings.ANTHROPIC_API_KEY,
            model=settings.CLAUDE_MODEL,
        )

    if provider == "ollama":
        from app.services.llm.ollama import OllamaService

        return OllamaService(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
        )

    raise ValueError(f"Unknown LLM provider: {provider}")
