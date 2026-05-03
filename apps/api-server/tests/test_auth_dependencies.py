import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user, get_optional_user
from app.core.config import settings

TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"


def _make_token(user_id: str = TEST_USER_ID) -> str:
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated"},
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


# Minimal FastAPI app — avoids needing a database.
_app = FastAPI()


@_app.get("/optional")
def optional_route(user_id: str | None = Depends(get_optional_user)):
    return {"user_id": user_id}


@_app.get("/required")
def required_route(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}


client = TestClient(_app)


def test_optional_returns_none_without_token():
    res = client.get("/optional")
    assert res.status_code == 200
    assert res.json()["user_id"] is None


def test_optional_returns_user_id_with_valid_token():
    res = client.get("/optional", headers={"Authorization": f"Bearer {_make_token()}"})
    assert res.status_code == 200
    assert res.json()["user_id"] == TEST_USER_ID


def test_optional_returns_none_with_invalid_token():
    res = client.get("/optional", headers={"Authorization": "Bearer bad.token.here"})
    assert res.status_code == 200
    assert res.json()["user_id"] is None


def test_required_raises_401_without_token():
    res = client.get("/required")
    assert res.status_code == 401


def test_required_returns_user_id_with_valid_token():
    res = client.get("/required", headers={"Authorization": f"Bearer {_make_token()}"})
    assert res.status_code == 200
    assert res.json()["user_id"] == TEST_USER_ID


def test_required_raises_401_with_invalid_token():
    res = client.get("/required", headers={"Authorization": "Bearer bad.token.here"})
    assert res.status_code == 401
