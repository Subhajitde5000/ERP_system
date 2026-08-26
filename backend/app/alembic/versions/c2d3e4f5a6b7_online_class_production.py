"""Online class — production hardening.

Adds:
- online_classes.whiteboard_strokes  (JSONB, persisted board state)
- online_class_files.uploader_role   (VARCHAR, enables student uploads)
- online_class_muted_students        (new table — per-class chat mute list)
- idx_notif_user_unread index on notifications

Revision ID: c2d3e4f5a6b7
Revises:     b1c2d3e4f5a6
Create Date: 2026-08-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ── Revision chain ────────────────────────────────────────────────────────────
revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Whiteboard strokes on online_classes
    op.add_column(
        "online_classes",
        sa.Column(
            "whiteboard_strokes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )

    # 2. uploader_role on online_class_files (enables student file sharing)
    op.add_column(
        "online_class_files",
        sa.Column("uploader_role", sa.String(20), nullable=False, server_default="TEACHER"),
    )

    # 3. Muted students table
    op.create_table(
        "online_class_muted_students",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id",  postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id",          ondelete="CASCADE"), nullable=False),
        sa.Column("class_id",   postgresql.UUID(as_uuid=True), sa.ForeignKey("online_classes.id",   ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"),            nullable=False),
        sa.Column("muted_at",   sa.TIMESTAMP(timezone=True),   nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("class_id", "student_id", name="uq_muted__class_student"),
    )
    op.create_index("idx_muted_class", "online_class_muted_students", ["class_id"])

    # 4. Index on notifications for student inbox performance
    op.create_index("idx_notif_user_unread", "notifications", ["user_id", "is_read", "created_at"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_notif_user_unread", table_name="notifications", if_exists=True)

    op.drop_index("idx_muted_class", table_name="online_class_muted_students")
    op.drop_table("online_class_muted_students")

    op.drop_column("online_class_files", "uploader_role")
    op.drop_column("online_classes", "whiteboard_strokes")
