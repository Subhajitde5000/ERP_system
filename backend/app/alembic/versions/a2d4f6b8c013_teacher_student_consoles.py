"""teacher and student consoles

The Teacher (C-TC-01 … C-TC-22) and Student (C-ST-01 … C-ST-20) consoles read
and write tables that already belong to the base schema in
``database/database.sql`` — questions, answers, milestones, submission files
and reviews, content items, discussion replies and votes, attendance leaves and
the fee ledger. They simply had no ORM model, so this migration creates no new
concepts; it only fills the two gaps that stop the ORM matching the schema:

1. ``assignments`` and ``submissions`` lost several columns when they were
   first modelled (late-submission policy, text response, version). The
   original ``database.sql`` has them; a database built from the Alembic chain
   alone does not.
2. The composite unique key on ``submissions`` that makes a resubmission a new
   *version* rather than an overwrite.

Every step is guarded, so this is safe on a database created from
``database.sql`` (where the columns already exist) and on one built purely
from migrations.

Revision ID: a2d4f6b8c013
Revises: f1c2d3e4a5b6
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a2d4f6b8c013"
down_revision: Union[str, Sequence[str], None] = "f1c2d3e4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def _constraints(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    names = {c["name"] for c in inspector.get_unique_constraints(table)}
    names |= {index["name"] for index in inspector.get_indexes(table)}
    return {name for name in names if name}


def upgrade() -> None:
    tables = _tables()
    required = {"assignments", "submissions"}
    missing = required - tables
    if missing:
        raise RuntimeError(
            "The teacher/student consoles require the base academic schema; missing "
            + ", ".join(sorted(missing))
        )

    # ── 1. assignments: the late-submission and upload policy (§8.1) ────────
    assignment_columns = _columns("assignments")
    if "allow_late_submission" not in assignment_columns:
        op.add_column(
            "assignments",
            sa.Column(
                "allow_late_submission",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    if "late_penalty_percent" not in assignment_columns:
        op.add_column(
            "assignments",
            sa.Column(
                "late_penalty_percent", sa.Integer(), nullable=False, server_default="0"
            ),
        )
    if "max_file_size_mb" not in assignment_columns:
        op.add_column(
            "assignments",
            sa.Column("max_file_size_mb", sa.Integer(), nullable=False, server_default="10"),
        )
    if "allowed_file_types" not in assignment_columns:
        op.add_column(
            "assignments",
            sa.Column(
                "allowed_file_types",
                postgresql.ARRAY(sa.Text()),
                nullable=False,
                server_default=sa.text("'{pdf,doc,docx,zip}'::text[]"),
            ),
        )
    if "instructions_url" not in assignment_columns:
        op.add_column("assignments", sa.Column("instructions_url", sa.Text(), nullable=True))

    # ── 2. submissions: the student's response and the version chain (§8.3) ──
    submission_columns = _columns("submissions")
    if "text_response" not in submission_columns:
        op.add_column("submissions", sa.Column("text_response", sa.Text(), nullable=True))
    if "is_late" not in submission_columns:
        op.add_column(
            "submissions",
            sa.Column("is_late", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "late_by_minutes" not in submission_columns:
        op.add_column("submissions", sa.Column("late_by_minutes", sa.Integer(), nullable=True))
    if "feedback" not in submission_columns:
        op.add_column("submissions", sa.Column("feedback", sa.Text(), nullable=True))
    if "version" not in submission_columns:
        op.add_column(
            "submissions",
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    # A resubmission must create a new row, never overwrite the graded one, so
    # the uniqueness is per (assignment, milestone, student, version).
    # NULLS NOT DISTINCT keeps the guarantee for top-level submissions, where
    # milestone_id is NULL and a plain UNIQUE would let duplicates through.
    if "uq_submissions__assignment_id_milestone_id_student_id_ve" not in _constraints(
        "submissions"
    ):
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS "
            "uq_submissions__assignment_id_milestone_id_student_id_ve "
            "ON submissions (assignment_id, milestone_id, student_id, version) "
            "NULLS NOT DISTINCT"
        )

    # ── 3. Indexes the two consoles rely on ─────────────────────────────────
    # Each supports a query that runs on every page load of a console, and
    # would otherwise be a sequential scan over a tenant-wide table.
    statements = [
        (
            "attendance_leaves",
            "CREATE INDEX IF NOT EXISTS idx_attendance_leaves_tenant_status "
            "ON attendance_leaves (tenant_id, status)",
        ),
        (
            "attendance_leaves",
            "CREATE INDEX IF NOT EXISTS idx_attendance_leaves_student "
            "ON attendance_leaves (student_id, from_date)",
        ),
        (
            "questions",
            "CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions (exam_id, sort_order)",
        ),
        (
            "question_options",
            "CREATE INDEX IF NOT EXISTS idx_question_options_question_id "
            "ON question_options (question_id, sort_order)",
        ),
        (
            "answers",
            "CREATE INDEX IF NOT EXISTS idx_answers_attempt_id ON answers (attempt_id)",
        ),
        (
            "milestones",
            "CREATE INDEX IF NOT EXISTS idx_milestones_assignment_id "
            "ON milestones (assignment_id, sort_order)",
        ),
        (
            "submission_files",
            "CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id "
            "ON submission_files (submission_id)",
        ),
        (
            "submission_reviews",
            "CREATE INDEX IF NOT EXISTS idx_submission_reviews_submission_id "
            "ON submission_reviews (submission_id)",
        ),
        (
            "content_items",
            "CREATE INDEX IF NOT EXISTS idx_content_items_subject "
            "ON content_items (subject_id, chapter, sort_order)",
        ),
        (
            "content_items",
            "CREATE INDEX IF NOT EXISTS idx_content_items_tenant_class "
            "ON content_items (tenant_id, class_id)",
        ),
        (
            "discussion_replies",
            "CREATE INDEX IF NOT EXISTS idx_discussion_replies_thread "
            "ON discussion_replies (thread_id, created_at)",
        ),
        (
            "student_fee_accounts",
            "CREATE INDEX IF NOT EXISTS idx_student_fee_accounts_tenant "
            "ON student_fee_accounts (tenant_id, status)",
        ),
        (
            "fee_installments",
            "CREATE INDEX IF NOT EXISTS idx_fee_installments_account "
            "ON fee_installments (fee_account_id, installment_number)",
        ),
        (
            "fee_payments",
            "CREATE INDEX IF NOT EXISTS idx_fee_payments_student "
            "ON fee_payments (student_id, payment_date)",
        ),
    ]
    for table, statement in statements:
        if table in tables:
            op.execute(statement)


def downgrade() -> None:
    # Only the columns this migration may have added are dropped; the indexes
    # are left in place because dropping one that predates this revision would
    # slow the HOD and Exam Controller consoles for no benefit.
    for table, column in (
        ("submissions", "version"),
        ("submissions", "feedback"),
        ("submissions", "late_by_minutes"),
        ("submissions", "is_late"),
        ("submissions", "text_response"),
        ("assignments", "instructions_url"),
        ("assignments", "allowed_file_types"),
        ("assignments", "max_file_size_mb"),
        ("assignments", "late_penalty_percent"),
        ("assignments", "allow_late_submission"),
    ):
        if column in _columns(table):
            op.drop_column(table, column)
