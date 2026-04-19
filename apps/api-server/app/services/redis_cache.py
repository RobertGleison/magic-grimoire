import redis.asyncio as aioredis

from app.core.config import settings


def _get_client() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def get(key: str) -> str | None:
    """Retrieve a cached value by key. Returns None on cache miss."""
    async with _get_client() as client:
        value: str | None = await client.get(key)
        return value


async def set(key: str, value: str, ttl: int = 86400) -> None:
    """Store a value in Redis with the given TTL in seconds (default 24h)."""
    async with _get_client() as client:
        await client.set(key, value, ex=ttl)


async def publish(channel: str, message: str) -> None:
    """Publish a message to a Redis pub/sub channel."""
    async with _get_client() as client:
        await client.publish(channel, message)
