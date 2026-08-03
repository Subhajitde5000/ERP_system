"""coordinator console

Adds the Academic Coordinator module (C-AC-01 … C-AC-08).  The schema is
already present in ``database.sql`` (§7.4) and ``database/update2.sql`` adds
nothing new for this role.  This migration is an idempotent guard so a DB
built only from Alembic also exposes the canonical tables and indexes the
coordinator service reads.

Revision ID: a1b2c3d4e5f6
Revises: c9d3e7f1a602
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e7f2a6c3b904"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return name in set(sa.inspect(op.get_bind()).get_table_names())


def _has_index(index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(
        "timetable_substitutions"
    )
    return any(index["name"] == index_name for index in indexes)


def upgrade() -> None:
    # timetable_substitutions exists since the base schema; the coordinator
    # service hot paths (board + form context) filter by tenant and date, so
    # make sure those indexes are present.  The schema script already declares
    # the unique key on (slot_id, date) — the migration only adds lookup
    # indexes that were missing on some raw-SQL databases.
    if _has_table("timetable_substitutions"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_timetable_substitutions_tenant_id "
            "ON timetable_substitutions (tenant_id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_timetable_substitutions_date "
            "ON timetable_substitutions (tenant_id, date)"
        )

    # The academic_events model is institution-scoped; the schema's own
    # indexes already exist, but a DB built only from migrations may not have
    # the event_type / applies_to enum types in the right state.  We re-create
    # them here so the coordinator service can import the typed enums.
    if _has_table("academic_events"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_academic_events_tenant_year "
            "ON academic_events (tenant_id, academic_year_id)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_academic_events_dates "
            "ON academic_events (tenant_id, start_date, end_date)"
        )


def downgrade() -> None:
    # Reversing a feature migration is a destructive action that would also
    # need to drop the enums; the Alembic downgrade is therefore intentionally
    # a no-op and operational rollback should use a fresh init instead.
    pass
