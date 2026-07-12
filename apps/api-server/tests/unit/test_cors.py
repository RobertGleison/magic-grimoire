from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_PREFLIGHT_HEADERS = {"Access-Control-Request-Method": "POST"}


def test_preflight_allows_configured_origin():
    res = client.options(
        "/api/v1/chat",
        headers={"Origin": "http://localhost:3000", **_PREFLIGHT_HEADERS},
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert res.headers.get("access-control-allow-credentials") == "true"


def test_preflight_rejects_unknown_origin():
    res = client.options(
        "/api/v1/chat",
        headers={"Origin": "https://evil.example", **_PREFLIGHT_HEADERS},
    )
    assert res.headers.get("access-control-allow-origin") != "https://evil.example"
    assert res.headers.get("access-control-allow-origin") != "*"
