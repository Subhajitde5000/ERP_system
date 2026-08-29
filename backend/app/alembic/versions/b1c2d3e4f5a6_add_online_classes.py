"""Add online classes tables and enums.

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-08-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enum Types ────────────────────────────────────────────────────────────
    status_enum = postgresql.ENUM("SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", name="online_class_status", create_type=False)
    status_enum.create(op.get_bind(), checkfirst=True)

    mode_enum = postgresql.ENUM("SCHEDULED", "INSTANT", name="online_class_mode", create_type=False)
    mode_enum.create(op.get_bind(), checkfirst=True)

    attendance_status_enum = postgresql.ENUM("PRESENT", "LATE", "ABSENT", name="online_attendance_status", create_type=False)
    attendance_status_enum.create(op.get_bind(), checkfirst=True)

    # ── Table: online_classes ──────────────────────────────────────────────────
    op.create_table(
        "online_classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id"), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("timetable_slot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("mode", mode_enum, nullable=False, server_default="SCHEDULED"),
        sa.Column("status", status_enum, nullable=False, server_default="SCHEDULED"),
        sa.Column("scheduled_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("allow_join", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("recording_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("recording_url", sa.Text(), nullable=True),
        sa.Column("started_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("ended_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("attendance_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("attendance_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_online_classes_tenant_status", "online_classes", ["tenant_id", "status", "scheduled_at"])
    op.create_index("idx_online_classes_teacher", "online_classes", ["teacher_id", "created_at"])
    op.create_index("idx_online_classes_class", "online_classes", ["class_id", "scheduled_at"])

    # ── Table: online_class_participants ──────────────────────────────────────
    op.create_table(
        "online_class_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("waiting_since", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("joined_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("left_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attendance_status", attendance_status_enum, nullable=True),
        sa.Column("hand_raised_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default="false"),
        sa.UniqueConstraint("class_id", "student_id", name="uq_online_class_participants__class_id_student_id"),
    )
    op.create_index("idx_online_class_participants_class", "online_class_participants", ["class_id"])
    op.create_index("idx_online_class_participants_student", "online_class_participants", ["student_id"])

    # ── Table: online_class_messages ──────────────────────────────────────────
    op.create_table(
        "online_class_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("sender_role", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_online_class_messages_class", "online_class_messages", ["class_id", "created_at"])

    # ── Table: online_class_files ─────────────────────────────────────────────
    op.create_table(
        "online_class_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("online_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("mime_type", sa.String(length=100), nullable=False, server_default="application/octet-stream"),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_online_class_files_class", "online_class_files", ["class_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_online_class_files_class", table_name="online_class_files")
    op.drop_table("online_class_files")

    op.drop_index("idx_online_class_messages_class", table_name="online_class_messages")
    op.drop_table("online_class_messages")

    op.drop_index("idx_online_class_participants_student", table_name="online_class_participants")
    op.drop_index("idx_online_class_participants_class", table_name="online_class_participants")
    op.drop_table("online_class_participants")

    op.drop_index("idx_online_classes_class", table_name="online_classes")
    op.drop_index("idx_online_classes_teacher", table_name="online_classes")
    op.drop_index("idx_online_classes_tenant_status", table_name="online_classes")
    op.drop_table("online_classes")

    op.execute("DROP TYPE IF EXISTS online_attendance_status")
    op.execute("DROP TYPE IF EXISTS online_class_mode")
    op.execute("DROP TYPE IF EXISTS online_class_status")
