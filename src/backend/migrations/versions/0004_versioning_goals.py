"""Versioning and goals module tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # snapshots
    # ------------------------------------------------------------------
    op.create_table(
        "snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("binder_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("snapshot_type", sa.Text(), nullable=False),
        sa.Column("parent_snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("word_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "is_keyframe", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["binder_node_id"], ["binder_nodes.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["parent_snapshot_id"], ["snapshots.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_snapshots_project_id", "snapshots", ["project_id"])
    op.create_index("ix_snapshots_binder_node_id", "snapshots", ["binder_node_id"])

    # ------------------------------------------------------------------
    # snapshot_deltas
    # ------------------------------------------------------------------
    op.create_table(
        "snapshot_deltas",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("binder_node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("delta_gcs_key", sa.Text(), nullable=False),
        sa.Column("delta_size_bytes", sa.Integer(), nullable=False),
        sa.Column("base_snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["snapshot_id"], ["snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["binder_node_id"], ["binder_nodes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["base_snapshot_id"], ["snapshots.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_snapshot_deltas_snapshot_id", "snapshot_deltas", ["snapshot_id"]
    )

    # ------------------------------------------------------------------
    # goals
    # ------------------------------------------------------------------
    op.create_table(
        "goals",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("goal_type", sa.Text(), nullable=False),
        sa.Column("target_words", sa.Integer(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    # ------------------------------------------------------------------
    # writing_sessions
    # ------------------------------------------------------------------
    op.create_table(
        "writing_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "words_written", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "words_deleted", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "net_words", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_writing_sessions_user_project",
        "writing_sessions",
        ["user_id", "project_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_writing_sessions_user_project", table_name="writing_sessions"
    )
    op.drop_table("writing_sessions")
    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")
    op.drop_index(
        "ix_snapshot_deltas_snapshot_id", table_name="snapshot_deltas"
    )
    op.drop_table("snapshot_deltas")
    op.drop_index("ix_snapshots_binder_node_id", table_name="snapshots")
    op.drop_index("ix_snapshots_project_id", table_name="snapshots")
    op.drop_table("snapshots")
