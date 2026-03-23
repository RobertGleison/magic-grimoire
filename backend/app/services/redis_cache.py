import redis.asyncio as aioredis

from app.core.config import settings

_redis_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def get(key: str) -> str | None:
    """Retrieve a cached value by key. Returns None on cache miss."""
    client = _get_client()
    value: str | None = await client.get(key)
    return value


async def set(key: str, value: str, ttl: int = 86400) -> None:
    """Store a value in Redis with the given TTL in seconds (default 24h)."""
    client = _get_client()
    await client.set(key, value, ex=ttl)


async def publish(channel: str, message: str) -> None:
    """Publish a message to a Redis pub/sub channel."""
    client = _get_client()
    await client.publish(channel, message)
