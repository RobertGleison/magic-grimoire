import asyncio

import redis.asyncio as aioredis

from app.core.config import settings

# One pool per event loop: FastAPI reuses its single long-lived loop, while the
# Celery worker gets a fresh asyncio.run() loop per task — pooled connections
# must never cross loops, so a new loop gets a new pool.
_pool: aioredis.ConnectionPool | None = None
_pool_loop: asyncio.AbstractEventLoop | None = None


def _get_client() -> aioredis.Redis:
    """Return a client backed by a connection pool shared within the current event loop."""
    global _pool, _pool_loop
    loop = asyncio.get_running_loop()
    if _pool is None or _pool_loop is not loop:
        _pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
        _pool_loop = loop
    return aioredis.Redis(connection_pool=_pool)


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
