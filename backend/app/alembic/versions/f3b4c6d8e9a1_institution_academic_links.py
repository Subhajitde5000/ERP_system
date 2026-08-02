"""institution academic links — enrollments + teacher_subjects

Revision ID: f3b4c6d8e9a1
Revises: e2a3f5b7c8d0
Create Date: 2026-08-02

Creates the two link tables that already exist in database.sql but had no
Alembic-managed equivalent, so the institution-admin API (enrol a student,
assign a teacher to a subject) had nowhere to write. Mirrors database.sql
§6.5–6.6 exactly.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f3b4c6d8e9a1"
down_revision: Union[str, None] = "e2a3f5b7c8d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("roll_number", sa.String(length=50), nullable=True),
        sa.Column("enrollment_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("transferred_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["academic_year_id"], ["academic_years.id"]),
        sa.ForeignKeyConstraint(["transferred_to"], ["classes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id", "class_id", "academic_year_id",
            name="uq_student_enrollments__student_id_class_id_academic_year_id",
        ),
    )
    op.create_index("idx_student_enrollments_tenant_id", "student_enrollments", ["tenant_id"])
    op.create_index("idx_student_enrollments_class_id", "student_enrollments", ["class_id"])

    op.create_table(
        "teacher_subjects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_in_subject", sa.String(length=50), nullable=False, server_default="TEACHER"),
        sa.Column("assigned_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "teacher_id", "subject_id", "role_in_subject",
            name="uq_teacher_subjects__teacher_id_subject_id_role_in_subject",
        ),
    )
    op.create_index("idx_teacher_subjects_tenant_id", "teacher_subjects", ["tenant_id"])
    op.create_index("idx_teacher_subjects_subject_id", "teacher_subjects", ["subject_id"])


def downgrade() -> None:
    op.drop_table("teacher_subjects")
    op.drop_table("student_enrollments")
