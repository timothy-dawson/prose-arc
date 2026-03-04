"""
Celery tasks for document export.

The export_document task performs the heavy rendering work (DOCX / PDF / ePub)
asynchronously so the API call returns immediately with a job ID.
"""

import asyncio
import json
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import structlog
import zstandard

from app.tasks.celery_app import celery_app

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Main export task
# ---------------------------------------------------------------------------


@celery_app.task(
    queue="export",
    name="export.export_document",
    soft_time_limit=300,  # 5 minutes
    time_limit=360,
)
def export_document(job_id: str) -> None:
    """Render a manuscript to DOCX, PDF, or ePub and upload to GCS/MinIO."""
    asyncio.run(_async_export_document(job_id))


async def _async_export_document(job_id: str) -> None:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy import select

    from app.core.config import get_settings
    from app.core.storage import get_storage
    from app.core.events import bus
    from app.modules.export.models import ExportJob, ExportTemplate
    from app.modules.identity.models import User  # noqa: F401 — registers 'users' table in metadata
    from app.modules.manuscript.models import BinderNode, DocumentContent
    from app.modules.manuscript.models import Project
    from app.modules.export.renderers.base import RendererNode
    from app.modules.export.renderers.docx_renderer import DocxRenderer
    from app.modules.export.renderers.pdf_renderer import PdfRenderer
    from app.modules.export.renderers.epub_renderer import EpubRenderer

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    job_uuid = uuid.UUID(job_id)

    t0 = time.monotonic()

    def _elapsed() -> float:
        return round(time.monotonic() - t0, 3)

    try:
        async with session_factory() as session:
            # 1. Load job
            logger.info("export_step", step="load_job", elapsed=_elapsed(), job_id=job_id)
            job = await session.get(ExportJob, job_uuid)
            if not job:
                logger.error("export_job_not_found", job_id=job_id)
                return

            # Mark processing
            job.status = "processing"
            logger.info("export_step", step="flush_processing", elapsed=_elapsed())
            await session.flush()

            # 2. Load project title
            logger.info("export_step", step="load_project", elapsed=_elapsed())
            project = await session.get(Project, job.project_id)
            project_title = project.title if project else "Untitled"

            # 3. Load all non-deleted binder nodes for this project
            logger.info("export_step", step="load_nodes", elapsed=_elapsed())
            stmt = (
                select(BinderNode)
                .where(
                    BinderNode.project_id == job.project_id,
                    BinderNode.deleted_at.is_(None),
                )
                .order_by(BinderNode.sort_order)
            )
            result = await session.execute(stmt)
            all_nodes = list(result.scalars().all())
            logger.info("export_step", step="nodes_loaded", elapsed=_elapsed(), count=len(all_nodes))

            # Sort into depth-first order
            ordered_nodes = _sort_depth_first(all_nodes)

            # 4. Filter by scope
            scope = job.scope or {"type": "full"}
            if scope.get("type") == "selected":
                selected_ids = set(scope.get("node_ids", []))
                # Include selected nodes and all their descendants
                descendant_ids = _get_descendants(all_nodes, selected_ids)
                ordered_nodes = [n for n in ordered_nodes if str(n.id) in descendant_ids]

            # 5. Load document content for each node
            logger.info("export_step", step="load_content", elapsed=_elapsed(), node_count=len(ordered_nodes))
            node_ids = [n.id for n in ordered_nodes]
            if node_ids:
                doc_stmt = select(DocumentContent).where(
                    DocumentContent.binder_node_id.in_(node_ids)
                )
                doc_result = await session.execute(doc_stmt)
                doc_map: dict[uuid.UUID, dict[str, Any]] = {}
                for doc in doc_result.scalars().all():
                    doc_map[doc.binder_node_id] = _load_content(doc)
            else:
                doc_map = {}

            # 6. Build RendererNode list
            logger.info("export_step", step="compute_depths", elapsed=_elapsed())
            depth_map = _compute_depths(all_nodes)
            logger.info("export_step", step="depths_done", elapsed=_elapsed())
            renderer_nodes = [
                RendererNode(
                    id=str(n.id),
                    node_type=n.node_type,
                    title=n.title,
                    depth=depth_map.get(n.id, 0),
                    content=doc_map.get(n.id),
                )
                for n in ordered_nodes
            ]

            # 7. Load template config
            template_config: dict[str, Any] = {}
            if job.template_id:
                tmpl = await session.get(ExportTemplate, job.template_id)
                if tmpl:
                    template_config = tmpl.config or {}
            # Fallback defaults if no template
            if not template_config:
                template_config = _default_config(job.format)

            # 8. Select renderer and render
            logger.info("export_step", step="render_start", elapsed=_elapsed(), format=job.format)
            match job.format:
                case "docx":
                    renderer = DocxRenderer()
                    ext = "docx"
                case "pdf":
                    renderer = PdfRenderer()
                    ext = "pdf"
                case "epub":
                    renderer = EpubRenderer()
                    ext = "epub"
                case _:
                    raise ValueError(f"Unknown format: {job.format}")

            output_bytes = renderer.render(renderer_nodes, template_config, project_title)
            logger.info("export_step", step="render_done", elapsed=_elapsed(), bytes=len(output_bytes))

            # 9. Upload to GCS/MinIO
            logger.info("export_step", step="upload_start", elapsed=_elapsed())
            storage = get_storage()
            gcs_key = f"exports/{job.project_id}/{job_id}.{ext}"
            content_types = {
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "pdf": "application/pdf",
                "epub": "application/epub+zip",
            }
            await storage.upload(
                key=gcs_key,
                data=output_bytes,
                content_type=content_types[job.format],
            )

            # 10. Mark completed
            job.status = "completed"
            job.gcs_key = gcs_key
            job.file_size_bytes = len(output_bytes)
            job.completed_at = datetime.now(timezone.utc)
            await session.flush()
            await session.commit()

            logger.info(
                "export_completed",
                job_id=job_id,
                format=job.format,
                size_bytes=len(output_bytes),
            )

            # 11. Fire event (notifications module will create the notification)
            bus.publish(
                "export.completed",
                {
                    "user_id": str(job.user_id),
                    "job_id": job_id,
                    "project_id": str(job.project_id),
                    "format": job.format,
                    "project_title": project_title,
                },
            )

    except Exception as exc:
        logger.error("export_failed", job_id=job_id, error=str(exc))
        # Update job to failed state
        try:
            async with session_factory() as session:
                job = await session.get(ExportJob, job_uuid)
                if job:
                    job.status = "failed"
                    job.error_message = str(exc)
                    await session.commit()
                    bus.publish(
                        "export.failed",
                        {
                            "user_id": str(job.user_id),
                            "job_id": job_id,
                            "project_id": str(job.project_id),
                            "error": str(exc),
                        },
                    )
        except Exception as inner_exc:
            logger.error("export_status_update_failed", error=str(inner_exc))
        raise
    finally:
        await engine.dispose()


