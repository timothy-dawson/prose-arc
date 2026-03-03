"""
Versioning service — snapshot creation, delta chain management, restore, diff.

Delta strategy:
- Every 10th snapshot per node is a keyframe (stores full ProseMirror JSON, compressed).
- Non-keyframes store a JSON Patch (RFC 6902) relative to the previous snapshot.
- All content compressed with zstandard (level 3) before upload to MinIO/GCS.
- MinIO key format: snapshots/{project_id}/{node_id}/{snapshot_id}.zst

Reconstruction algorithm:
1. Collect all snapshots for the node, ordered by created_at ASC, up to target.
2. Find the most recent keyframe in that list.
3. Download + decompress the keyframe's full content from MinIO.
4. Sequentially apply each non-keyframe JSON Patch from keyframe+1 → target.
"""

import difflib
import json
import uuid
from typing import Any

import jsonpatch
import structlog
import zstandard
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage
from app.modules.manuscript.models import DocumentContent
from app.modules.manuscript.service import _count_words, _extract_text
from app.modules.versioning.models import Snapshot, SnapshotDelta
from app.modules.versioning.schemas import SnapshotDiffResponse, SnapshotRestoreResponse

logger = structlog.get_logger(__name__)


def _extract_paragraphs(pm_doc: dict[str, Any]) -> list[str]:
    """Return one plain-text string per top-level block node in a ProseMirror document."""

    def _walk(node: dict[str, Any], parts: list[str]) -> None:
        if node.get("type") == "text":
            parts.append(node.get("text", ""))
        for child in node.get("content", []):
            _walk(child, parts)

    paragraphs: list[str] = []
    for block in pm_doc.get("content", []):
        parts: list[str] = []
        _walk(block, parts)
        line = "".join(parts).strip()
        if line:
            paragraphs.append(line)
    return paragraphs


