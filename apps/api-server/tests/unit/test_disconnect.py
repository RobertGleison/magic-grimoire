import asyncio

import pytest

from app.core.disconnect import ClientDisconnected, run_until_disconnect


class FakeRequest:
    """Stands in for a Starlette Request: `receive()` yields what the ASGI server would."""

    def __init__(self, disconnect: asyncio.Event):
        self._disconnect = disconnect

    async def receive(self) -> dict:
        await self._disconnect.wait()
        return {"type": "http.disconnect"}


async def test_returns_work_result_when_client_stays():
    async def work() -> str:
        return "reply"

    assert await run_until_disconnect(FakeRequest(asyncio.Event()), work()) == "reply"


async def test_work_errors_propagate():
    async def work() -> str:
        raise ValueError("provider down")

    with pytest.raises(ValueError, match="provider down"):
        await run_until_disconnect(FakeRequest(asyncio.Event()), work())


async def test_disconnect_cancels_the_work():
    disconnect = asyncio.Event()
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def work() -> str:
        started.set()
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            cancelled.set()
            raise
        return "never"

    async def hang_up():
        await started.wait()
        disconnect.set()

    hang_up_task = asyncio.create_task(hang_up())
    with pytest.raises(ClientDisconnected):
        await asyncio.wait_for(run_until_disconnect(FakeRequest(disconnect), work()), timeout=5)
    await hang_up_task
    assert cancelled.is_set()


async def test_ignores_non_disconnect_messages():
    class ChattyRequest:
        def __init__(self):
            self.calls = 0

        async def receive(self) -> dict:
            self.calls += 1
            if self.calls == 1:
                return {"type": "http.request", "body": b"", "more_body": False}
            await asyncio.sleep(60)
            return {"type": "http.disconnect"}

    async def work() -> str:
        await asyncio.sleep(0.01)
        return "reply"

    assert await run_until_disconnect(ChattyRequest(), work()) == "reply"
