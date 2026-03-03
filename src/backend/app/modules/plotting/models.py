"""
Plotting module SQLAlchemy models.

Tables: outlines, beats
"""

import uuid

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import BaseModel


class Outline(BaseModel):
    """A story outline with a template type and free-form structure data."""

    __tablename__ = "outlines"

    project_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    template_type: Mapped[str] = mapped_column(Text, nullable=False)
    structure: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)

    beats: Mapped[list["Beat"]] = relationship(
        "Beat", back_populates="outline", cascade="all, delete-orphan"
    )


class Beat(BaseModel):
    """A single story beat within an outline, optionally linked to a binder node."""

    __tablename__ = "beats"

    outline_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("outlines.id", ondelete="CASCADE"), nullable=False
    )
    binder_node_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("binder_nodes.id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    act: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, server_default="{}", nullable=False
    )

    outline: Mapped["Outline"] = relationship("Outline", back_populates="beats")
