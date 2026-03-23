from fastapi import APIRouter

from app.decks import routes as decks_routes
from app.health import routes as health_routes
from app.tasks import routes as tasks_routes

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_routes.router, tags=["health"])
api_router.include_router(decks_routes.router, tags=["decks"])
api_router.include_router(tasks_routes.router, tags=["tasks"])
