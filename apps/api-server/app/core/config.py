import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str


class AuthSettings(BaseSettings):
    SUPABASE_JWT_SECRET: str
    JWT_ALGORITHM: str


class CORSSettings(BaseSettings):
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


class AIModelsSettings(BaseSettings):
    LLM_PROVIDER: str

    # Claude settings
    ANTHROPIC_API_KEY: str | None = None
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"


class Settings(DatabaseSettings, AuthSettings, CORSSettings, AIModelsSettings):
    model_config = SettingsConfigDict(
        env_file=".env.dev" if os.getenv("ENVIRONMENT") == "development" else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str


settings = Settings()
