"""
Manuscript service — all business logic for projects, binder trees, and document content.

Handles:
- Project CRUD
- Binder node CRUD + ltree path management
- Document content save (with conditional zstd compression) and load
- Full-text search via Postgres tsvector
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
import zstandard
from fastapi import HTTPException, status
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import bus
from app.modules.manuscript.models import BinderNode, DocumentContent, Project
from app.modules.manuscript.schemas import (
    BinderNodeCreate,
    BinderNodeUpdate,
    BinderReorderRequest,
    DocumentSave,
    ProjectCreate,
    ProjectUpdate,
    SearchResult,
)

logger = structlog.get_logger(__name__)

_COMPRESSION_THRESHOLD = 64 * 1024  # 64 KB


def _extract_text(pm_doc: dict[str, Any]) -> str:
    """Recursively walk a ProseMirror document and collect all text leaf values."""
    parts: list[str] = []

    def _walk(node: dict[str, Any]) -> None:
        if node.get("type") == "text":
            parts.append(node.get("text", ""))
        for child in node.get("content", []):
            _walk(child)

    _walk(pm_doc)
    return " ".join(parts)


def _count_words(text_content: str) -> int:
    return len(text_content.split()) if text_content.strip() else 0


def _node_label(node_id: uuid.UUID) -> str:
    """Convert UUID to an ltree-compatible label (replace hyphens with underscores)."""
    return str(node_id).replace("-", "_")


class ManuscriptService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Projects
    # -------------------------------------------------------------------------

    async def create_project(self, owner_id: uuid.UUID, data: ProjectCreate) -> Project:
        project = Project(
            owner_id=owner_id,
            title=data.title,
            settings=data.settings,
        )
        self._db.add(project)
        await self._db.flush()
        logger.info("project_created", project_id=str(project.id), owner_id=str(owner_id))
        return project

    async def list_projects(self, owner_id: uuid.UUID, include_deleted: bool = False) -> list[Project]:
        stmt = select(Project).where(Project.owner_id == owner_id)
        if not include_deleted:
            stmt = stmt.where(Project.deleted_at.is_(None))
        stmt = stmt.order_by(Project.updated_at.desc())
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get_project(self, project_id: uuid.UUID, owner_id: uuid.UUID) -> Project:
        project = await self._db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        self._assert_owner(project.owner_id, owner_id)
        return project

    async def update_project(self, project: Project, data: ProjectUpdate) -> Project:
        if data.title is not None:
            project.title = data.title
        if data.settings is not None:
            project.settings = data.settings
        await self._db.flush()
        await self._db.refresh(project)
        return project

    async def delete_project(self, project: Project) -> None:
        project.deleted_at = datetime.now(timezone.utc)
        await self._db.flush()
        logger.info("project_soft_deleted", project_id=str(project.id))

    async def restore_project(self, project_id: uuid.UUID, owner_id: uuid.UUID) -> Project:
        project = await self._db.get(Project, project_id)
        if not project or project.owner_id != owner_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        project.deleted_at = None
        await self._db.flush()
        await self._db.refresh(project)
        logger.info("project_restored", project_id=str(project_id))
        return project

    # -------------------------------------------------------------------------
    # Binder nodes
    # -------------------------------------------------------------------------

    async def create_binder_node(
        self, project_id: uuid.UUID, data: BinderNodeCreate
    ) -> BinderNode:
        parent_path: str | None = None
        if data.parent_id:
            parent = await self._db.get(BinderNode, data.parent_id)
            if not parent or parent.project_id != project_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Parent node not found"
                )
            parent_path = parent.path

        # Flush to get the UUID assigned before we need it for path
        node = BinderNode(
            project_id=project_id,
            parent_id=data.parent_id,
            node_type=data.node_type,
            title=data.title,
            sort_order=data.sort_order,
            path="placeholder",  # will be updated below
        )
        self._db.add(node)
        await self._db.flush()  # assigns node.id

        label = _node_label(node.id)
        node.path = f"{parent_path}.{label}" if parent_path else label
        await self._db.flush()
        await self._db.refresh(node)  # reload server-updated fields (updated_at, etc.)

        logger.info("binder_node_created", node_id=str(node.id), project_id=str(project_id))
        return node

    async def get_binder_tree(self, project_id: uuid.UUID, include_deleted: bool = False) -> list[BinderNode]:
        stmt = select(BinderNode).where(BinderNode.project_id == project_id)
        if not include_deleted:
            stmt = stmt.where(BinderNode.deleted_at.is_(None))
        stmt = stmt.order_by(text("path"), BinderNode.sort_order)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def update_binder_node(
        self, node: BinderNode, data: BinderNodeUpdate
    ) -> BinderNode:
        if data.title is not None:
            node.title = data.title
        if data.synopsis is not None:
            node.synopsis = data.synopsis
        if data.metadata_ is not None:
            node.metadata_ = data.metadata_
        if data.sort_order is not None:
            node.sort_order = data.sort_order

        if data.parent_id is not None and data.parent_id != node.parent_id:
            await self._reparent_node(node, data.parent_id)

        await self._db.flush()
        await self._db.refresh(node)  # reload server-updated fields (updated_at, etc.)
        return node

    async def delete_binder_node(self, node: BinderNode) -> None:
        now = datetime.now(timezone.utc)
        # Soft-delete the node and all its descendants via ltree path prefix match
        await self._db.execute(
            update(BinderNode)
            .where(BinderNode.project_id == node.project_id)
            .where(BinderNode.deleted_at.is_(None))
            .where(text(f"path <@ '{node.path}'::ltree"))
            .values(deleted_at=now)
        )
        await self._db.flush()
        logger.info("binder_node_soft_deleted", node_id=str(node.id))

    async def restore_binder_node(self, project_id: uuid.UUID, node_id: uuid.UUID) -> BinderNode:
        node = await self._db.get(BinderNode, node_id)
        if not node or node.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found")
        node.deleted_at = None
        await self._db.flush()
        await self._db.refresh(node)
        logger.info("binder_node_restored", node_id=str(node_id))
        return node

    async def bulk_reorder(
        self, project_id: uuid.UUID, data: BinderReorderRequest
    ) -> None:
        for item in data.nodes:
            node = await self._db.get(BinderNode, item.node_id)
            if not node or node.project_id != project_id:
                continue

            # Compute new path
            if item.parent_id:
                parent = await self._db.get(BinderNode, item.parent_id)
                new_path = (
                    f"{parent.path}.{_node_label(node.id)}" if parent else _node_label(node.id)
                )
            else:
                new_path = _node_label(node.id)

            old_path = node.path
            node.parent_id = item.parent_id
            node.sort_order = item.sort_order
            node.path = new_path

            # Update descendant paths if path changed
            if old_path != new_path:
                await self._update_descendant_paths(project_id, old_path, new_path)

        await self._db.flush()

    # -------------------------------------------------------------------------
    # Documents
    # -------------------------------------------------------------------------

    async def save_document(
        self, project_id: uuid.UUID, node_id: uuid.UUID, data: DocumentSave
    ) -> DocumentContent:
        content_bytes = json.dumps(data.content).encode("utf-8")
        byte_size = len(content_bytes)

        content_prosemirror: dict[str, Any] | None = None
        content_compressed: bytes | None = None

        if byte_size < _COMPRESSION_THRESHOLD:
            content_prosemirror = data.content
        else:
            cctx = zstandard.ZstdCompressor(level=3)
            content_compressed = cctx.compress(content_bytes)

        plain_text = _extract_text(data.content)
        word_count = _count_words(plain_text)

        # Upsert via merge
        doc = DocumentContent(
            binder_node_id=node_id,
            content_prosemirror=content_prosemirror,
            content_compressed=content_compressed,
            content_text=plain_text or None,
            byte_size=byte_size,
        )
        merged = await self._db.merge(doc)
        await self._db.flush()

        # Update binder node word count synchronously so the API response
        # immediately reflects the new count (Celery only handles project total).
        await self._db.execute(
            update(BinderNode)
            .where(BinderNode.id == node_id)
            .values(word_count=word_count)
        )
        await self._db.flush()

        # Enqueue async tasks (import here to avoid circular at module level)
        from app.tasks.manuscript_tasks import reindex_search, update_word_counts

        update_word_counts.delay(str(project_id), str(node_id))
        reindex_search.delay(str(project_id), str(node_id))

        bus.publish(
            "document.saved",
            {
                "project_id": str(project_id),
                "node_id": str(node_id),
                "word_count": word_count,
            },
        )
        logger.info("document_saved", node_id=str(node_id), byte_size=byte_size)
        return merged

    async def load_document(self, node_id: uuid.UUID) -> dict[str, Any] | None:
        doc = await self._db.get(DocumentContent, node_id)
        if not doc:
            return None

        if doc.content_prosemirror is not None:
            return doc.content_prosemirror  # type: ignore[return-value]

        if doc.content_compressed is not None:
            dctx = zstandard.ZstdDecompressor()
            raw = dctx.decompress(doc.content_compressed)
            return json.loads(raw)  # type: ignore[return-value]

        return None

    async def get_document_record(self, node_id: uuid.UUID) -> DocumentContent | None:
        return await self._db.get(DocumentContent, node_id)

    # -------------------------------------------------------------------------
    # Search
    # -------------------------------------------------------------------------

    async def search_project(
        self, project_id: uuid.UUID, q: str
    ) -> list[SearchResult]:
        stmt = text(
            """
            SELECT
                bn.id          AS node_id,
                bn.title       AS title,
                bn.node_type   AS node_type,
                ts_headline(
                    'english',
                    coalesce(dc.content_text, ''),
                    plainto_tsquery('english', :q)
                )              AS snippet
            FROM document_content dc
            JOIN binder_nodes bn ON bn.id = dc.binder_node_id
            WHERE bn.project_id = :project_id
              AND to_tsvector('english', coalesce(dc.content_text, ''))
                  @@ plainto_tsquery('english', :q)
            LIMIT 20
            """
        )
        rows = await self._db.execute(stmt, {"project_id": project_id, "q": q})
        return [
            SearchResult(
                node_id=row.node_id,
                title=row.title,
                snippet=row.snippet or "",
                node_type=row.node_type,
            )
            for row in rows
        ]

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _assert_owner(self, project_owner_id: uuid.UUID, requesting_user_id: uuid.UUID) -> None:
        if project_owner_id != requesting_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this project",
            )

    async def _reparent_node(self, node: BinderNode, new_parent_id: uuid.UUID) -> None:
        new_parent = await self._db.get(BinderNode, new_parent_id)
        if not new_parent or new_parent.project_id != node.project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="New parent node not found"
            )
        old_path = node.path
        new_path = f"{new_parent.path}.{_node_label(node.id)}"
        node.parent_id = new_parent_id
        node.path = new_path
        await self._update_descendant_paths(node.project_id, old_path, new_path)

    async def _update_descendant_paths(
        self, project_id: uuid.UUID, old_prefix: str, new_prefix: str
    ) -> None:
        """Update paths of all descendants when a node is moved."""
        # Use raw SQL with ltree subpath replacement
        # Use CAST(... AS ltree) instead of ::ltree because SQLAlchemy's text()
        # parameter parser mis-handles :param_name::type (double-colon cast).
        stmt = text(
            """
            UPDATE binder_nodes
            SET path = CAST(
                :new_prefix || '.' || subpath(path, nlevel(CAST(:old_prefix AS ltree)))::text
                AS ltree
            )
            WHERE project_id = :project_id
              AND path <@ CAST(:old_prefix AS ltree)
              AND id != (
                  SELECT id FROM binder_nodes
                  WHERE path = CAST(:old_prefix AS ltree) AND project_id = :project_id
                  LIMIT 1
              )
            """
        )
        await self._db.execute(
            stmt,
            {
                "old_prefix": old_prefix,
                "new_prefix": new_prefix,
                "project_id": project_id,
            },
        )
