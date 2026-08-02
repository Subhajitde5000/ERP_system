"""HOD mentor integrity and department scope bootstrap

Mirrors database/update2.sql sections 10–11. Historical inactive mentor rows
remain valid; only concurrent active assignments are prevented. Existing
`departments.hod_id` rows receive their matching scoped HOD role assignment.

Revision ID: e7f2a6c3b904
Revises: c9d3e7f1a602
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f2a6c3b904"
down_revision: Union[str, Sequence[str], None] = "c9d3e7f1a602"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX = "uq_mentor_assignments__tenant_student_year_active"


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    required = {"mentor_assignments", "departments", "roles", "role_assignments"}
    missing = required - tables
    if missing:
        raise RuntimeError(
            "HOD integrity requires the base academic schema; missing " + ", ".join(sorted(missing))
        )
    # Do not pick a winner or silently delete pastoral assignments during a
    # production migration. An operator must resolve any ambiguous history.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM mentor_assignments
            WHERE is_active = TRUE
            GROUP BY tenant_id, student_id, academic_year_id
            HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION
              'Cannot enforce one active mentor per student/year: resolve duplicate active mentor_assignments first';
          END IF;
        END $$;
        """
    )
    op.execute(
        f"CREATE UNIQUE INDEX IF NOT EXISTS {_INDEX} "
        "ON mentor_assignments (tenant_id, student_id, academic_year_id) "
        "WHERE is_active = TRUE"
    )

    # Legacy department setup stored the HOD only in departments.hod_id. Keep
    # role-based authorization fail-closed while backfilling the corresponding
    # department-scoped grant exactly once.
    op.execute(
        """
        UPDATE role_assignments ra
           SET is_active = TRUE,
               scope_type = 'DEPARTMENT',
               expires_at = NULL
          FROM roles r, departments d
         WHERE d.hod_id = ra.user_id
           AND r.id = ra.role_id
           AND r.name = 'HOD'
           AND ra.tenant_id = d.tenant_id
           AND ra.scope_id = d.id
           AND d.hod_id IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO role_assignments (
          id, user_id, role_id, tenant_id, scope_id, scope_type, assigned_at, is_active
        )
        SELECT gen_random_uuid(), d.hod_id, r.id, d.tenant_id, d.id, 'DEPARTMENT', NOW(), TRUE
          FROM departments d
          JOIN roles r ON r.name = 'HOD'
         WHERE d.hod_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
               FROM role_assignments ra
              WHERE ra.user_id = d.hod_id
                AND ra.role_id = r.id
                AND ra.tenant_id = d.tenant_id
                AND ra.scope_id = d.id
           )
        """
    )


def downgrade() -> None:
    # Keep backfilled HOD assignments: removing them would unexpectedly revoke
    # a department head during a schema-only rollback.
    op.execute(f"DROP INDEX IF EXISTS {_INDEX}")
