import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import BaseModel


class TeamRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)

    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    owned_teams: Mapped[list["Team"]] = relationship("Team", back_populates="owner", lazy="select")
    team_memberships: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="user", lazy="select"
    )


class Team(BaseModel):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="owned_teams", lazy="select")
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", lazy="select", cascade="all, delete-orphan"
    )


class TeamMember(BaseModel):
    __tablename__ = "team_members"

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[TeamRole] = mapped_column(
        Enum(TeamRole, name="team_role"), nullable=False, default=TeamRole.member
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members", lazy="select")
    user: Mapped["User"] = relationship("User", back_populates="team_memberships", lazy="select")


class InviteCode(BaseModel):
    __tablename__ = "invite_codes"

    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    used_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Feedback(BaseModel):
    __tablename__ = "feedback"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)  # bug | feature | general
    message: Mapped[str] = mapped_column(Text, nullable=False)
