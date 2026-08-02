"""principal academic governance approvals

Adds the explicit, auditable approval states required by C-PR-03 and C-PR-04.
The base schema already owns the academic tables; this migration only adds the
missing workflow columns and query indexes.  It mirrors database/update2.sql
section 9.

Revision ID: c9d3e7f1a602
Revises: b5d9f2e3a417
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c9d3e7f1a602"
down_revision: Union[str, Sequence[str], None] = "b5d9f2e3a417"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    required = {"exams", "result_publications", "users"}
    missing = required - tables
    if missing:
        raise RuntimeError(
            "Principal governance requires the base academic schema; missing "
            + ", ".join(sorted(missing))
        )

    exam_columns = _columns("exams")
    if "schedule_approval_status" not in exam_columns:
        op.add_column("exams", sa.Column("schedule_approval_status", sa.String(20), nullable=True))
    if "schedule_approved_by" not in exam_columns:
        op.add_column(
            "exams",
            sa.Column(
                "schedule_approved_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=True,
            ),
        )
    if "schedule_approved_at" not in exam_columns:
        op.add_column(
            "exams",
            sa.Column("schedule_approved_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        )
    if "schedule_approval_note" not in exam_columns:
        op.add_column("exams", sa.Column("schedule_approval_note", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE exams
           SET schedule_approval_status = CASE
             WHEN status IN ('ONGOING', 'COMPLETED', 'RESULTS_RELEASED') THEN 'APPROVED'
             WHEN status = 'CANCELLED' THEN 'REJECTED'
             ELSE 'PENDING'
           END
         WHERE schedule_approval_status IS NULL
        """
    )
    op.alter_column(
        "exams",
        "schedule_approval_status",
        existing_type=sa.String(20),
        nullable=False,
        server_default=sa.text("'PENDING'"),
    )
    op.execute("ALTER TABLE exams DROP CONSTRAINT IF EXISTS ck_exams_schedule_approval_status")
    op.execute(
        "ALTER TABLE exams ADD CONSTRAINT ck_exams_schedule_approval_status "
        "CHECK (schedule_approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_exams_tenant_schedule_approval "
        "ON exams (tenant_id, schedule_approval_status, scheduled_at)"
    )

    publication_columns = _columns("result_publications")
    if "approval_status" not in publication_columns:
        op.add_column("result_publications", sa.Column("approval_status", sa.String(20), nullable=True))
    if "approved_by" not in publication_columns:
        op.add_column(
            "result_publications",
            sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        )
    if "approved_at" not in publication_columns:
        op.add_column(
            "result_publications",
            sa.Column("approved_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        )
    if "approval_note" not in publication_columns:
        op.add_column("result_publications", sa.Column("approval_note", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE result_publications
           SET approval_status = CASE
             WHEN is_visible_to_students THEN 'APPROVED'
             ELSE 'PENDING'
           END
         WHERE approval_status IS NULL
        """
    )
    op.alter_column(
        "result_publications",
        "approval_status",
        existing_type=sa.String(20),
        nullable=False,
        server_default=sa.text("'PENDING'"),
    )
    op.execute("ALTER TABLE result_publications DROP CONSTRAINT IF EXISTS ck_result_publications_approval_status")
    op.execute(
        "ALTER TABLE result_publications ADD CONSTRAINT ck_result_publications_approval_status "
        "CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_result_publications_tenant_approval "
        "ON result_publications (tenant_id, approval_status, published_at DESC)"
    )


def downgrade() -> None:
    # Reversing a governance workflow destroys decision history.  Alembic's
    # downgrade is therefore intentionally schema-only and should not be used
    # as an operational rollback strategy.
    op.execute("DROP INDEX IF EXISTS idx_exams_tenant_schedule_approval")
    op.execute("DROP INDEX IF EXISTS idx_result_publications_tenant_approval")
    op.execute("ALTER TABLE exams DROP CONSTRAINT IF EXISTS ck_exams_schedule_approval_status")
    op.execute("ALTER TABLE result_publications DROP CONSTRAINT IF EXISTS ck_result_publications_approval_status")
    op.drop_column("exams", "schedule_approval_note")
    op.drop_column("exams", "schedule_approved_at")
    op.drop_column("exams", "schedule_approved_by")
    op.drop_column("exams", "schedule_approval_status")
    op.drop_column("result_publications", "approval_note")
    op.drop_column("result_publications", "approved_at")
    op.drop_column("result_publications", "approved_by")
    op.drop_column("result_publications", "approval_status")
