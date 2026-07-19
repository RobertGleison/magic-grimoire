"""The contract between the deck-generation worker (publisher) and the SSE
endpoint (subscriber). Both sides import from here so the channel name and
event framing cannot drift apart."""


def task_channel(task_id: str) -> str:
    """Redis pub/sub channel carrying progress events for one task."""
    return f"task:{task_id}"


def sse_event(data: str) -> str:
    """Frame an already-serialized payload as a Server-Sent Events data event."""
    return f"data: {data}\n\n"
