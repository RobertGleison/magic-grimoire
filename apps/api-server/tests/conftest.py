import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/magic_grimoire_test")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SUPABASE_URL", "https://supabase.test")
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("CLAUDE_MODEL", "claude-sonnet-4-20250514")
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")
os.environ.setdefault("OLLAMA_MODEL", "llama3.2:3b")

import json

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.services import card_cache

TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"

# Stands in for the Supabase project's ES256 signing key; its public half is
# served by the fake JWKS endpoint below.
TEST_SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())
TEST_KEY_ID = "test-key"
TEST_JWKS = {
    "keys": [
        {
            **json.loads(jwt.algorithms.ECAlgorithm.to_jwk(TEST_SIGNING_KEY.public_key())),
            "kid": TEST_KEY_ID,
            "alg": "ES256",
            "use": "sig",
        }
    ]
}


def make_token(user_id: str = TEST_USER_ID, **claims) -> str:
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated", **claims},
        TEST_SIGNING_KEY,
        algorithm="ES256",
        headers={"kid": TEST_KEY_ID},
    )


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch):
    """Serve TEST_JWKS instead of fetching {SUPABASE_URL}/auth/v1/.well-known/jwks.json."""
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda self: TEST_JWKS)


@pytest.fixture
def fake_card_cache(monkeypatch) -> dict[str, str]:
    """Replace the Postgres card cache with a dict; returns the dict for seeding/inspection."""
    store: dict[str, str] = {}

    async def _get(key: str) -> str | None:
        return store.get(key)

    async def _set(key: str, value: str, ttl: int = card_cache.CACHE_TTL) -> None:
        store[key] = value

    monkeypatch.setattr(card_cache, "get", _get)
    monkeypatch.setattr(card_cache, "set", _set)
    return store
