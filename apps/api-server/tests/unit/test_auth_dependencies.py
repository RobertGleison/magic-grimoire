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


# --- public identity (the feed's byline) ---

from app.auth.dependencies import Identity, get_current_identity, public_profile_from_claims  # noqa: E402


@_app.get("/identity")
def identity_route(identity: Identity = Depends(get_current_identity)):
    return {"user_id": identity.user_id, "name": identity.display_name, "avatar": identity.avatar_url}


def test_identity_carries_the_public_name_and_avatar():
    token = make_token(user_metadata={"full_name": "Jace Beleren", "avatar_url": "https://a.test/j.png"})
    res = client.get("/identity", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"user_id": TEST_USER_ID, "name": "Jace Beleren", "avatar": "https://a.test/j.png"}


def test_identity_requires_a_token():
    assert client.get("/identity").status_code == 401


def test_a_handle_is_preferred_over_a_full_name():
    claims = {"user_metadata": {"full_name": "Jace Beleren", "user_name": "mindsculptor"}}
    assert public_profile_from_claims(claims) == ("mindsculptor", None)


def test_the_email_is_never_used_as_a_name():
    claims = {"email": "jace@ravnica.test", "user_metadata": {"email": "jace@ravnica.test"}}
    assert public_profile_from_claims(claims) == (None, None)


def test_names_are_trimmed_and_capped():
    name, _ = public_profile_from_claims({"user_metadata": {"name": "  " + "x" * 200 + "  "}})
    assert name == "x" * 60


def test_only_https_avatars_are_kept():
    for bad in ("http://a.test/j.png", "javascript:alert(1)", "https://a.test/" + "x" * 3000):
        assert public_profile_from_claims({"user_metadata": {"avatar_url": bad}}) == (None, None)


def test_missing_or_malformed_metadata_yields_nothing():
    assert public_profile_from_claims({}) == (None, None)
    assert public_profile_from_claims({"user_metadata": "nope"}) == (None, None)
    assert public_profile_from_claims({"user_metadata": {"name": 7}}) == (None, None)
