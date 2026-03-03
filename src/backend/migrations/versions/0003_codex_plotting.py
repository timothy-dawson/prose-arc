"""Codex and plotting module tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # codex_entries
    # ------------------------------------------------------------------
    op.create_table(
        "codex_entries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_type", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "content",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("image_url", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_codex_entries_project_id", "codex_entries", ["project_id"])

    # ------------------------------------------------------------------
    # codex_links  (composite PK — no id column)
    # ------------------------------------------------------------------
    op.create_table(
        "codex_links",
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("link_type", sa.Text(), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["source_id"], ["codex_entries.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_id"], ["codex_entries.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("source_id", "target_id"),
    )

    # ------------------------------------------------------------------
    # codex_mentions  (composite PK — no id column)
    # ------------------------------------------------------------------
    op.create_table(
        "codex_mentions",
        sa.Column("binder_node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("codex_entry_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["binder_node_id"], ["binder_nodes.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["codex_entry_id"], ["codex_entries.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("binder_node_id", "codex_entry_id"),
    )

    # ------------------------------------------------------------------
    # outlines
    # ------------------------------------------------------------------
    op.create_table(
        "outlines",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("template_type", sa.Text(), nullable=False),
        sa.Column(
            "structure",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outlines_project_id", "outlines", ["project_id"])

    # ------------------------------------------------------------------
    # beats
    # ------------------------------------------------------------------
    op.create_table(
        "beats",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("outline_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("binder_node_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("act", sa.Integer(), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
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
        sa.ForeignKeyConstraint(["outline_id"], ["outlines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["binder_node_id"], ["binder_nodes.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_beats_outline_id", "beats", ["outline_id"])


def downgrade() -> None:
    op.drop_index("ix_beats_outline_id", table_name="beats")
    op.drop_table("beats")
    op.drop_index("ix_outlines_project_id", table_name="outlines")
    op.drop_table("outlines")
    op.drop_table("codex_mentions")
    op.drop_table("codex_links")
    op.drop_index("ix_codex_entries_project_id", table_name="codex_entries")
    op.drop_table("codex_entries")
