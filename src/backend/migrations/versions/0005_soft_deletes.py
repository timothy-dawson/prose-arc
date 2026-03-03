"""Soft delete support for projects and binder_nodes

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # projects — add deleted_at
    op.add_column("projects", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_projects_owner_deleted", "projects", ["owner_id", "deleted_at"])

    # binder_nodes — add deleted_at
    op.add_column("binder_nodes", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_binder_nodes_project_deleted", "binder_nodes", ["project_id", "deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_binder_nodes_project_deleted", table_name="binder_nodes")
    op.drop_column("binder_nodes", "deleted_at")

    op.drop_index("ix_projects_owner_deleted", table_name="projects")
    op.drop_column("projects", "deleted_at")
