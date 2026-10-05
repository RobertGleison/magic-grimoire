import pytest

from app.core import database
from app.core.database import DatabaseSessionManager
from app.services import card_cache
from tests.integration.conftest import TEST_DATABASE_URL


@pytest.fixture
async def cache_db(db_engine, monkeypatch):
    """Point card_cache at a session manager bound to this test's event loop."""
    manager = DatabaseSessionManager(TEST_DATABASE_URL)
    monkeypatch.setattr(database, "sessionmanager", manager)
    yield
    await manager.close()


async def test_set_then_get(cache_db):
    await card_cache.set("k", '{"a": 1}', ttl=60)
    assert await card_cache.get("k") == '{"a": 1}'


async def test_get_missing_returns_none(cache_db):
    assert await card_cache.get("nope") is None


async def test_expired_entry_is_a_miss(cache_db):
    await card_cache.set("k", "v", ttl=-1)
    assert await card_cache.get("k") is None


async def test_set_overwrites_and_refreshes_expiry(cache_db):
    await card_cache.set("k", "old", ttl=-1)
    await card_cache.set("k", "new", ttl=60)
    assert await card_cache.get("k") == "new"


async def test_database_errors_degrade_to_miss(monkeypatch):
    broken = DatabaseSessionManager("postgresql+asyncpg://nobody:nothing@127.0.0.1:1/none")
    monkeypatch.setattr(database, "sessionmanager", broken)
    await card_cache.set("k", "v")  # must not raise
    assert await card_cache.get("k") is None
    await broken.close()
