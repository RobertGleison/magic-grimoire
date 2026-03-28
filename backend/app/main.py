from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.decks import model as deck_model  # noqa: F401 — required for Base.metadata to include tables
from app.tasks import model as task_model  # noqa: F401 — required for Base.metadata to include tables
from app.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


app = FastAPI(
    title="Magic Grimoire API",
    description="AI-powered Magic The Gathering deck generator",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=Fal,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
