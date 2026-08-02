"""platform owner accounts

Revision ID: b7e3d2a9c104
Revises: 8a1e4b2c5f01
Create Date: 2026-08-02

Adds the AWS/Shopify-style platform owner account:
- platform_users gains OWNER plus email verification fields
- tenants and checkout orders link back to the owner platform account
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b7e3d2a9c104"
down_revision: Union[str, None] = "8a1e4b2c5f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE platform_role ADD VALUE IF NOT EXISTS 'OWNER'")

    op.add_column(
        "platform_users",
        sa.Column("email_verified_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "platform_users",
        sa.Column("email_verification_token_hash", sa.Text(), nullable=True),
    )

    op.add_column(
        "tenants",
        sa.Column("owner_platform_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tenants_owner_platform_user_id",
        "tenants",
        "platform_users",
        ["owner_platform_user_id"],
        ["id"],
    )
    op.create_index(
        "idx_tenants_owner_platform_user_id", "tenants", ["owner_platform_user_id"]
    )

    op.add_column("orders", sa.Column("owner_name", sa.String(length=255), nullable=True))
    op.add_column("orders", sa.Column("owner_email", sa.String(length=255), nullable=True))
    op.add_column(
        "orders",
        sa.Column("owner_platform_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "idx_orders_owner_platform_user_id", "orders", ["owner_platform_user_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_orders_owner_platform_user_id", table_name="orders")
    op.drop_column("orders", "owner_platform_user_id")
    op.drop_column("orders", "owner_email")
    op.drop_column("orders", "owner_name")

    op.drop_index("idx_tenants_owner_platform_user_id", table_name="tenants")
    op.drop_constraint("fk_tenants_owner_platform_user_id", "tenants", type_="foreignkey")
    op.drop_column("tenants", "owner_platform_user_id")

    op.drop_column("platform_users", "email_verification_token_hash")
    op.drop_column("platform_users", "email_verified_at")
    # PostgreSQL cannot safely remove one enum value without recreating the type.
