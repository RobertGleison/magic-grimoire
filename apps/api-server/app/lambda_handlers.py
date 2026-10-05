"""Entry points for the two Lambdas (infra/terraform/lambda.tf, image_config.command)."""

import asyncio
import logging

from mangum import Mangum

from app.core import database
from app.decks.pipeline import DeckGenerationPipeline, FailureNotRecorded
from app.main import app

# The Lambda Python runtime's root logger is at WARNING, which drops the pipeline's info logs.
logging.getLogger().setLevel(logging.INFO)
_log = logging.getLogger(__name__)

# lifespan="off": Mangum would otherwise run startup/shutdown around every
# invocation, and shutdown disposes the database engine.
api_handler = Mangum(app, lifespan="off")


async def _generate(event: dict) -> None:
    try:
        await DeckGenerationPipeline(**event).run()
    finally:
        # card_cache uses the module-level manager; its pooled connections are bound to
        # this invocation's event loop, which asyncio.run closes. Drop them here so a warm
        # container's next invocation never inherits them.
        await database.sessionmanager.dispose()


def worker_handler(event: dict, context: object) -> None:
    """Run one deck generation from an async-invoke event (a GenerationJob as a dict).

    Failures the pipeline recorded on the deck/task rows are swallowed: a Lambda retry
    would rerun the same prompt into the same error. Failures it couldn't record,
    timeouts and crashes escape, and get Lambda's retries and then the DLQ.
    """
    try:
        asyncio.run(_generate(event))
    except FailureNotRecorded:
        raise
    except Exception:
        _log.exception("Deck generation failed for task %s", event.get("task_id"))
