"""Notifications service — CRUD + Redis pub/sub delivery."""

import json
import uuid
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification, NotificationPreference
from app.modules.notifications.schemas import (
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationRead,
)

logger = structlog.get_logger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── Create ────────────────────────────────────────────────────────────────

    async def create(
        self,
        user_id: uuid.UUID,
        type: str,
        title: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> NotificationRead:
        # Check preference — skip if user disabled this type
        pref = await self._get_preference(user_id, type)
        if pref and not pref.enabled:
            logger.debug("notification_suppressed", user_id=str(user_id), type=type)
            # Return a dummy read object without persisting
            return NotificationRead(
                id=uuid.uuid4(),
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                data=data or {},
                read=True,
                created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            )

        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=data or {},
            read=False,
        )
        self._db.add(notif)
        await self._db.flush()
        await self._db.refresh(notif)

        # Push real-time update via Redis pub/sub
        await self._publish(user_id, notif)

        return NotificationRead.model_validate(notif)

    # ── List + counts ─────────────────────────────────────────────────────────

    async def list_notifications(
        self,
        user_id: uuid.UUID,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[NotificationRead]:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if unread_only:
            stmt = stmt.where(Notification.read.is_(False))
        result = await self._db.execute(stmt)
        return [NotificationRead.model_validate(n) for n in result.scalars().all()]

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        stmt = select(func.count()).where(
            Notification.user_id == user_id, Notification.read.is_(False)
        )
        result = await self._db.execute(stmt)
        return result.scalar_one() or 0

    # ── Mark read ─────────────────────────────────────────────────────────────

    async def mark_read(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
        notif = await self._db.get(Notification, notification_id)
        if notif and notif.user_id == user_id and not notif.read:
            notif.read = True
            await self._db.flush()

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        from sqlalchemy import update

        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read.is_(False))
            .values(read=True)
        )
        await self._db.execute(stmt)
        await self._db.flush()

    # ── Preferences ───────────────────────────────────────────────────────────

    async def get_preferences(self, user_id: uuid.UUID) -> list[NotificationPreferenceRead]:
        stmt = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        result = await self._db.execute(stmt)
        return [NotificationPreferenceRead.model_validate(p) for p in result.scalars().all()]

    async def update_preference(
        self, user_id: uuid.UUID, data: NotificationPreferenceUpdate
    ) -> NotificationPreferenceRead:
        pref = await self._get_preference(user_id, data.type)
        if pref is None:
            pref = NotificationPreference(user_id=user_id, type=data.type, enabled=data.enabled)
            self._db.add(pref)
        else:
            pref.enabled = data.enabled
        await self._db.flush()
        await self._db.refresh(pref)
        return NotificationPreferenceRead.model_validate(pref)

    # ── Internal helpers ──────────────────────────────────────────────────────

    async def _get_preference(
        self, user_id: uuid.UUID, type: str
    ) -> NotificationPreference | None:
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id, NotificationPreference.type == type
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def _publish(self, user_id: uuid.UUID, notif: Notification) -> None:
        """Publish a notification to Redis so SSE listeners receive it immediately."""
        try:
            import redis.asyncio as aioredis

            from app.core.config import get_settings

            settings = get_settings()
            r = aioredis.from_url(settings.redis_url, decode_responses=True)
            unread_count = await self.get_unread_count(user_id)
            payload = json.dumps(
                {
                    "unread_count": unread_count,
                    "notification": {
                        "id": str(notif.id),
                        "type": notif.type,
                        "title": notif.title,
                        "message": notif.message,
                        "data": notif.data,
                        "created_at": notif.created_at.isoformat(),
                    },
                }
            )
            await r.publish(f"notifications:{user_id}", payload)
            await r.aclose()
        except Exception as exc:
            # Non-fatal — notification is persisted in DB; SSE delivery is best-effort
            logger.warning("notification_publish_failed", user_id=str(user_id), error=str(exc))
