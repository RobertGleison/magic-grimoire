from sqlalchemy import text

from app.core.database import DatabaseSessionManager
from tests.integration.conftest import TEST_DATABASE_URL


async def test_dispose_drops_pooled_connections_but_keeps_manager_usable(db_engine):
    manager = DatabaseSessionManager(TEST_DATABASE_URL)
    try:
        async with manager.session() as db:
            await db.execute(text("SELECT 1"))
        assert manager._engine.pool.checkedin() == 1

        await manager.dispose()

        assert manager._engine.pool.checkedin() == 0
        async with manager.session() as db:
            assert (await db.execute(text("SELECT 1"))).scalar_one() == 1
    finally:
        await manager.close()
