"""Best-effort, in-process rate limiting for unauthenticated read endpoints.

Each Lambda instance (or local process) keeps its own window, so the effective
limit is per instance, not global. That is enough to blunt a single client
hammering a public endpoint; the edge (Cloudflare) remains the real shield for
anything expensive. The free Cloudflare plan's single rate-limit rule is spent
on deck generation, which is why this exists.
"""
import time
from collections import deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    """At most `limit` hits per `window_seconds` per key."""

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        now = self._clock()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        # Keep memory bounded on a long-lived instance: drop idle keys now and then.
        if len(self._hits) > 10_000:
            self._hits = {k: v for k, v in self._hits.items() if v and now - v[-1] < self.window}
        return True


def client_key(request: Request) -> str:
    """The caller's IP. Behind Cloudflare the socket peer is the proxy, so the
    original client comes from CF-Connecting-IP, then X-Forwarded-For."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limited(limiter: SlidingWindowLimiter) -> Callable[[Request], None]:
    """A FastAPI dependency that 429s once `limiter` is exhausted for the caller."""

    def _dependency(request: Request) -> None:
        if not limiter.allow(client_key(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Slow down and try again in a moment.",
                headers={"Retry-After": str(int(limiter.window))},
            )

    return _dependency
