import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/magic_grimoire_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long!")

import fakeredis
import fakeredis.aioredis
import jwt
import pytest

from app.core.config import settings
from app.services import redis_cache

TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"


def make_token(user_id: str = TEST_USER_ID) -> str:
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated"},
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


@pytest.fixture
def fake_redis_server() -> fakeredis.FakeServer:
    return fakeredis.FakeServer()


@pytest.fixture
def fake_redis(monkeypatch, fake_redis_server):
    """Route app.services.redis_cache through an in-process fake Redis.

    Returns a factory producing clients bound to the same fake server, so
    tests can seed/inspect data alongside the code under test.
    """

    def _client() -> fakeredis.aioredis.FakeRedis:
        return fakeredis.aioredis.FakeRedis(server=fake_redis_server, decode_responses=True)

    monkeypatch.setattr(redis_cache, "_get_client", _client)
    return _client
