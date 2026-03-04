"""Notifications API router — includes SSE streaming endpoint.

Event bus wiring happens at module import time (same pattern as versioning router).
"""

import asyncio
import json
import uuid
from typing import Annotated, AsyncIterator

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.auth import get_current_user
from app.core.db import get_db
from app.core.events import bus
from app.modules.identity.models import User
from app.modules.notifications.schemas import (
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    NotificationRead,
    UnreadCountResponse,
)
from app.modules.notifications.service import NotificationService

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["notifications"])


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/notifications", response_model=list[NotificationRead])
async def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationRead]:
    svc = NotificationService(db)
    return await svc.list_notifications(
        current_user.id, unread_only=unread_only, limit=limit, offset=offset
    )


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    svc = NotificationService(db)
    count = await svc.get_unread_count(current_user.id)
    return UnreadCountResponse(count=count)


@router.patch("/notifications/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    svc = NotificationService(db)
    await svc.mark_read(current_user.id, notification_id)
    await db.commit()


@router.post("/notifications/mark-all-read", status_code=204)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    svc = NotificationService(db)
    await svc.mark_all_read(current_user.id)
    await db.commit()


@router.get("/notifications/preferences", response_model=list[NotificationPreferenceRead])
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationPreferenceRead]:
    svc = NotificationService(db)
    return await svc.get_preferences(current_user.id)


@router.patch("/notifications/preferences", response_model=NotificationPreferenceRead)
async def update_preference(
    data: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferenceRead:
    svc = NotificationService(db)
    result = await svc.update_preference(current_user.id, data)
    await db.commit()
    return result


# ---------------------------------------------------------------------------
# SSE streaming endpoint
# ---------------------------------------------------------------------------


@router.get("/notifications/stream")
async def notification_stream(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventSourceResponse:
    """
    Server-Sent Events stream for real-time notification delivery.

    The client connects once; whenever a notification is created for this user,
    the message is pushed via Redis pub/sub and forwarded to the SSE client.

    Authentication: the `Authorization: Bearer <token>` header is required
    (use @microsoft/fetch-event-source on the frontend, not the native EventSource API).
    """
    user_id = current_user.id

    # Get initial unread count before entering the generator
    svc = NotificationService(db)
    initial_count = await svc.get_unread_count(user_id)

    async def event_generator() -> AsyncIterator[dict]:
        import redis.asyncio as aioredis

        from app.core.config import get_settings

        settings = get_settings()
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        channel = f"notifications:{user_id}"
        await pubsub.subscribe(channel)

        try:
            # Send initial state immediately
            yield {
                "event": "connected",
                "data": json.dumps({"unread_count": initial_count}),
            }

            # Stream incoming messages
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield {"event": "notification", "data": message["data"]}

        except asyncio.CancelledError:
            # Client disconnected — clean up gracefully
            pass
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await r.aclose()
            except Exception:
                pass

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Event bus wiring
# ---------------------------------------------------------------------------


def _on_export_completed(data: dict) -> None:
    """Create an 'export_complete' notification when a Celery export finishes."""
    asyncio.run(_async_create_notification(
        user_id=data.get("user_id", ""),
        type="export_complete",
        title="Export ready",
        message=f"Your {data.get('format', '').upper()} export of \"{data.get('project_title', 'your manuscript')}\" is ready to download.",
        extra_data={"job_id": data.get("job_id"), "project_id": data.get("project_id")},
    ))


def _on_export_failed(data: dict) -> None:
    """Create an 'export_failed' notification when a Celery export fails."""
    asyncio.run(_async_create_notification(
        user_id=data.get("user_id", ""),
        type="export_failed",
        title="Export failed",
        message=f"Your {data.get('format', '').upper()} export failed. Please try again.",
        extra_data={"job_id": data.get("job_id"), "error": data.get("error")},
    ))


async def _async_create_notification(
    user_id: str,
    type: str,
    title: str,
    message: str,
    extra_data: dict,
) -> None:
    """Create a notification in a short-lived DB session (called from sync event handler)."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import get_settings

    if not user_id:
        return

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            svc = NotificationService(session)
            await svc.create(user_uuid, type, title, message, extra_data)
            await session.commit()
    except Exception as exc:
        logger.error("notification_create_failed", user_id=user_id, error=str(exc))
    finally:
        await engine.dispose()


# Subscribe at module import time
bus.subscribe("export.completed", _on_export_completed)
bus.subscribe("export.failed", _on_export_failed)
