"""
Manuscript module SQLAlchemy models.

Tables: projects, binder_nodes, document_content
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType


class LtreeType(UserDefinedType):
    """
    Minimal SQLAlchemy type for PostgreSQL's ltree extension.

    Using UserDefinedType avoids the ::VARCHAR bind annotation that asyncpg
    emits for sa.Text columns, which PostgreSQL rejects for ltree columns
    (there is no implicit cast from varchar → ltree, but there is from text).
    """

    cache_ok = True

    def get_col_spec(self, **kw: object) -> str:
        return "ltree"

from app.core.db import Base
from app.core.models import BaseModel


class NodeType(str, enum.Enum):
    folder = "folder"
    chapter = "chapter"
    scene = "scene"
    front_matter = "front_matter"
    back_matter = "back_matter"


class Project(BaseModel):
    __tablename__ = "projects"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    series_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    series_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    settings: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    binder_nodes: Mapped[list["BinderNode"]] = relationship(
        "BinderNode", back_populates="project", lazy="select", cascade="all, delete-orphan"
    )


class BinderNode(BaseModel):
    __tablename__ = "binder_nodes"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="CASCADE"),
        nullable=True,
    )
    node_type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(LtreeType, nullable=False)
    synopsis: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", nullable=False
    )
    word_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    project: Mapped["Project"] = relationship("Project", back_populates="binder_nodes")
    children: Mapped[list["BinderNode"]] = relationship(
        "BinderNode",
        back_populates="parent",
        foreign_keys=[parent_id],
        lazy="select",
    )
    parent: Mapped["BinderNode | None"] = relationship(
        "BinderNode",
        back_populates="children",
        foreign_keys=[parent_id],
        remote_side="BinderNode.id",
    )
    document_content: Mapped["DocumentContent | None"] = relationship(
        "DocumentContent", back_populates="binder_node", uselist=False, cascade="all, delete-orphan"
    )


class DocumentContent(Base):
    """
    One-to-one with BinderNode. Not a BaseModel — binder_node_id IS the PK.
    Stores either raw JSONB (< 64KB) or zstd-compressed BYTEA (>= 64KB).
    content_text is always populated for full-text search.
    """

    __tablename__ = "document_content"

    binder_node_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    content_prosemirror: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_compressed: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    binder_node: Mapped["BinderNode"] = relationship(
        "BinderNode", back_populates="document_content"
    )
