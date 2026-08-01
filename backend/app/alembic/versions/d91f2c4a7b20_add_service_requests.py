"""add service requests

Revision ID: d91f2c4a7b20
Revises: c6bcf3efa755
Create Date: 2026-08-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "d91f2c4a7b20"
down_revision: Union[str, None] = "c6bcf3efa755"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contact_name", sa.String(length=100), nullable=False),
        sa.Column("institution_name", sa.String(length=255), nullable=False),
        sa.Column("work_email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("institution_type", sa.String(length=20), nullable=False),
        sa.Column("student_count", sa.Integer(), nullable=True),
        sa.Column("service_interest", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default=sa.text("'NEW'"), nullable=False),
        sa.Column("source", sa.String(length=100), server_default=sa.text("'website'"), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("student_count IS NULL OR student_count > 0", name="ck_service_requests_student_count"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_service_requests_status_created_at", "service_requests", ["status", "created_at"])
    op.create_index("idx_service_requests_work_email", "service_requests", ["work_email"])


def downgrade() -> None:
    op.drop_index("idx_service_requests_work_email", table_name="service_requests")
    op.drop_index("idx_service_requests_status_created_at", table_name="service_requests")
    op.drop_table("service_requests")
