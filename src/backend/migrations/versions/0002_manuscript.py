"""Manuscript module: projects, binder_nodes, document_content

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable ltree extension (requires pg_ltree, included in Postgres by default)
    op.execute("CREATE EXTENSION IF NOT EXISTS ltree")

    # ------------------------------------------------------------------
    # projects
    # ------------------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("series_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("series_order", sa.Integer(), nullable=True),
        sa.Column(
            "settings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("word_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
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
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["series_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    # ------------------------------------------------------------------
    # binder_nodes
    # ------------------------------------------------------------------
    op.create_table(
        "binder_nodes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("node_type", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),  # ltree stored as text; type enforced by DDL
        sa.Column("synopsis", sa.Text(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("word_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
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
        sa.ForeignKeyConstraint(["parent_id"], ["binder_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_binder_nodes_project_id", "binder_nodes", ["project_id"])

    # Change column type to ltree and create GIST index
    op.execute("ALTER TABLE binder_nodes ALTER COLUMN path TYPE ltree USING path::ltree")
    op.execute("CREATE INDEX idx_binder_path ON binder_nodes USING GIST(path)")

    # ------------------------------------------------------------------
    # document_content
    # ------------------------------------------------------------------
    op.create_table(
        "document_content",
        sa.Column("binder_node_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "content_prosemirror",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("content_compressed", sa.LargeBinary(), nullable=True),
        sa.Column("byte_size", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["binder_node_id"], ["binder_nodes.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("binder_node_id"),
    )

    # GIN index for full-text search on content_text
    op.execute(
        """
        CREATE INDEX idx_document_content_fts ON document_content
        USING GIN(to_tsvector('english', coalesce(content_text, '')))
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_document_content_fts")
    op.drop_table("document_content")

    op.execute("DROP INDEX IF EXISTS idx_binder_path")
    op.execute("DROP INDEX IF EXISTS ix_binder_nodes_project_id")
    op.drop_table("binder_nodes")

    op.execute("DROP INDEX IF EXISTS ix_projects_owner_id")
    op.drop_table("projects")

    op.execute("DROP EXTENSION IF EXISTS ltree")
