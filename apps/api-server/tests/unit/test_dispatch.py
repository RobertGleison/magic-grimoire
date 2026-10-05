import asyncio
import json

import boto3
import pytest
from botocore.stub import Stubber

import app.decks.dispatch as dispatch_module
from app.decks.dispatch import GenerationJob, InProcessDispatcher, LambdaDispatcher, create_dispatcher

JOB = GenerationJob(
    task_id="task-1", deck_id="deck-1", prompt="mono red burn", format="modern", colors=["R"], deck_size=60
)


async def test_lambda_dispatcher_async_invokes_worker_with_job_payload():
    client = boto3.client(
        "lambda", region_name="eu-north-1", aws_access_key_id="test", aws_secret_access_key="test"
    )
    with Stubber(client) as stub:
        stub.add_response(
            "invoke",
            {"StatusCode": 202},
            {
                "FunctionName": "worker-fn",
                "InvocationType": "Event",
                "Payload": json.dumps(
                    {"task_id": "task-1", "deck_id": "deck-1", "prompt": "mono red burn",
                     "format": "modern", "colors": ["R"], "deck_size": 60}
                ).encode(),
            },
        )
        await LambdaDispatcher("worker-fn", client=client).dispatch(JOB)
        stub.assert_no_pending_responses()


class _RecordingPipeline:
    calls: list[dict] = []
    active = 0
    max_active = 0
    fail = False

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def run(self):
        cls = type(self)
        cls.calls.append(self.kwargs)
        cls.active += 1
        cls.max_active = max(cls.max_active, cls.active)
        await asyncio.sleep(0.01)
        cls.active -= 1
        if cls.fail:
            raise RuntimeError("boom")


@pytest.fixture
def pipeline(monkeypatch):
    _RecordingPipeline.calls = []
    _RecordingPipeline.active = 0
    _RecordingPipeline.max_active = 0
    _RecordingPipeline.fail = False
    monkeypatch.setattr(dispatch_module, "DeckGenerationPipeline", _RecordingPipeline)
    return _RecordingPipeline


async def test_inprocess_dispatcher_runs_pipeline_with_job_fields(pipeline):
    dispatcher = InProcessDispatcher()
    await dispatcher.dispatch(JOB)
    await asyncio.gather(*dispatcher.running)

    assert pipeline.calls == [
        {"task_id": "task-1", "deck_id": "deck-1", "prompt": "mono red burn",
         "format": "modern", "colors": ["R"], "deck_size": 60}
    ]


async def test_inprocess_dispatcher_runs_one_generation_at_a_time(pipeline):
    dispatcher = InProcessDispatcher()
    for _ in range(3):
        await dispatcher.dispatch(JOB)
    await asyncio.gather(*dispatcher.running)

    assert len(pipeline.calls) == 3
    assert pipeline.max_active == 1


async def test_inprocess_dispatcher_swallows_pipeline_failures(pipeline):
    pipeline.fail = True
    dispatcher = InProcessDispatcher()
    await dispatcher.dispatch(JOB)
    await asyncio.gather(*dispatcher.running)  # the background task must not raise


def test_create_dispatcher_selects_implementation():
    assert isinstance(create_dispatcher("inprocess", None), InProcessDispatcher)
    assert isinstance(create_dispatcher("lambda", "worker-fn"), LambdaDispatcher)


def test_create_dispatcher_rejects_bad_config():
    with pytest.raises(ValueError, match="WORKER_FUNCTION_NAME"):
        create_dispatcher("lambda", None)
    with pytest.raises(ValueError, match="Unknown TASK_DISPATCHER"):
        create_dispatcher("celery", None)
