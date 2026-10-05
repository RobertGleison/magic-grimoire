from mangum import Mangum

import app.lambda_handlers as handlers

EVENT = {"task_id": "t-1", "deck_id": "d-1", "prompt": "elves", "format": "modern", "colors": None, "deck_size": 60}


class _FakePipeline:
    seen: list[dict] = []
    fail = False

    def __init__(self, **kwargs):
        type(self).seen.append(kwargs)

    async def run(self):
        if type(self).fail:
            raise RuntimeError("LLM down")


def test_api_handler_is_mangum_adapter():
    assert isinstance(handlers.api_handler, Mangum)


def test_worker_handler_runs_pipeline_from_event(monkeypatch):
    _FakePipeline.seen, _FakePipeline.fail = [], False
    monkeypatch.setattr(handlers, "DeckGenerationPipeline", _FakePipeline)

    handlers.worker_handler(EVENT, None)

    assert _FakePipeline.seen == [EVENT]


def test_worker_handler_returns_normally_on_handled_failure(monkeypatch):
    _FakePipeline.seen, _FakePipeline.fail = [], True
    monkeypatch.setattr(handlers, "DeckGenerationPipeline", _FakePipeline)

    handlers.worker_handler(EVENT, None)  # must not raise, or Lambda would retry the same prompt
