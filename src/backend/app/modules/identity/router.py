"""
Identity router — auth and user profile endpoints.

All routes are prefixed with /api/v1 in main.py.
"""

import uuid
from typing import Annotated

import structlog
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.config import Config as StarletteConfig

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.core.config import get_settings
from app.core.db import get_db
from app.core.limiter import limiter
from app.core.redis_client import RedisDep, is_token_revoked, revoke_token
from app.modules.identity.models import Feedback, User
from app.modules.identity.schemas import (
    FeedbackCreate,
    FeedbackResponse,
    LoginRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.modules.identity.service import IdentityService

router = APIRouter(tags=["identity"])
logger = structlog.get_logger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# OAuth client setup (authlib)
# ---------------------------------------------------------------------------
_starlette_config = StarletteConfig(environ={
    "GOOGLE_CLIENT_ID": settings.google_oauth_client_id,
    "GOOGLE_CLIENT_SECRET": settings.google_oauth_client_secret,
})
oauth = OAuth(_starlette_config)
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


# ---------------------------------------------------------------------------
# Registration + Login
# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=UserRead, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    service = IdentityService(db)
    return await service.register_user(data)


@router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    service = IdentityService(db)
    return await service.login(data)


@router.post("/auth/refresh", response_model=TokenResponse)
@limiter.limit("5/minute")
async def refresh_tokens(
    request: Request,
    data: TokenRefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: RedisDep,
) -> TokenResponse:
    payload = decode_token(data.refresh_token)

    if payload.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected refresh token",
        )

    # Reject replayed tokens
    if payload.jti and await is_token_revoked(payload.jti, redis):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has already been used",
        )

    # Rotate: revoke the current JTI before issuing new tokens
    if payload.jti:
        ttl = settings.jwt_refresh_token_expire_days * 86_400
        await revoke_token(payload.jti, redis, ttl)

    user = await db.get(User, uuid.UUID(payload.sub))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

@router.get("/auth/google")
async def google_login(request: Request) -> RedirectResponse:
    redirect_uri = f"{settings.api_url}/api/v1/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)  # type: ignore[union-attr]


@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RedirectResponse:
    token = await oauth.google.authorize_access_token(request)  # type: ignore[union-attr]
    user_info = token.get("userinfo") or await oauth.google.userinfo(token=token)  # type: ignore[union-attr]

    service = IdentityService(db)
    user = await service.get_or_create_oauth_user(
        google_id=user_info["sub"],
        email=user_info["email"],
        display_name=user_info.get("name"),
        avatar_url=user_info.get("picture"),
    )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    redirect_url = (
        f"{settings.app_url}/auth/callback"
        f"?access_token={access_token}"
        f"&refresh_token={refresh_token}"
    )
    return RedirectResponse(url=redirect_url)


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@router.get("/users/me", response_model=UserRead)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user


@router.patch("/users/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    service = IdentityService(db)
    return await service.update_user(current_user, data)


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

@router.post("/feedback", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    data: FeedbackCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Feedback:
    service = IdentityService(db)
    return await service.submit_feedback(current_user.id, data)
