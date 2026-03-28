from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.decks import model as deck_model  # noqa: F401 — required for Base.metadata to include tables
from app.router import api_router
from app.tasks import model as task_model  # noqa: F401 — required for Base.metadata to include tables

app = FastAPI(
    title="Magic Grimoire API",
    description="AI-powered Magic The Gathering deck generator",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
