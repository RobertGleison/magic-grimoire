from app.core.config import settings
from app.llm.base import LLMService


def create_llm_service() -> LLMService:
    provider = settings.LLM_PROVIDER

    if provider == "claude":
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude")

        from app.llm.claude import ClaudeService

        return ClaudeService(
            api_key=settings.ANTHROPIC_API_KEY,
            model=settings.CLAUDE_MODEL,
        )

    if provider == "ollama":
        from app.llm.ollama import OllamaService

        return OllamaService(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
        )

    if provider == "openai_compat":
        for name in ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"):
            if not getattr(settings, name):
                raise ValueError(f"{name} is required when LLM_PROVIDER=openai_compat")

        from app.llm.openai_compat import OpenAICompatService

        return OpenAICompatService(
            base_url=settings.LLM_BASE_URL,
            api_key=settings.LLM_API_KEY,
            model=settings.LLM_MODEL,
        )

    raise ValueError(f"Unknown LLM provider: {provider}")
