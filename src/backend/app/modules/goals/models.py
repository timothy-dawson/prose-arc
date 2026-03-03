"""
Goals module models — writing goals and session tracking.
"""

import datetime
import uuid

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Goal(BaseModel):
    """
    A writing goal set by the user.

    goal_type: 'daily' | 'project' | 'session'
    project_id: NULL for user-global daily goals; set for project-specific goals.
    """

    __tablename__ = "goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
    )
    goal_type: Mapped[str] = mapped_column(Text(), nullable=False)
    target_words: Mapped[int] = mapped_column(Integer(), nullable=False)
    deadline: Mapped[datetime.date | None] = mapped_column(Date(), nullable=True)


class WritingSession(BaseModel):
    """
    A tracked writing session.

    Starts on first editor keystroke, ends on inactivity or explicit end.
    """

    __tablename__ = "writing_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    words_written: Mapped[int] = mapped_column(
        Integer(), server_default="0", nullable=False
    )
    words_deleted: Mapped[int] = mapped_column(
        Integer(), server_default="0", nullable=False
    )
    net_words: Mapped[int] = mapped_column(
        Integer(), server_default="0", nullable=False
    )
