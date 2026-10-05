import logging as _logging
from functools import cache

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


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    """Return the Supabase user UUID from a valid JWT, or None for guests."""
    if not settings.SUPABASE_URL or credentials is None:
        return None
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience="authenticated",
        )
        return payload.get("sub")
    except jwt.PyJWKClientError as exc:
        # Can't reach the JWKS endpoint, or no key matches the token's kid.
        _log.warning("JWT signing key lookup failed: %s", exc)
        return None
    except jwt.PyJWTError:
        return None


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
