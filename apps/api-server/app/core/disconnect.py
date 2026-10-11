import asyncio
from collections.abc import Coroutine
from typing import Any

from starlette.requests import Request


class ClientDisconnected(Exception):
    """The client went away before the work finished; the work was cancelled."""


async def _wait_for_disconnect(request: Request) -> None:
    # The body has already been read by the time a route runs, so the next ASGI
    # message on this connection is `http.disconnect` — or nothing at all, until
    # the response is sent. Under Mangum (Lambda) it never arrives early: the
    # function cannot see the client leave, so the work simply runs to the end.
    while (await request.receive())["type"] != "http.disconnect":
        pass


async def run_until_disconnect[T](request: Request, work: Coroutine[Any, Any, T]) -> T:
    """Await `work`, cancelling it if the client disconnects first.

    A plain async route keeps running after its client hangs up; for an LLM call
    that means a reply nobody reads, still billed. Racing the work against the
    connection's disconnect message turns an aborted fetch into a cancelled
    provider request.

    Raises ClientDisconnected when the client left first.
    """
    work_task = asyncio.ensure_future(work)
    watcher = asyncio.ensure_future(_wait_for_disconnect(request))
    try:
        await asyncio.wait({work_task, watcher}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        # Also reached when this route itself is cancelled: never leak either task.
        for task in (work_task, watcher):
            if not task.done():
                task.cancel()

    if work_task.done() and not work_task.cancelled():
        return work_task.result()

    # Let the cancellation land (closing the provider connection) before
    # returning. Whatever it ends in — cancelled, or an error raised on the way
    # out — nobody is left to read it.
    try:
        await work_task
    except (asyncio.CancelledError, Exception):
        pass
    raise ClientDisconnected()
