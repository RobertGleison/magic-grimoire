import logging as _logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

_log = _logging.getLogger(__name__)

if not settings.SUPABASE_JWT_SECRET:
    _log.warning(
        "SUPABASE_JWT_SECRET is not configured — all auth requests will be treated as unauthenticated"
    )

_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    """Return the Supabase user UUID from a valid JWT, or None for guests."""
    if not settings.SUPABASE_JWT_SECRET or credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience="authenticated",
        )
        return payload.get("sub")
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
