"""Add external links and timestamps to notice attachments.

Revision ID: a9b8c7d6e5f4
Revises: f3a4b5c6d7e8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("notice_attachments", "file_key", existing_type=sa.Text(), nullable=True)
    op.alter_column("notice_attachments", "file_size_bytes", existing_type=sa.BigInteger(), server_default="0")
    op.add_column("notice_attachments", sa.Column("external_url", sa.Text(), nullable=True))
    op.add_column("notice_attachments", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False))
    op.create_check_constraint(
        "chk_notice_attachment_source", "notice_attachments",
        "(file_key IS NOT NULL AND external_url IS NULL) OR (file_key IS NULL AND external_url IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("chk_notice_attachment_source", "notice_attachments", type_="check")
    op.drop_column("notice_attachments", "created_at")
    op.drop_column("notice_attachments", "external_url")
    op.alter_column("notice_attachments", "file_size_bytes", existing_type=sa.BigInteger(), server_default=None)
    op.alter_column("notice_attachments", "file_key", existing_type=sa.Text(), nullable=False)
