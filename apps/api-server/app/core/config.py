import os
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


def load_ssm_parameters(path: str | None, client: Any = None) -> None:
    """Copy every SSM parameter under `path` into os.environ before Settings() reads it.

    The Lambdas get their secrets this way at cold start (see infra/terraform/ssm.tf):
    each parameter's last path segment is the settings field it fills. Environment
    variables already set (non-empty) win, so a local override is never clobbered; values
    from .env files don't count, since Settings() only reads those afterwards.
    """
    if not path:
        return
    if client is None:
        import boto3  # only the Lambdas need it; keeps local startup lean

        client = boto3.client("ssm")
    paginator = client.get_paginator("get_parameters_by_path")
    for page in paginator.paginate(Path=path, WithDecryption=True, Recursive=False):
        for parameter in page["Parameters"]:
            name = parameter["Name"].rsplit("/", 1)[-1]
            # An empty variable (e.g. a blank placeholder in the Lambda config) counts as unset.
            if not os.environ.get(name):
                os.environ[name] = parameter["Value"]


class DatabaseSettings(BaseSettings):
    DATABASE_URL: str
    # Supabase's transaction pooler can't hold pooled connections or prepared statements.
    DB_USE_NULL_POOL: bool = False


class AuthSettings(BaseSettings):
    SUPABASE_JWT_SECRET: str
    JWT_ALGORITHM: str


class CORSSettings(BaseSettings):
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


class DispatchSettings(BaseSettings):
    # "inprocess" runs generation in the API's event loop (local dev);
    # "lambda" async-invokes WORKER_FUNCTION_NAME (production).
    TASK_DISPATCHER: str = "inprocess"
    WORKER_FUNCTION_NAME: str | None = None
    # GET /tasks/{id} reports an unfinished task untouched for this long as failed
    # (reasoning in app/tasks/status.py).
    TASK_STALE_AFTER_SECONDS: int = 600


class AIModelsSettings(BaseSettings):
    LLM_PROVIDER: str

    # Claude settings
    ANTHROPIC_API_KEY: str | None = None
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Ollama settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"

    # OpenAI-compatible provider settings (DeepSeek in production)
    LLM_API_KEY: str | None = None
    LLM_BASE_URL: str | None = None
    LLM_MODEL: str | None = None
    # DeepSeek's models reason before answering, and those hidden tokens count against
    # max_tokens: compose_deck spent its whole 2048 on reasoning and returned "". Off, a
    # deck comes back in ~2s instead of ~25s (or nothing). Only send it to providers
    # that accept DeepSeek's `thinking` parameter.
    LLM_DISABLE_THINKING: bool = False


class Settings(DatabaseSettings, AuthSettings, CORSSettings, DispatchSettings, AIModelsSettings):
    model_config = SettingsConfigDict(
        env_file=".env.dev" if os.getenv("ENVIRONMENT") == "development" else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str


load_ssm_parameters(os.getenv("SSM_PARAMETER_PATH"))
settings = Settings()
