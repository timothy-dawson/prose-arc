"""
Versioning module models — snapshots and delta storage.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import BaseModel

if TYPE_CHECKING:
    from app.modules.manuscript.models import BinderNode, Project


class Snapshot(BaseModel):
    """
    A point-in-time snapshot of a document (or project).

    Every 10th snapshot per node is a keyframe (stores full content).
    Others store a JSON Patch delta relative to the previous snapshot.
    """

    __tablename__ = "snapshots"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    binder_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Optional user-supplied label (only for manual snapshots)
    name: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # 'manual' | 'auto' | 'pre_ai' | 'branch_point' | 'pre_restore'
    snapshot_type: Mapped[str] = mapped_column(Text(), nullable=False)
    # Self-referencing FK to track lineage (informational)
    parent_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )
    word_count: Mapped[int] = mapped_column(
        Integer(), server_default="0", nullable=False
    )
    # True for keyframes (full content stored), False for delta patches
    is_keyframe: Mapped[bool] = mapped_column(
        Boolean(), server_default="false", nullable=False
    )

    # Relationships
    deltas: Mapped[list["SnapshotDelta"]] = relationship(
        "SnapshotDelta",
        foreign_keys="SnapshotDelta.snapshot_id",
        cascade="all, delete-orphan",
        lazy="select",
    )


class SnapshotDelta(BaseModel):
    """
    Storage record for a snapshot's delta (patch) or full content (keyframe).

    For keyframes: delta_gcs_key points to compressed full ProseMirror JSON.
    For non-keyframes: delta_gcs_key points to compressed JSON Patch (RFC 6902).
    """

    __tablename__ = "snapshot_deltas"

    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
    )
    binder_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="CASCADE"),
        nullable=False,
    )
    # MinIO/GCS object key for the compressed content
    delta_gcs_key: Mapped[str] = mapped_column(Text(), nullable=False)
    delta_size_bytes: Mapped[int] = mapped_column(Integer(), nullable=False)
    # For non-keyframes: ID of the previous snapshot this patch applies to
    base_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationship back to snapshot
    snapshot: Mapped["Snapshot"] = relationship(
        "Snapshot",
        foreign_keys=[snapshot_id],
        back_populates="deltas",
    )
