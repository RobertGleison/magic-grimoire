import asyncio

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
