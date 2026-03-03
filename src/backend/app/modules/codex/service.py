"""
Codex service — business logic for worldbuilding entries, links, mentions, and image upload.
"""

import hashlib
import uuid
from typing import Any

import structlog
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage
from app.modules.codex.models import CodexEntry, CodexLink, CodexMention
from app.modules.codex.schemas import (
    CodexEntryCreate,
    CodexEntryUpdate,
    CodexLinksResponse,
    CodexLinkRead,
)

logger = structlog.get_logger(__name__)


class CodexService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Entries
    # -------------------------------------------------------------------------

    async def create_entry(
        self, project_id: uuid.UUID, data: CodexEntryCreate
    ) -> CodexEntry:
        entry = CodexEntry(
            project_id=project_id,
            entry_type=data.entry_type,
            name=data.name,
            summary=data.summary,
            content=data.content,
            tags=data.tags,
            image_url=data.image_url,
        )
        self._db.add(entry)
        await self._db.flush()
        logger.info("codex_entry_created", entry_id=str(entry.id), entry_type=entry.entry_type)
        return entry

    async def list_entries(
        self,
        project_id: uuid.UUID,
        entry_type: str | None = None,
        search: str | None = None,
        tags: list[str] | None = None,
    ) -> list[CodexEntry]:
        stmt = select(CodexEntry).where(CodexEntry.project_id == project_id)
        if entry_type:
            stmt = stmt.where(CodexEntry.entry_type == entry_type)
        if search:
            stmt = stmt.where(CodexEntry.name.ilike(f"%{search}%"))
        if tags:
            # entries must have ALL requested tags (overlap: has any)
            stmt = stmt.where(CodexEntry.tags.overlap(tags))  # type: ignore[attr-defined]
        stmt = stmt.order_by(CodexEntry.name)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def get_entry(self, entry_id: uuid.UUID, project_id: uuid.UUID) -> CodexEntry:
        entry = await self._db.get(CodexEntry, entry_id)
        if not entry or entry.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Codex entry not found")
        return entry

    async def update_entry(self, entry: CodexEntry, data: CodexEntryUpdate) -> CodexEntry:
        if data.name is not None:
            entry.name = data.name
        if data.summary is not None:
            entry.summary = data.summary
        if data.content is not None:
            entry.content = data.content
        if data.tags is not None:
            entry.tags = data.tags
        if data.image_url is not None:
            entry.image_url = data.image_url
        await self._db.flush()
        # Refresh to pull server-computed updated_at back into memory so Pydantic
        # can read it synchronously without triggering a lazy load (MissingGreenlet).
        await self._db.refresh(entry)
        return entry

    async def delete_entry(self, entry: CodexEntry) -> None:
        await self._db.delete(entry)
        await self._db.flush()
        logger.info("codex_entry_deleted", entry_id=str(entry.id))

    # -------------------------------------------------------------------------
    # Links
    # -------------------------------------------------------------------------

    async def create_link(
        self,
        project_id: uuid.UUID,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        link_type: str,
        metadata: dict[str, Any] | None = None,
    ) -> CodexLink:
        # Validate both entries belong to the same project
        source = await self.get_entry(source_id, project_id)
        target = await self.get_entry(target_id, project_id)

        # Check for existing link
        existing = await self._db.get(CodexLink, (source.id, target.id))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Link already exists"
            )

        link = CodexLink(
            source_id=source_id,
            target_id=target_id,
            link_type=link_type,
            metadata_=metadata or {},
        )
        self._db.add(link)
        await self._db.flush()
        return link

    async def delete_link(self, source_id: uuid.UUID, target_id: uuid.UUID) -> None:
        link = await self._db.get(CodexLink, (source_id, target_id))
        if not link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
        await self._db.delete(link)
        await self._db.flush()

    async def get_links(self, entry_id: uuid.UUID) -> CodexLinksResponse:
        out_result = await self._db.execute(
            select(CodexLink).where(CodexLink.source_id == entry_id)
        )
        in_result = await self._db.execute(
            select(CodexLink).where(CodexLink.target_id == entry_id)
        )
        outgoing = [CodexLinkRead.model_validate(l) for l in out_result.scalars().all()]
        incoming = [CodexLinkRead.model_validate(l) for l in in_result.scalars().all()]
        return CodexLinksResponse(outgoing=outgoing, incoming=incoming)

    # -------------------------------------------------------------------------
    # Mentions
    # -------------------------------------------------------------------------

    async def sync_mentions(
        self, binder_node_id: uuid.UUID, entry_ids: list[uuid.UUID]
    ) -> None:
        """Replace all mentions for a binder node with the given set of entry IDs."""
        # Delete existing
        await self._db.execute(
            delete(CodexMention).where(CodexMention.binder_node_id == binder_node_id)
        )
        # Insert new set (deduplicated)
        seen: set[uuid.UUID] = set()
        for entry_id in entry_ids:
            if entry_id not in seen:
                self._db.add(
                    CodexMention(binder_node_id=binder_node_id, codex_entry_id=entry_id)
                )
                seen.add(entry_id)
        await self._db.flush()

    async def get_mentions_for_entry(self, entry_id: uuid.UUID) -> list[CodexMention]:
        result = await self._db.execute(
            select(CodexMention).where(CodexMention.codex_entry_id == entry_id)
        )
        return list(result.scalars().all())

    async def get_mentions_for_node(self, binder_node_id: uuid.UUID) -> list[CodexMention]:
        result = await self._db.execute(
            select(CodexMention).where(CodexMention.binder_node_id == binder_node_id)
        )
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Image upload
    # -------------------------------------------------------------------------

    async def upload_image(
        self, entry: CodexEntry, file_bytes: bytes, content_type: str
    ) -> str:
        sha256 = hashlib.sha256(file_bytes).hexdigest()

        # Derive extension from content_type (image/png → png, image/jpeg → jpg)
        ext_map = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}
        ext = ext_map.get(content_type, "bin")
        key = f"codex/{entry.project_id}/images/{sha256}.{ext}"

        storage = get_storage()
        try:
            # Try to download — if it exists, skip upload (dedup)
            await storage.download(key)
        except Exception:
            await storage.upload(key, file_bytes, content_type)

        url = await storage.signed_url(key, expires=365 * 24 * 3600)  # 1-year signed URL
        entry.image_url = url
        await self._db.flush()
        await self._db.refresh(entry)
        logger.info("codex_image_uploaded", entry_id=str(entry.id), key=key)
        return url
