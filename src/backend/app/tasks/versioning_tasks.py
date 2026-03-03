"""
Celery tasks for the versioning module.

Uses asyncio.run() to reuse the async VersioningService rather than duplicating
the delta/patch logic in a sync Celery task.
"""

import asyncio
import uuid

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(queue="default", name="versioning.create_auto_snapshot")
def create_auto_snapshot(project_id: str, node_id: str) -> None:
    """
    Create an automatic snapshot after a document is saved.

    Skips if the delta is < 50 bytes (negligible change).
    Uses asyncio.run() to reuse the async VersioningService.
    """
    asyncio.run(_async_create_auto_snapshot(project_id, node_id))


async def _async_create_auto_snapshot(project_id: str, node_id: str) -> None:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import get_settings
    from app.modules.versioning.service import VersioningService

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    project_uuid = uuid.UUID(project_id)
    node_uuid = uuid.UUID(node_id)

    try:
        async with session_factory() as session:
            svc = VersioningService(session)
            result = await svc.create_snapshot(
                project_id=project_uuid,
                binder_node_id=node_uuid,
                snapshot_type="auto",
                skip_if_small=True,
            )
            await session.commit()
            if result:
                logger.info(
                    "auto_snapshot_created",
                    snapshot_id=str(result.id),
                    node_id=node_id,
                )
            else:
                logger.debug("auto_snapshot_skipped", node_id=node_id)
    except Exception as exc:
        logger.error("auto_snapshot_failed", node_id=node_id, error=str(exc))
        raise
    finally:
        await engine.dispose()
