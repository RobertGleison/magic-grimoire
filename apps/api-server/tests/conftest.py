import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-at-least-32-chars-long!")
