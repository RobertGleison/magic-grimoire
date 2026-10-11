import logging as _logging
from dataclasses import dataclass
from functools import cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_log = _logging.getLogger(__name__)

# Asymmetric only. Supabase's key id is public, so accepting HS256 with anything
# derived from the JWKS would let anyone mint tokens.
_ALGORITHMS = ["ES256", "RS256"]

if not settings.SUPABASE_URL:
    _log.warning("SUPABASE_URL is not configured — all auth requests will be treated as unauthenticated")

_bearer = HTTPBearer(auto_error=False)


@cache
def _jwks_client() -> jwt.PyJWKClient:
    # Keys are cached in-process (a warm Lambda fetches once); an unknown `kid`
    # (key rotation) triggers one refetch.
    return jwt.PyJWKClient(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
        lifespan=3600,
        timeout=5,
    )


def _verified_claims(credentials: HTTPAuthorizationCredentials | None) -> dict[str, Any] | None:
    """The token's claims when its signature and audience check out, else None."""
    if not settings.SUPABASE_URL or credentials is None:
        return None
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(credentials.credentials)
        return jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience="authenticated",
        )
    except jwt.PyJWKClientError as exc:
        # Can't reach the JWKS endpoint, or no key matches the token's kid.
        _log.warning("JWT signing key lookup failed: %s", exc)
        return None
    except jwt.PyJWTError:
        return None


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    """Return the Supabase user UUID from a valid JWT, or None for guests."""
    claims = _verified_claims(credentials)
    return claims.get("sub") if claims else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Return the Supabase user UUID or raise HTTP 401."""
    user_id = get_optional_user(credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


# --- public identity ----------------------------------------------------------

DISPLAY_NAME_MAX = 60
AVATAR_URL_MAX = 2048


@dataclass(frozen=True)
class Identity:
    """Who the caller is, plus what the community may see of them."""

    user_id: str
    display_name: str | None
    avatar_url: str | None


def _metadata_text(metadata: dict[str, Any], key: str) -> str | None:
    value = metadata.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def public_profile_from_claims(claims: dict[str, Any]) -> tuple[str | None, str | None]:
    """(display_name, avatar_url) from a Supabase token's `user_metadata`.

    A handle (GitHub's `user_name`) is preferred over a full name, since this is
    shown to strangers. The email is never used: it is private. Both fields are
    user-controlled, so they are length-capped and the avatar must be https.
    """
    metadata = claims.get("user_metadata")
    if not isinstance(metadata, dict):
        return None, None
    name = next(
        (
            text
            for key in ("user_name", "preferred_username", "full_name", "name")
            if (text := _metadata_text(metadata, key))
        ),
        None,
    )
    avatar = _metadata_text(metadata, "avatar_url")
    if avatar and (not avatar.startswith("https://") or len(avatar) > AVATAR_URL_MAX):
        avatar = None
    return (name[:DISPLAY_NAME_MAX] if name else None), avatar


def get_current_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Identity:
    """Like `get_current_user`, plus the caller's public name and avatar."""
    claims = _verified_claims(credentials)
    if not claims or not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    display_name, avatar_url = public_profile_from_claims(claims)
    return Identity(user_id=claims["sub"], display_name=display_name, avatar_url=avatar_url)
