"""
Codex module SQLAlchemy models.

Tables: codex_entries, codex_links, codex_mentions
"""

import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.models import BaseModel


class CodexEntry(BaseModel):
    """A worldbuilding reference entry (character, location, item, lore, custom)."""

    __tablename__ = "codex_entries"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    entry_type: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default="{}", nullable=False
    )
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    links_out: Mapped[list["CodexLink"]] = relationship(
        "CodexLink",
        foreign_keys="[CodexLink.source_id]",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    links_in: Mapped[list["CodexLink"]] = relationship(
        "CodexLink",
        foreign_keys="[CodexLink.target_id]",
        back_populates="target",
        cascade="all, delete-orphan",
    )
    mentions: Mapped[list["CodexMention"]] = relationship(
        "CodexMention",
        back_populates="codex_entry",
        cascade="all, delete-orphan",
    )


class CodexLink(Base):
    """
    Directional link between two codex entries.
    Composite PK (source_id, target_id) — not a BaseModel.
    """

    __tablename__ = "codex_links"

    source_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("codex_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("codex_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    link_type: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", nullable=False
    )

    source: Mapped["CodexEntry"] = relationship(
        "CodexEntry", foreign_keys=[source_id], back_populates="links_out"
    )
    target: Mapped["CodexEntry"] = relationship(
        "CodexEntry", foreign_keys=[target_id], back_populates="links_in"
    )


class CodexMention(Base):
    """
    Cross-reference: which binder nodes mention which codex entries.
    Composite PK (binder_node_id, codex_entry_id) — not a BaseModel.
    """

    __tablename__ = "codex_mentions"

    binder_node_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    codex_entry_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("codex_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )

    codex_entry: Mapped["CodexEntry"] = relationship(
        "CodexEntry", back_populates="mentions"
    )
