import pytest
from mangum import Mangum

import app.lambda_handlers as handlers
from app.core import database
from app.decks.pipeline import FailureNotRecorded

EVENT = {"task_id": "t-1", "deck_id": "d-1", "prompt": "elves", "format": "modern", "colors": None, "deck_size": 60}


class _FakePipeline:
    seen: list[dict] = []
    error: Exception | None = None

    def __init__(self, **kwargs):
        type(self).seen.append(kwargs)

    async def run(self):
        if type(self).error is not None:
            raise type(self).error


class _FakeSessionManager:
    def __init__(self):
        self.disposed = 0

    async def dispose(self):
        self.disposed += 1


@pytest.fixture(autouse=True)
def fake_pipeline(monkeypatch):
    _FakePipeline.seen, _FakePipeline.error = [], None
    monkeypatch.setattr(handlers, "DeckGenerationPipeline", _FakePipeline)
    return _FakePipeline


@pytest.fixture(autouse=True)
def sessionmanager(monkeypatch):
    fake = _FakeSessionManager()
    monkeypatch.setattr(database, "sessionmanager", fake)
    return fake


def test_api_handler_is_mangum_adapter():
    assert isinstance(handlers.api_handler, Mangum)


def test_worker_handler_runs_pipeline_from_event(fake_pipeline):
    handlers.worker_handler(EVENT, None)

    assert fake_pipeline.seen == [EVENT]


def test_worker_handler_returns_normally_on_handled_failure(fake_pipeline):
    fake_pipeline.error = RuntimeError("LLM down")

    handlers.worker_handler(EVENT, None)  # must not raise, or Lambda would retry the same prompt


def test_worker_handler_lets_unrecorded_failure_reach_lambda_retries(fake_pipeline):
    fake_pipeline.error = FailureNotRecorded("database unreachable")

    with pytest.raises(FailureNotRecorded):
        handlers.worker_handler(EVENT, None)


@pytest.mark.parametrize("error", [None, RuntimeError("LLM down"), FailureNotRecorded("db down")])
def test_worker_handler_disposes_shared_engine_after_every_run(fake_pipeline, sessionmanager, error):
    fake_pipeline.error = error

    try:
        handlers.worker_handler(EVENT, None)
    except FailureNotRecorded:
        pass

    assert sessionmanager.disposed == 1