# ---------------------------------------------------------------------------
# Cleanup task
# ---------------------------------------------------------------------------


@celery_app.task(queue="default", name="export.cleanup_expired_exports")
def cleanup_expired_exports() -> None:
    """Delete GCS objects and job records that have passed their expiry date."""
    asyncio.run(_async_cleanup_expired_exports())


async def _async_cleanup_expired_exports() -> None:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy import select, delete

    from app.core.config import get_settings
    from app.core.storage import get_storage
    from app.modules.export.models import ExportJob

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            now = datetime.now(timezone.utc)
            stmt = select(ExportJob).where(
                ExportJob.expires_at < now,
                ExportJob.gcs_key.isnot(None),
            )
            result = await session.execute(stmt)
            expired_jobs = list(result.scalars().all())

            storage = get_storage()
            deleted_count = 0
            for job in expired_jobs:
                try:
                    if job.gcs_key:
                        await storage.delete(job.gcs_key)
                except Exception as exc:
                    logger.warning("gcs_delete_failed", gcs_key=job.gcs_key, error=str(exc))

                await session.delete(job)
                deleted_count += 1

            await session.commit()
            logger.info("expired_exports_cleaned", count=deleted_count)
    finally:
        await engine.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sort_depth_first(nodes: list[Any]) -> list[Any]:
    """Return binder nodes in depth-first (reading) order."""
    children: dict[uuid.UUID | None, list[Any]] = defaultdict(list)
    for node in nodes:
        children[node.parent_id].append(node)
    for parent_id in children:
        children[parent_id].sort(key=lambda n: n.sort_order)

    result: list[Any] = []

    def _traverse(parent_id: uuid.UUID | None) -> None:
        for node in children[parent_id]:
            result.append(node)
            _traverse(node.id)

    _traverse(None)
    return result


def _get_descendants(all_nodes: list[Any], selected_ids: set[str]) -> set[str]:
    """Return all selected IDs plus the IDs of their descendants."""
    children: dict[str, list[str]] = defaultdict(list)
    for node in all_nodes:
        if node.parent_id:
            children[str(node.parent_id)].append(str(node.id))

    result = set(selected_ids)

    def _collect(node_id: str) -> None:
        for child_id in children[node_id]:
            result.add(child_id)
            _collect(child_id)

    for sid in list(selected_ids):
        _collect(sid)
    return result


def _compute_depths(all_nodes: list[Any]) -> dict[uuid.UUID, int]:
    id_to_parent: dict[uuid.UUID, uuid.UUID | None] = {n.id: n.parent_id for n in all_nodes}
    depths: dict[uuid.UUID, int] = {}
    for node in all_nodes:
        depth = 0
        current = node.parent_id
        seen: set[uuid.UUID] = set()
        while current is not None and current not in seen:
            seen.add(current)
            depth += 1
            current = id_to_parent.get(current)
        depths[node.id] = depth
    return depths


def _load_content(doc: Any) -> dict[str, Any]:
    """Load ProseMirror JSON from a DocumentContent row (handles both JSONB and compressed)."""
    if doc.content_prosemirror:
        return doc.content_prosemirror  # type: ignore[no-any-return]
    if doc.content_compressed:
        raw = zstandard.ZstdDecompressor().decompress(doc.content_compressed)
        return json.loads(raw)  # type: ignore[no-any-return]
    return {"type": "doc", "content": []}


def _default_config(fmt: str) -> dict[str, Any]:
    """Fallback template config when no template is selected."""
    base: dict[str, Any] = {
        "font_family": "Times New Roman",
        "font_size": 12,
        "line_spacing": 2.0,
        "margin_top": 1.0,
        "margin_bottom": 1.0,
        "margin_left": 1.0,
        "margin_right": 1.0,
        "scene_separator": "#",
        "page_numbers": True,
        "chapter_break": True,
        "header_text": "",
    }
    if fmt == "epub":
        base.update({"font_family": "Arial", "line_spacing": 1.5, "page_numbers": False})
    elif fmt == "pdf":
        base.update({"font_family": "Georgia", "font_size": 11, "line_spacing": 1.5})
    return base
