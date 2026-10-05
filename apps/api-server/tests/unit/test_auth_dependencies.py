import logging
import time

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user, get_optional_user
from tests.conftest import TEST_KEY_ID, TEST_SIGNING_KEY, TEST_USER_ID, make_token

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
    res = client.get("/optional", headers={"Authorization": f"Bearer {make_token()}"})
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
    res = client.get("/required", headers={"Authorization": f"Bearer {make_token()}"})
    assert res.status_code == 200
    assert res.json()["user_id"] == TEST_USER_ID


def test_required_raises_401_with_invalid_token():
    res = client.get("/required", headers={"Authorization": "Bearer bad.token.here"})
    assert res.status_code == 401


def test_hs256_token_rejected():
    # Supabase's key id is public; an HS256 token "signed" with it must never pass.
    forged = jwt.encode({"sub": TEST_USER_ID, "aud": "authenticated"}, TEST_KEY_ID, algorithm="HS256")
    res = client.get("/required", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_token_from_another_key_rejected():
    other = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"sub": TEST_USER_ID, "aud": "authenticated"}, other, algorithm="ES256", headers={"kid": TEST_KEY_ID}
    )
    res = client.get("/required", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_wrong_audience_rejected():
    res = client.get("/required", headers={"Authorization": f"Bearer {make_token(aud='anon')}"})
    assert res.status_code == 401


def test_expired_token_rejected():
    res = client.get("/required", headers={"Authorization": f"Bearer {make_token(exp=int(time.time()) - 60)}"})
    assert res.status_code == 401


def test_unknown_key_id_rejected_and_logged(caplog):
    token = jwt.encode(
        {"sub": TEST_USER_ID, "aud": "authenticated"}, TEST_SIGNING_KEY, algorithm="ES256", headers={"kid": "rotated"}
    )
    with caplog.at_level(logging.WARNING, logger="app.auth.dependencies"):
        res = client.get("/required", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "signing key lookup failed" in caplog.text
