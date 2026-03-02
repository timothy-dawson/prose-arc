"""
Celery tasks for the manuscript module.

Tasks run in the 'default' queue and use synchronous SQLAlchemy sessions
(Celery workers are not async).
"""

import uuid

import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(queue="default", name="manuscript.update_word_counts")
def update_word_counts(project_id: str, node_id: str) -> None:
    """
    Recount words for the saved node and update aggregate project word count.

    Uses synchronous SQLAlchemy since Celery workers are not async.
    """
    from sqlalchemy import create_engine, func, select, update
    from sqlalchemy.orm import Session

    from app.core.config import get_settings
    from app.modules.manuscript.models import BinderNode, DocumentContent, Project

    settings = get_settings()
    # Convert asyncpg URL to psycopg2 (sync) for Celery tasks
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)

    node_uuid = uuid.UUID(node_id)
    project_uuid = uuid.UUID(project_id)

    with Session(engine) as session:
        doc = session.get(DocumentContent, node_uuid)
        if not doc or not doc.content_text:
            return

        words = len(doc.content_text.split()) if doc.content_text.strip() else 0

        session.execute(
            update(BinderNode).where(BinderNode.id == node_uuid).values(word_count=words)
        )

        # Aggregate all nodes in project
        total = session.execute(
            select(func.coalesce(func.sum(BinderNode.word_count), 0)).where(
                BinderNode.project_id == project_uuid
            )
        ).scalar_one()

        session.execute(
            update(Project).where(Project.id == project_uuid).values(word_count=total)
        )
        session.commit()

    logger.info("word_counts_updated", node_id=node_id, words=words, project_total=total)


@celery_app.task(queue="default", name="manuscript.reindex_search")
def reindex_search(project_id: str, node_id: str) -> None:
    """
    Refresh full-text search index for a document.

    The GIN functional index on to_tsvector(content_text) updates automatically
    when content_text changes, so this task is a no-op for now — reserved as a
    hook for future external search engines (Meilisearch, etc.).
    """
    logger.debug("reindex_search_noop", project_id=project_id, node_id=node_id)
