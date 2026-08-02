"""super admin console: audit_logs, platform_settings, console indexes

Backs C-SA-01…C-SA-08. Mirrors database/update2.sql exactly.

Also merges the two existing heads (b7e3d2a9c104 platform-owner accounts and
f3b4c6d8e9a1 institution academic links), which branched from the same
revision and were never joined — `alembic upgrade head` fails with multiple
heads, so the merge has to happen here for the console to be deployable.

Revision ID: a4c8e1d2f930
Revises: b7e3d2a9c104, f3b4c6d8e9a1
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a4c8e1d2f930"
down_revision: Union[str, Sequence[str], None] = ("b7e3d2a9c104", "f3b4c6d8e9a1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # ── audit_logs (§10.3) ────────────────────────────────────────────────
    # In database.sql already; created here so a migrations-only DB has it.
    if "audit_logs" not in tables:
        op.create_table(
            "audit_logs",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            # NULL = platform-level action, which is what C-SA-07 filters on.
            sa.Column(
                "tenant_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("tenants.id"),
                nullable=True,
            ),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_role", sa.String(length=100), nullable=False),
            sa.Column("action", sa.String(length=100), nullable=False),
            sa.Column("entity", sa.String(length=100), nullable=False),
            sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("old_value", postgresql.JSONB(), nullable=True),
            sa.Column("new_value", postgresql.JSONB(), nullable=True),
            sa.Column("ip_address", postgresql.INET(), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                postgresql.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
        )

    _index("audit_logs", "idx_audit_tenant_time", ["tenant_id", "created_at"])
    _index("audit_logs", "idx_audit_entity_id", ["entity", "entity_id"])
    _index("audit_logs", "idx_audit_created_at", ["created_at"])

    # ── platform_settings (C-SA-08) ───────────────────────────────────────
    if "platform_settings" not in tables:
        op.create_table(
            "platform_settings",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("key", sa.String(length=100), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column(
                "updated_at",
                postgresql.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.UniqueConstraint("key", name="uq_platform_settings_key"),
        )

    # Seed the defaults. Guarded so re-running never duplicates or overwrites
    # a value an admin has since changed.
    op.execute(
        """
        INSERT INTO platform_settings (key, value)
        SELECT v.key, v.value
        FROM (VALUES
          ('product_name',      'xyz.com'),
          ('support_email',     'support@xyz.com'),
          ('default_timezone',  'Asia/Kolkata'),
          ('default_currency',  'INR'),
          ('trial_length_days', '14'),
          ('brand_primary',     '#0F172A'),
          ('brand_accent',      '#4F46E5')
        ) AS v(key, value)
        WHERE NOT EXISTS (
          SELECT 1 FROM platform_settings ps WHERE ps.key = v.key
        )
        """
    )

    # ── modules.price_monthly — schema drift guard ────────────────────────
    # Migration 8a1e4b2c5f01 adds this, but database.sql never did. A DB built
    # from raw SQL is missing it, and every Module ORM query then fails. The
    # guard makes both build paths converge.
    if "price_monthly" not in {c["name"] for c in inspector.get_columns("modules")}:
        op.add_column(
            "modules",
            sa.Column(
                "price_monthly",
                sa.Numeric(10, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )

    # ── Alembic-only tables on a raw-SQL database — drift guard ───────────
    # c6bcf3efa755 / 8a1e4b2c5f01 create these eight; database.sql never did.
    # On an Alembic-managed DB they already exist and this is a no-op. On a DB
    # built from database.sql (then stamped), the billing and signup layer
    # would otherwise be missing entirely — no sessions, invoices, orders or
    # outbox. Created from the ORM metadata so the DDL is defined once.
    # Equivalent to database/update2.sql §5.
    from app.database import Base
    import app.models  # noqa: F401 — registers every table on Base.metadata

    missing = [
        Base.metadata.tables[name]
        for name in (
            "platform_sessions",
            "platform_invoices",
            "platform_invoice_lines",
            "platform_payments",
            "coupons",
            "orders",
            "outbox_emails",
            "support_ticket_messages",
        )
        if name not in tables and name in Base.metadata.tables
    ]
    if missing:
        Base.metadata.create_all(bind=bind, tables=missing, checkfirst=True)

    # ── ENUM → VARCHAR status columns — schema drift guard ────────────────
    # database.sql types these as PG enums; every migration and model uses
    # VARCHAR(20). asyncpg then cannot insert (DatatypeMismatchError), which
    # breaks subscription creation on a raw-SQL database. Converge on VARCHAR,
    # the type the application actually sends.
    for table, column in (
        ("subscriptions", "status"),
        ("support_tickets", "status"),
        ("support_tickets", "priority"),
    ):
        if table not in tables:
            continue
        col = next(
            (c for c in inspector.get_columns(table) if c["name"] == column), None
        )
        if col is not None and isinstance(col["type"], postgresql.ENUM):
            op.execute(
                sa.text(
                    f"ALTER TABLE {table} ALTER COLUMN {column} "
                    f"TYPE VARCHAR(20) USING {column}::TEXT"
                )
            )

    op.execute(
        sa.text(
            "ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS ck_subscriptions_status"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE subscriptions ADD CONSTRAINT ck_subscriptions_status "
            "CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'))"
        )
    )

    # ── tenants.owner_id ──────────────────────────────────────────────────
    if "owner_id" not in {c["name"] for c in inspector.get_columns("tenants")}:
        op.add_column(
            "tenants",
            sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    _index("tenants", "idx_tenants_owner_id", ["owner_id"])

    # ── Console hot paths ─────────────────────────────────────────────────
    _index("tenants", "idx_tenants_plan_id", ["plan_id"])
    _index("tenants", "idx_tenants_is_active", ["is_active"])
    _index("tenants", "idx_tenants_created_at", ["created_at"])
    _index("subscriptions", "idx_subscriptions_tenant_created", ["tenant_id", "created_at"])
    _index("subscriptions", "idx_subscriptions_status", ["status"])
    _index("platform_users", "idx_platform_users_role", ["platform_role"])


def downgrade() -> None:
    for table, name in (
        ("platform_users", "idx_platform_users_role"),
        ("subscriptions", "idx_subscriptions_status"),
        ("subscriptions", "idx_subscriptions_tenant_created"),
        ("tenants", "idx_tenants_created_at"),
        ("tenants", "idx_tenants_is_active"),
        ("tenants", "idx_tenants_plan_id"),
        ("audit_logs", "idx_audit_created_at"),
    ):
        op.execute(sa.text(f"DROP INDEX IF EXISTS {name}"))

    op.drop_table("platform_settings")
    # audit_logs and tenants.owner_id are intentionally left in place: both
    # predate this migration (database.sql §10.3 / update.sql §1) and dropping
    # them would destroy the append-only trail and the owner links.


def _index(table: str, name: str, columns: list[str]) -> None:
    """CREATE INDEX IF NOT EXISTS — Alembic's op.create_index has no guard."""
    cols = ", ".join(columns)
    op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))
