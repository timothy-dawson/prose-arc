"""
JWT authentication helpers and FastAPI dependency injection.

Token structure:
  - access token:  HS256, 30 min, payload {sub: user_id, type: "access"}
  - refresh token: HS256, 30 days, payload {sub: user_id, type: "refresh"}

Usage:
    # In a router endpoint:
    @router.get("/users/me")
    async def get_me(current_user: User = Depends(get_current_user)):
        ...
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db

logger = structlog.get_logger(__name__)
settings = get_settings()

ALGORITHM = "HS256"

security = HTTPBearer()


class TokenPayload(BaseModel):
    sub: str  # user UUID as string
    type: str  # "access" or "refresh"
    exp: datetime


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT. Raises HTTPException on any failure."""
    try:
        raw = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return TokenPayload(**raw)
    except JWTError as exc:
        logger.warning("jwt_decode_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":  # type: ignore[name-defined]  # forward ref resolved at import time
    """
    FastAPI dependency — validates Bearer token and returns the authenticated User.

    Raises 401 if the token is missing, invalid, expired, or the user no longer exists.
    """
    from app.modules.identity.models import User  # avoid circular imports

    payload = decode_token(credentials.credentials)

    if payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected access token",
        )

    user = await db.get(User, uuid.UUID(payload.sub))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user
