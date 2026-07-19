import asyncio
import json

from app.services import redis_cache


async def test_set_then_get(fake_redis):
    await redis_cache.set("k", "v", ttl=60)
    assert await redis_cache.get("k") == "v"


async def test_get_missing_returns_none(fake_redis):
    assert await redis_cache.get("nope") is None


async def test_set_applies_ttl(fake_redis):
    await redis_cache.set("k", "v", ttl=60)
    async with fake_redis() as client:
        assert 0 < await client.ttl("k") <= 60


async def test_publish_reaches_subscriber(fake_redis):
    async with fake_redis() as subscriber:
        pubsub = subscriber.pubsub()
        await pubsub.subscribe("chan")
        await redis_cache.publish("chan", "hello")
        for _ in range(10):
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                break
            await asyncio.sleep(0.01)
        assert message is not None
        assert message["data"] == "hello"


async def test_publish_serializes_dict_payload(fake_redis):
    async with fake_redis() as subscriber:
        pubsub = subscriber.pubsub()
        await pubsub.subscribe("chan")
        await redis_cache.publish("chan", {"status": "processing", "message": "Working..."})
        for _ in range(10):
            message = await pubsub.get_message(ignore_subscribe_messages=True)
            if message:
                break
            await asyncio.sleep(0.01)
        assert message is not None
        assert json.loads(message["data"]) == {"status": "processing", "message": "Working..."}


def test_pool_reused_within_same_loop(monkeypatch):
    monkeypatch.setattr(redis_cache, "_pool", None)
    monkeypatch.setattr(redis_cache, "_pool_loop", None)

    async def _pools() -> tuple:
        return redis_cache._get_client().connection_pool, redis_cache._get_client().connection_pool

    first, second = asyncio.run(_pools())
    assert first is second


def test_pool_rebuilt_for_new_event_loop(monkeypatch):
    """Celery runs each task in a fresh asyncio.run() loop — the pool must not cross loops."""
    monkeypatch.setattr(redis_cache, "_pool", None)
    monkeypatch.setattr(redis_cache, "_pool_loop", None)

    async def _pool():
        return redis_cache._get_client().connection_pool

    assert asyncio.run(_pool()) is not asyncio.run(_pool())
