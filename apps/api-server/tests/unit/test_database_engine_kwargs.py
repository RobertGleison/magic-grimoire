from sqlalchemy.pool import NullPool

from app.core import database
from app.core.config import settings


def test_pooled_by_default(monkeypatch):
    monkeypatch.setattr(settings, "DB_USE_NULL_POOL", False)
    kwargs = database.engine_kwargs()
    assert kwargs["pool_pre_ping"] is True
    assert "poolclass" not in kwargs


def test_null_pool_disables_asyncpg_statement_cache(monkeypatch):
    monkeypatch.setattr(settings, "DB_USE_NULL_POOL", True)
    kwargs = database.engine_kwargs()
    assert kwargs["poolclass"] is NullPool
    assert kwargs["connect_args"]["statement_cache_size"] == 0
    name_func = kwargs["connect_args"]["prepared_statement_name_func"]
    assert name_func() != name_func()  # unique per statement, never reused across backends
