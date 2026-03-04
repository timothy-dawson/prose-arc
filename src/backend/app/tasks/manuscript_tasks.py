"""
Celery tasks for the manuscript module.
"""

import asyncio
import uuid

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(queue="default", name="manuscript.update_word_counts")
def update_word_counts(project_id: str, node_id: str) -> None:
    """Recount words for the saved node and update aggregate project word count."""
    asyncio.run(_async_update_word_counts(project_id, node_id))


async def _async_update_word_counts(project_id: str, node_id: str) -> None:
    from sqlalchemy import func, select, update
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import get_settings
    from app.modules.manuscript.models import BinderNode, DocumentContent, Project

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    node_uuid = uuid.UUID(node_id)
    project_uuid = uuid.UUID(project_id)

    try:
        async with session_factory() as session:
            doc = await session.get(DocumentContent, node_uuid)
            if not doc or not doc.content_text:
                return

            words = len(doc.content_text.split()) if doc.content_text.strip() else 0

            await session.execute(
                update(BinderNode).where(BinderNode.id == node_uuid).values(word_count=words)
            )

            total: int = (
                await session.execute(
                    select(func.coalesce(func.sum(BinderNode.word_count), 0)).where(
                        BinderNode.project_id == project_uuid
                    )
                )
            ).scalar_one()

            await session.execute(
                update(Project).where(Project.id == project_uuid).values(word_count=total)
            )
            await session.commit()

        logger.info("word_counts_updated", node_id=node_id, words=words, project_total=total)
    finally:
        await engine.dispose()


@celery_app.task(queue="default", name="manuscript.reindex_search")
def reindex_search(project_id: str, node_id: str) -> None:
    """
    Refresh full-text search index for a document.

    The GIN functional index on to_tsvector(content_text) updates automatically
    when content_text changes, so this task is a no-op for now — reserved as a
    hook for future external search engines (Meilisearch, etc.).
    """
    logger.debug("reindex_search_noop", project_id=project_id, node_id=node_id)
