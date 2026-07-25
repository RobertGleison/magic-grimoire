import contextlib
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Shared parent for every ORM model (Decks, Tasks...), so Base.metadata sees all tables at once."""
    pass


class DatabaseSessionManager:
    def __init__(self, host: str, engine_kwargs: dict[str, Any] | None = None):
        self._engine = create_async_engine(host, **(engine_kwargs or {}))
        self._sessionmaker = async_sessionmaker(
            # Pool every session pulls connections from.
            bind=self._engine,
            # Don't auto-flush pending adds/deletes before each query; routes flush explicitly
            # (e.g. decks/routes.py needs deck.id before it can create the linked Task).
            autoflush=False,
            # Keep ORM objects usable after commit without an extra round-trip to re-read them.
            expire_on_commit=False,
        )


    async def close(self) -> None:
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        await self._engine.dispose()
        self._engine = None
        self._sessionmaker = None


    # connect is to run raw SQL queries
    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        if self._engine is None:
            raise Exception("DatabaseSessionManager is not initialized")
        async with self._engine.begin() as connection:
            try:
                yield connection
            except Exception:
                await connection.rollback()
                raise


    # session is to run ORM queries
    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        if self._sessionmaker is None:
            raise Exception("DatabaseSessionManager is not initialized")
        session = self._sessionmaker()
        try:
            yield session
            # Auto-commit on success: some routes (e.g. delete_deck) mutate without
            # an explicit commit and rely on this to persist.
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# echo=True logs all SQL statements to stdout
# pool_pre_ping=True ensures the connection is alive before returning it to the pool with a lighweight check select 1
# pool_size=10 and max_overflow=20 ensures we have a pool of 10 connections and 20 idle connections
# max_overflow=20 ensures we don't create more than 20 idle connections at a time
sessionmanager = DatabaseSessionManager(
    settings.DATABASE_URL,
    {
        "echo": settings.ENVIRONMENT == "development",
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    },
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency; overridden in tests via app.dependency_overrides[get_db]."""
    async with sessionmanager.session() as session:
        yield session
