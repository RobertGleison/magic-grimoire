from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str
    ENVIRONMENT: str

    SUPABASE_JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # Comma-separated list of origins allowed by CORS.
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    # LLM provider: "claude" or "ollama"
    LLM_PROVIDER: str = "ollama"

    # Claude settings
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"


settings = Settings()
