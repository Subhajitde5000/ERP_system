"""support staff console: unified tickets, replies, SLA fields

Backs C-SP-01…C-SP-04. Mirrors database/update2.sql §8.

`support_tickets` exists in two incompatible shapes across the repo
(database.sql §10.2 institution-raised vs update.sql §1 owner-raised). The
Support console needs the union — C-SP-02 says "All tickets" — so this widens
the one table rather than creating a second queue.

Revision ID: b5d9f2e3a417
Revises: a4c8e1d2f930
Create Date: 2026-08-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b5d9f2e3a417"
down_revision: Union[str, Sequence[str], None] = "a4c8e1d2f930"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (column, type, extra DDL) — added only when absent, because which of the two
# original definitions ran decides what is already there.
_COLUMNS = (
    ("owner_id", "UUID", ""),
    ("tenant_id", "UUID", "REFERENCES tenants(id)"),
    ("raised_by", "UUID", "REFERENCES users(id)"),
    ("assigned_to", "UUID", "REFERENCES platform_users(id)"),
    ("description", "TEXT", ""),
    ("category", "VARCHAR(50)", "NOT NULL DEFAULT 'OTHER'"),
    ("resolved_at", "TIMESTAMPTZ", ""),
)

_INDEXES = (
    ("idx_support_tickets_status", "support_tickets", "status"),
    ("idx_support_tickets_priority", "support_tickets", "priority"),
    ("idx_support_tickets_assigned_to", "support_tickets", "assigned_to"),
    ("idx_support_tickets_created_at", "support_tickets", "created_at DESC"),
    ("idx_support_tickets_tenant_status", "support_tickets", "tenant_id, status"),
)


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("support_tickets")}

    for name, coltype, extra in _COLUMNS:
        if name not in existing:
            op.execute(
                sa.text(f"ALTER TABLE support_tickets ADD COLUMN {name} {coltype} {extra}")
            )

    # ── Human reference (TKT-1042) ────────────────────────────────────────
    # Sequence-backed, not count(*)+1, which races under concurrent inserts.
    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS support_ticket_reference_seq START 1001"))
    if "reference" not in existing:
        op.execute(sa.text("ALTER TABLE support_tickets ADD COLUMN reference VARCHAR(20)"))
    op.execute(
        sa.text(
            "UPDATE support_tickets SET reference = "
            "'TKT-' || nextval('support_ticket_reference_seq') WHERE reference IS NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE support_tickets ALTER COLUMN reference "
            "SET DEFAULT 'TKT-' || nextval('support_ticket_reference_seq')"
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint
                             WHERE conname = 'uq_support_tickets_reference') THEN
                ALTER TABLE support_tickets
                  ADD CONSTRAINT uq_support_tickets_reference UNIQUE (reference);
              END IF;
            END $$
            """
        )
    )

    # An owner-raised ticket has no raised_by, no tenant and no description.
    op.execute(
        sa.text(
            """
            DO $$ DECLARE col TEXT;
            BEGIN
              FOREACH col IN ARRAY ARRAY['raised_by', 'description', 'tenant_id'] LOOP
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_name='support_tickets' AND column_name=col
                             AND is_nullable='NO') THEN
                  EXECUTE format(
                    'ALTER TABLE support_tickets ALTER COLUMN %I DROP NOT NULL', col);
                END IF;
              END LOOP;
            END $$
            """
        )
    )

    # ── Priority: settle on database.sql §10.2 / types/support.ts ─────────
    op.execute(sa.text("UPDATE support_tickets SET priority='MEDIUM'   WHERE priority='NORMAL'"))
    op.execute(sa.text("UPDATE support_tickets SET priority='CRITICAL' WHERE priority='URGENT'"))
    op.execute(sa.text("ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'MEDIUM'"))

    for name, table, expr in (
        ("ck_support_tickets_raiser", "support_tickets",
         "owner_id IS NOT NULL OR raised_by IS NOT NULL"),
        ("ck_support_tickets_priority", "support_tickets",
         "priority IN ('LOW','MEDIUM','HIGH','CRITICAL')"),
        ("ck_support_tickets_status", "support_tickets",
         "status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')"),
    ):
        op.execute(sa.text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name}"))
        op.execute(sa.text(f"ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({expr})"))

    # ── Reply thread ──────────────────────────────────────────────────────
    msg_cols = {c["name"] for c in sa.inspect(bind).get_columns("support_ticket_messages")}
    if "is_internal" not in msg_cols:
        op.add_column(
            "support_ticket_messages",
            sa.Column(
                "is_internal", sa.Boolean(), nullable=False, server_default=sa.text("false")
            ),
        )
    op.execute(
        sa.text("ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS ck_ticket_messages_author")
    )
    op.execute(
        sa.text(
            "ALTER TABLE support_ticket_messages ADD CONSTRAINT ck_ticket_messages_author "
            "CHECK (author_role IN ('OWNER','STAFF','SUPPORT','INSTITUTION'))"
        )
    )

    for name, table, cols in _INDEXES:
        op.execute(sa.text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))


def downgrade() -> None:
    for name, _table, _cols in _INDEXES:
        op.execute(sa.text(f"DROP INDEX IF EXISTS {name}"))
    for name in (
        "ck_support_tickets_raiser",
        "ck_support_tickets_priority",
        "ck_support_tickets_status",
    ):
        op.execute(sa.text(f"ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS {name}"))
    op.execute(
        sa.text("ALTER TABLE support_ticket_messages DROP CONSTRAINT IF EXISTS ck_ticket_messages_author")
    )
    op.drop_column("support_ticket_messages", "is_internal")

    # Columns are intentionally left in place: dropping `reference`,
    # `assigned_to` or `description` would destroy support history that the
    # two original schemas disagreed about but users have since filled in.
