"""
Identity service — all business logic for user auth.

Handles registration, login, token refresh, OAuth user creation,
and profile updates. Publishes domain events via the event bus.
"""

import secrets
import string
from datetime import UTC, datetime

import bcrypt
import structlog
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, decode_token
from app.core.config import get_settings
from app.core.events import bus
from app.modules.identity.models import Feedback, InviteCode, User
from app.modules.identity.schemas import (
    FeedbackCreate,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserUpdate,
)

logger = structlog.get_logger(__name__)
_settings = get_settings()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


class IdentityService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Registration
    # -------------------------------------------------------------------------

    async def register_user(self, data: UserCreate) -> User:
        # Validate invite code when beta gate is active
        invite: InviteCode | None = None
        if _settings.registration_requires_invite:
            if not data.invite_code:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="An invite code is required to register",
                )
            invite = await self._get_invite_code(data.invite_code)

        existing = await self._get_user_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )

        user = User(
            email=data.email.lower(),
            hashed_password=_hash_password(data.password),
            display_name=data.display_name,
            is_active=True,
            is_verified=False,
        )
        self._db.add(user)
        await self._db.flush()  # get user.id before commit

        if invite:
            invite.used_by_user_id = user.id
            invite.used_at = datetime.now(UTC)
            invite.is_active = False

        bus.publish("user.registered", {"user_id": str(user.id), "email": user.email})
        logger.info("user_registered", user_id=str(user.id), email=user.email)

        return user

    # -------------------------------------------------------------------------
    # Login
    # -------------------------------------------------------------------------

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self._get_user_by_email(data.email)

        if not user or not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not _verify_password(data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        logger.info("user_logged_in", user_id=str(user.id))
        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )

    # -------------------------------------------------------------------------
    # Token refresh
    # -------------------------------------------------------------------------

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)

        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type — expected refresh token",
            )

        import uuid

        user = await self._db.get(User, uuid.UUID(payload.sub))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )

    # -------------------------------------------------------------------------
    # OAuth
    # -------------------------------------------------------------------------

    async def get_or_create_oauth_user(
        self,
        *,
        google_id: str,
        email: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        # Try to find existing user by google_id
        result = await self._db.execute(select(User).where(User.google_id == google_id))
        user = result.scalar_one_or_none()

        if user:
            return user

        # Try to link by matching email
        user = await self._get_user_by_email(email)
        if user:
            user.google_id = google_id
            if not user.display_name and display_name:
                user.display_name = display_name
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
            await self._db.flush()
            logger.info("google_account_linked", user_id=str(user.id))
            return user

        # Create new user
        user = User(
            email=email.lower(),
            google_id=google_id,
            display_name=display_name,
            avatar_url=avatar_url,
            is_active=True,
            is_verified=True,  # Google verifies email
        )
        self._db.add(user)
        await self._db.flush()

        bus.publish("user.registered", {"user_id": str(user.id), "email": user.email})
        logger.info("user_registered_via_oauth", user_id=str(user.id))
        return user

    # -------------------------------------------------------------------------
    # Profile
    # -------------------------------------------------------------------------

    async def update_user(self, user: User, data: UserUpdate) -> User:
        if data.display_name is not None:
            user.display_name = data.display_name
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        await self._db.flush()
        await self._db.refresh(user)
        return user

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    # -------------------------------------------------------------------------
    # Invite codes
    # -------------------------------------------------------------------------

    async def _get_invite_code(self, code: str) -> InviteCode:
        result = await self._db.execute(
            select(InviteCode).where(InviteCode.code == code.upper())
        )
        invite = result.scalar_one_or_none()
        if not invite or not invite.is_active or invite.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or already-used invite code",
            )
        return invite

    # -------------------------------------------------------------------------
    # Feedback
    # -------------------------------------------------------------------------

    async def submit_feedback(self, user_id: "uuid.UUID", data: FeedbackCreate) -> Feedback:  # type: ignore[name-defined]
        import uuid

        fb = Feedback(
            user_id=user_id,
            category=data.category,
            message=data.message,
        )
        self._db.add(fb)
        await self._db.flush()
        return fb

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self._db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()


def generate_invite_codes(count: int, prefix: str = "") -> list[str]:
    """Generate N random invite codes (uppercase alphanumeric, 8 chars + optional prefix)."""
    alphabet = string.ascii_uppercase + string.digits
    codes = []
    for _ in range(count):
        suffix = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{prefix}{suffix}" if prefix else suffix)
    return codes
