import asyncio

from app.core.enums import TaskStatus
from app.decks.pipeline import DeckGenerationPipeline
from app.workers.celery_app import celery_app


@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(self, deck_id: str, prompt: str, format: str) -> dict:
    task_id: str = self.request.id
    pipeline = DeckGenerationPipeline(task_id=task_id, deck_id=deck_id, prompt=prompt, format=format)
    asyncio.run(pipeline.run())
    return {"task_id": task_id, "deck_id": deck_id, "status": TaskStatus.COMPLETED}
