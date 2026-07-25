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
    ANTHROPIC_API_KEY: str
    CLAUDE_MODEL: str

    # Ollama settings
    OLLAMA_BASE_URL: str
    OLLAMA_MODEL: str


class Settings(DatabaseSettings, AuthSettings, CORSSettings, AIModelsSettings):
    model_config = SettingsConfigDict(
        env_file=".env.dev" if os.getenv("ENVIRONMENT") == "development" else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str


settings = Settings()