class VersioningService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    async def _load_document_content(self, node_id: uuid.UUID) -> dict[str, Any] | None:
        """Load and decompress a document's ProseMirror JSON."""
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

    async def _count_snapshots_for_node(self, binder_node_id: uuid.UUID) -> int:
        result = await self._db.execute(
            select(func.count(Snapshot.id)).where(
                Snapshot.binder_node_id == binder_node_id
            )
        )
        return result.scalar_one()

    async def _get_snapshots_for_node_up_to(
        self, binder_node_id: uuid.UUID, snapshot_id: uuid.UUID
    ) -> list[Snapshot]:
        """Return all snapshots for a node ordered ASC, stopping at (and including) snapshot_id."""
        result = await self._db.execute(
            select(Snapshot)
            .where(Snapshot.binder_node_id == binder_node_id)
            .order_by(Snapshot.created_at)
        )
        all_snapshots = list(result.scalars().all())
        # Truncate to include up to and including the target
        for i, s in enumerate(all_snapshots):
            if s.id == snapshot_id:
                return all_snapshots[: i + 1]
        return all_snapshots  # target not found — shouldn't happen

    async def _get_delta_for_snapshot(self, snapshot_id: uuid.UUID) -> SnapshotDelta:
        result = await self._db.execute(
            select(SnapshotDelta).where(SnapshotDelta.snapshot_id == snapshot_id)
        )
        delta = result.scalar_one_or_none()
        if not delta:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No delta record for snapshot {snapshot_id}",
            )
        return delta

    async def _reconstruct_content(self, snapshot: Snapshot) -> dict[str, Any]:
        """
        Reconstruct ProseMirror content for the given snapshot by walking the delta chain.
        """
        if snapshot.binder_node_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project-level snapshots cannot be reconstructed.",
            )

        storage = get_storage()
        dctx = zstandard.ZstdDecompressor()

        # Collect snapshots up to and including the target
        chain = await self._get_snapshots_for_node_up_to(
            snapshot.binder_node_id, snapshot.id
        )

        # Find the latest keyframe in the chain
        keyframe: Snapshot | None = None
        keyframe_idx = -1
        for i, s in enumerate(chain):
            if s.is_keyframe:
                keyframe = s
                keyframe_idx = i

        if keyframe is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No keyframe found in snapshot chain — data integrity error.",
            )

        # Download and decompress the keyframe's full content
        kf_delta = await self._get_delta_for_snapshot(keyframe.id)
        compressed = await storage.download(kf_delta.delta_gcs_key)
        content: dict[str, Any] = json.loads(dctx.decompress(compressed))

        # Apply all patches from keyframe+1 → target
        for s in chain[keyframe_idx + 1 :]:
            delta = await self._get_delta_for_snapshot(s.id)
            compressed_patch = await storage.download(delta.delta_gcs_key)
            patch_ops = json.loads(dctx.decompress(compressed_patch))
            patch = jsonpatch.JsonPatch(patch_ops)
            content = patch.apply(content)  # type: ignore[assignment]

        return content

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    async def get_project_snapshot(
        self, project_id: uuid.UUID, snapshot_id: uuid.UUID
    ) -> Snapshot:
        snap = await self._db.get(Snapshot, snapshot_id)
        if not snap or snap.project_id != project_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found"
            )
        return snap

    async def list_snapshots(
        self,
        project_id: uuid.UUID,
        binder_node_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Snapshot]:
        stmt = (
            select(Snapshot)
            .where(Snapshot.project_id == project_id)
            .order_by(Snapshot.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if binder_node_id is not None:
            stmt = stmt.where(Snapshot.binder_node_id == binder_node_id)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def create_snapshot(
        self,
        project_id: uuid.UUID,
        binder_node_id: uuid.UUID,
        snapshot_type: str = "manual",
        name: str | None = None,
        skip_if_small: bool = False,
    ) -> Snapshot | None:
        """
        Create a snapshot for the given binder node.

        - Every 10th snapshot is a keyframe (full content).
        - Others store a JSON Patch relative to the previous snapshot.
        - If skip_if_small=True, skips if the patch JSON is < 50 bytes (auto-snapshot mode).
        """
        storage = get_storage()
        cctx = zstandard.ZstdCompressor(level=3)

        # Load current document content
        current_content = await self._load_document_content(binder_node_id)
        if current_content is None:
            logger.warning("snapshot_skip_no_content", node_id=str(binder_node_id))
            return None

        # Determine if this snapshot should be a keyframe
        count = await self._count_snapshots_for_node(binder_node_id)
        is_keyframe = count % 10 == 0

        # Compute word count
        text_content = _extract_text(current_content)
        word_count = _count_words(text_content)

        # For non-keyframes, find the previous snapshot and compute the patch
        prev_snapshot: Snapshot | None = None
        compressed_payload: bytes

        if not is_keyframe:
            prev_result = await self._db.execute(
                select(Snapshot)
                .where(Snapshot.binder_node_id == binder_node_id)
                .order_by(Snapshot.created_at.desc())
                .limit(1)
            )
            prev_snapshot = prev_result.scalar_one_or_none()

            if prev_snapshot is None:
                # No previous snapshot — promote this one to a keyframe
                is_keyframe = True
            else:
                prev_content = await self._reconstruct_content(prev_snapshot)
                patch = jsonpatch.make_patch(prev_content, current_content)
                patch_json = json.dumps(patch.patch)

                # Optionally skip tiny auto-snapshots
                if skip_if_small and len(patch_json.encode()) < 50:
                    logger.debug(
                        "snapshot_skip_small_delta",
                        node_id=str(binder_node_id),
                        delta_bytes=len(patch_json),
                    )
                    return None

                compressed_payload = cctx.compress(patch_json.encode("utf-8"))

        # Keyframe: compress full content
        if is_keyframe:
            content_bytes = json.dumps(current_content).encode("utf-8")
            compressed_payload = cctx.compress(content_bytes)

        # Create snapshot record
        snapshot = Snapshot(
            project_id=project_id,
            binder_node_id=binder_node_id,
            name=name,
            snapshot_type=snapshot_type,
            word_count=word_count,
            is_keyframe=is_keyframe,
        )
        self._db.add(snapshot)
        await self._db.flush()  # assigns snapshot.id

        # Upload compressed payload to MinIO
        key = f"snapshots/{project_id}/{binder_node_id}/{snapshot.id}.zst"
        await storage.upload(key, compressed_payload, "application/octet-stream")

        # Create delta record
        delta = SnapshotDelta(
            snapshot_id=snapshot.id,
            binder_node_id=binder_node_id,
            delta_gcs_key=key,
            delta_size_bytes=len(compressed_payload),
            base_snapshot_id=prev_snapshot.id if prev_snapshot else None,
        )
        self._db.add(delta)
        await self._db.flush()
        await self._db.refresh(snapshot)

        logger.info(
            "snapshot_created",
            snapshot_id=str(snapshot.id),
            type=snapshot_type,
            is_keyframe=is_keyframe,
            node_id=str(binder_node_id),
        )
        return snapshot

    async def restore_snapshot(
        self,
        project_id: uuid.UUID,
        snapshot_id: uuid.UUID,
    ) -> SnapshotRestoreResponse:
        """
        Restore a snapshot. Creates a pre-restore safety snapshot first, then
        replaces the document's current content with the reconstructed snapshot content.
        """
        snap = await self.get_project_snapshot(project_id, snapshot_id)
        if snap.binder_node_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot restore a project-level snapshot.",
            )

        # Create a safety snapshot of current state before overwriting
        pre_restore = await self.create_snapshot(
            project_id=project_id,
            binder_node_id=snap.binder_node_id,
            snapshot_type="pre_restore",
            name=f"Before restore to {snap.created_at.strftime('%Y-%m-%d %H:%M')}",
        )

        # Reconstruct target content
        restored_content = await self._reconstruct_content(snap)

        # Upsert into DocumentContent using the same merge pattern as the manuscript service
        import json as _json

        import zstandard as _zstd

        from app.modules.manuscript.models import DocumentContent

        content_bytes = _json.dumps(restored_content).encode("utf-8")
        byte_size = len(content_bytes)
        _THRESHOLD = 64 * 1024

        if byte_size < _THRESHOLD:
            doc = DocumentContent(
                binder_node_id=snap.binder_node_id,
                content_prosemirror=restored_content,
                content_compressed=None,
                content_text=None,
                byte_size=byte_size,
            )
        else:
            cctx = _zstd.ZstdCompressor(level=3)
            doc = DocumentContent(
                binder_node_id=snap.binder_node_id,
                content_prosemirror=None,
                content_compressed=cctx.compress(content_bytes),
                content_text=None,
                byte_size=byte_size,
            )

        await self._db.merge(doc)
        await self._db.flush()

        logger.info(
            "snapshot_restored",
            snapshot_id=str(snapshot_id),
            node_id=str(snap.binder_node_id),
        )
        return SnapshotRestoreResponse(
            restored_snapshot_id=snap.id,
            word_count=snap.word_count,
            pre_restore_snapshot_id=pre_restore.id if pre_restore else None,
        )

    async def diff_snapshot(
        self,
        project_id: uuid.UUID,
        snapshot_id: uuid.UUID,
        compare_to_id: uuid.UUID | None = None,
    ) -> SnapshotDiffResponse:
        """
        Compute a human-readable diff between a snapshot and another snapshot (or the
        current document). Diffs at the paragraph level using difflib so that additions
        and deletions are readable prose, not raw JSON Patch paths.
        """
        snap_a = await self.get_project_snapshot(project_id, snapshot_id)
        content_a = await self._reconstruct_content(snap_a)

        if compare_to_id is not None:
            snap_b = await self.get_project_snapshot(project_id, compare_to_id)
            content_b = await self._reconstruct_content(snap_b)
        else:
            if snap_a.binder_node_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot diff a project-level snapshot against current.",
                )
            content_b = await self._load_document_content(snap_a.binder_node_id)
            if content_b is None:
                content_b = {}

        lines_a = _extract_paragraphs(content_a)
        lines_b = _extract_paragraphs(content_b)

        matcher = difflib.SequenceMatcher(None, lines_a, lines_b, autojunk=False)
        additions: list[str] = []
        deletions: list[str] = []
        changed_blocks = 0
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                continue
            changed_blocks += 1
            if tag in ("replace", "delete"):
                deletions.extend(lines_a[i1:i2])
            if tag in ("replace", "insert"):
                additions.extend(lines_b[j1:j2])

        return SnapshotDiffResponse(
            snapshot_id=snap_a.id,
            compare_to_id=compare_to_id,
            additions=additions[:100],
            deletions=deletions[:100],
            changes_count=changed_blocks,
        )

    async def delete_snapshot(
        self, project_id: uuid.UUID, snapshot_id: uuid.UUID
    ) -> None:
        """Delete a snapshot and its MinIO object."""
        snap = await self.get_project_snapshot(project_id, snapshot_id)
        storage = get_storage()

        # Delete all delta objects from MinIO
        result = await self._db.execute(
            select(SnapshotDelta).where(SnapshotDelta.snapshot_id == snapshot_id)
        )
        for delta in result.scalars().all():
            try:
                await storage.delete(delta.delta_gcs_key)
            except Exception:
                logger.warning("snapshot_delete_gcs_error", key=delta.delta_gcs_key)

        await self._db.delete(snap)
        await self._db.flush()
        logger.info("snapshot_deleted", snapshot_id=str(snapshot_id))
