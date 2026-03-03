"""Export jobs/templates, subscriptions, and notifications tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── export_templates ────────────────────────────────────────────────────
    op.create_table(
        "export_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("format", sa.String(length=10), nullable=False),  # docx | pdf | epub
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_export_templates_format", "export_templates", ["format"])

    # Seed 3 default templates
    op.execute("""
        INSERT INTO export_templates (id, name, format, config, is_default) VALUES
        (
            gen_random_uuid(),
            'Manuscript Submission',
            'docx',
            '{
                "font_family": "Times New Roman",
                "font_size": 12,
                "line_spacing": 2.0,
                "margin_top": 1.0,
                "margin_bottom": 1.0,
                "margin_left": 1.0,
                "margin_right": 1.0,
                "scene_separator": "#",
                "header_text": "{title}",
                "page_numbers": true,
                "chapter_break": true
            }',
            true
        ),
        (
            gen_random_uuid(),
            'Paperback',
            'pdf',
            '{
                "font_family": "Georgia",
                "font_size": 11,
                "line_spacing": 1.5,
                "margin_top": 0.75,
                "margin_bottom": 0.75,
                "margin_left": 0.75,
                "margin_right": 0.75,
                "scene_separator": "* * *",
                "header_text": "{title}",
                "page_numbers": true,
                "chapter_break": true
            }',
            true
        ),
        (
            gen_random_uuid(),
            'Ebook',
            'epub',
            '{
                "font_family": "Arial",
                "font_size": 12,
                "line_spacing": 1.5,
                "margin_top": 0.5,
                "margin_bottom": 0.5,
                "margin_left": 0.5,
                "margin_right": 0.5,
                "scene_separator": "* * *",
                "header_text": "",
                "page_numbers": false,
                "chapter_break": true
            }',
            true
        )
    """)

    # ── export_jobs ──────────────────────────────────────────────────────────
    op.create_table(
        "export_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", sa.String(length=10), nullable=False),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("export_templates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("scope", JSONB, nullable=False, server_default='{"type": "full"}'),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="'pending'"),
        sa.Column("gcs_key", sa.String(length=500), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_export_jobs_user_status", "export_jobs", ["user_id", "status"])
    op.create_index("ix_export_jobs_project", "export_jobs", ["project_id"])
    op.create_index("ix_export_jobs_expires_at", "export_jobs", ["expires_at"])

    # ── subscriptions ────────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("plan", sa.String(length=20), nullable=False, server_default="'free'"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="'active'"),
        sa.Column("purchased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_stripe_customer", "subscriptions", ["stripe_customer_id"])

    # ── notifications ────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("data", JSONB, nullable=False, server_default="{}"),
        sa.Column("read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    # ── notification_preferences ─────────────────────────────────────────────
    op.create_table(
        "notification_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.UniqueConstraint("user_id", "type", name="uq_notification_preferences_user_type"),
    )
    op.create_index("ix_notification_preferences_user", "notification_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_table("notification_preferences")
    op.drop_table("notifications")
    op.drop_table("subscriptions")
    op.drop_table("export_jobs")
    op.drop_table("export_templates")
