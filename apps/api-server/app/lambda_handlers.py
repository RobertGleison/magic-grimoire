"""Entry points for the two Lambdas (infra/terraform/lambda.tf, image_config.command)."""

import asyncio
import logging

from mangum import Mangum

from app.decks.pipeline import DeckGenerationPipeline
from app.main import app

_log = logging.getLogger(__name__)

# lifespan="off": Mangum would otherwise run startup/shutdown around every
# invocation, and shutdown disposes the database engine.
api_handler = Mangum(app, lifespan="off")


def worker_handler(event: dict, context: object) -> None:
    """Run one deck generation from an async-invoke event (a GenerationJob as a dict).

    Failures the pipeline catches are already recorded on the deck/task rows, so the
    handler returns normally: a Lambda retry would rerun the same prompt into the same
    error. Timeouts and crashes still escape, and get Lambda's retries and then the DLQ.
    """
    try:
        asyncio.run(DeckGenerationPipeline(**event).run())
    except Exception:
        _log.exception("Deck generation failed for task %s", event.get("task_id"))
