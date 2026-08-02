"""platform_owners — customer accounts that own many institutions

Revision ID: e2a3f5b7c8d0
Revises: 8a1e4b2c5f01
Create Date: 2026-08-02

Introduces the AWS / Shopify / Zoho "account-holder" model:

  platform_owners          — a customer who signs up at xyz.com, verifies their
                             email, and owns one or more institutions.
  owner_sessions           — hashed refresh tokens for owner sessions
                             (type="owner" JWTs, separate from staff).
  support_tickets (+ msgs) — account-level support raised from the platform
                             dashboard.
  tenants.owner_id         — links an institution to its owner (1 → many).
  orders.owner_id          — records which owner started an in-dashboard
                             checkout, so provisioning can stamp the tenant.

This is the third identity table: `platform_users` (xyz.com staff),
`users` (institution members) and now `platform_owners` (the buyer).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e2a3f5b7c8d0"
down_revision: Union[str, None] = "8a1e4b2c5f01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── platform_owners ───────────────────────────────────────────────────────
    op.create_table(
        "platform_owners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("email_verification_token", sa.String(length=255), nullable=True),
        sa.Column("email_verification_expires", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("password_reset_token", sa.String(length=255), nullable=True),
        sa.Column("password_reset_expires", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_login_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_platform_owners_email", "platform_owners", ["email"])

    # ── owner_sessions ────────────────────────────────────────────────────────
    op.create_table(
        "owner_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("device_info", sa.Text(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["platform_owners.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index("idx_owner_sessions_owner_id", "owner_sessions", ["owner_id"])
    op.create_index("idx_owner_sessions_expires_at", "owner_sessions", ["expires_at"])

    # ── support_tickets ───────────────────────────────────────────────────────
    op.create_table(
        "support_tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), server_default="OTHER", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="OPEN", nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="NORMAL", nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["platform_owners.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_support_tickets_owner_status", "support_tickets", ["owner_id", "status"])
    op.create_index("idx_support_tickets_tenant_id", "support_tickets", ["tenant_id"])

    # ── support_ticket_messages ───────────────────────────────────────────────
    op.create_table(
        "support_ticket_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_role", sa.String(length=20), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_support_ticket_messages_ticket_id",
        "support_ticket_messages",
        ["ticket_id"],
    )

    # ── link institutions + orders to their owner ─────────────────────────────
    op.add_column(
        "tenants",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("idx_tenants_owner_id", "tenants", ["owner_id"])

    op.add_column(
        "orders",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("idx_orders_owner_id", "orders", ["owner_id"])


def downgrade() -> None:
    op.drop_index("idx_orders_owner_id", table_name="orders")
    op.drop_column("orders", "owner_id")
    op.drop_index("idx_tenants_owner_id", table_name="tenants")
    op.drop_column("tenants", "owner_id")

    op.drop_table("support_ticket_messages")
    op.drop_table("support_tickets")
    op.drop_table("owner_sessions")
    op.drop_table("platform_owners")
