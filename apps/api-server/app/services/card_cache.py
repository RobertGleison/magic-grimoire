import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, Text, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, mapped_column

from app.core import database
from app.core.database import Base

_log = logging.getLogger(__name__)

# Single source for cache entry lifetime — 24 hours.
CACHE_TTL = 86400


class CardCacheEntry(Base):
    """Scryfall responses keyed like `scryfall:search:{query}` / `scryfall:card:{name}`."""

    __tablename__ = "card_cache"

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


async def get(key: str) -> str | None:
    """Return the cached value, or None on a miss, an expired entry, or a database error.

    A cache outage must never fail a deck generation, so errors degrade to a miss.
    `database.sessionmanager` is looked up per call so tests can rebind it. In the worker
    Lambda it outlives each invocation's event loop; worker_handler disposes its pooled
    connections after every run, so none leak into the next loop.
    """
    try:
        async with database.sessionmanager.session() as db:
            result = await db.execute(
                select(CardCacheEntry.value).where(
                    CardCacheEntry.key == key, CardCacheEntry.expires_at > datetime.now(tz=UTC)
                )
            )
            return result.scalar_one_or_none()
    except Exception:
        _log.warning("Card cache read failed for %s — treating as a miss", key, exc_info=True)
        return None


async def set(key: str, value: str, ttl: int = CACHE_TTL) -> None:
    """Upsert a value that expires `ttl` seconds from now. Errors are logged and swallowed."""
    expires_at = datetime.now(tz=UTC) + timedelta(seconds=ttl)
    statement = insert(CardCacheEntry).values(key=key, value=value, expires_at=expires_at)
    statement = statement.on_conflict_do_update(
        index_elements=[CardCacheEntry.key],
        set_={"value": statement.excluded.value, "expires_at": statement.excluded.expires_at},
    )
    try:
        async with database.sessionmanager.session() as db:
            await db.execute(statement)
    except Exception:
        _log.warning("Card cache write failed for %s", key, exc_info=True)
