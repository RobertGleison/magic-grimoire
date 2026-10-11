from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.rate_limit import SlidingWindowLimiter, client_key, rate_limited


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_allows_up_to_the_limit_then_blocks():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=2, window_seconds=10, clock=clock)
    assert limiter.allow("a")
    assert limiter.allow("a")
    assert not limiter.allow("a")
    # Other callers are counted separately.
    assert limiter.allow("b")


def test_window_slides():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10, clock=clock)
    assert limiter.allow("a")
    clock.now = 9.9
    assert not limiter.allow("a")
    clock.now = 10.0
    assert limiter.allow("a")


def _request(headers: dict, host: str = "10.0.0.1"):
    request = MagicMock()
    request.headers = headers
    request.client.host = host
    return request


def test_client_key_prefers_cloudflare_then_forwarded_then_peer():
    assert client_key(_request({"cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2"})) == "1.1.1.1"
    assert client_key(_request({"x-forwarded-for": "2.2.2.2, 3.3.3.3"})) == "2.2.2.2"
    assert client_key(_request({})) == "10.0.0.1"


def test_dependency_raises_429_with_retry_after():
    dependency = rate_limited(SlidingWindowLimiter(limit=1, window_seconds=30))
    request = _request({"cf-connecting-ip": "1.1.1.1"})
    dependency(request)
    with pytest.raises(HTTPException) as raised:
        dependency(request)
    assert raised.value.status_code == 429
    assert raised.value.headers["Retry-After"] == "30"
