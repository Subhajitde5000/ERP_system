"""exam controller console

Adds the Exam Controller module (C-EC-01 … C-EC-10). The exam module's
canonical tables already belong to the base schema (§7.2); the controller
console introduces two module-local tables — publications and grade cards —
plus the indexes and enums the service needs.

Revision ID: f1c2d3e4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1c2d3e4a5b6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return name in set(sa.inspect(op.get_bind()).get_table_names())


def _has_index(table: str, index_name: str) -> bool:
    indexes = sa.inspect(op.get_bind()).get_indexes(table)
    return any(index["name"] == index_name for index in indexes)


def upgrade() -> None:
    # 1. exam_controller_publications
    if not _has_table("exam_controller_publications"):
        op.create_table(
            "exam_controller_publications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "tenant_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column(
                "academic_year_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("academic_years.id"),
                nullable=False,
            ),
            sa.Column(
                "class_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("classes.id"),
                nullable=True,
            ),
            sa.Column(
                "exam_ids",
                postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
                nullable=False,
                server_default="{}",
            ),
            sa.Column(
                "compiled_by",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "compiled_at",
                sa.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column(
                "status",
                sa.String(20),
                nullable=False,
                server_default="DRAFT",
            ),
            sa.Column(
                "summary",
                postgresql.JSONB,
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("note", sa.Text, nullable=True),
        )
    publication_status = postgresql.ENUM(
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "PUBLISHED",
        "WITHDRAWN",
        name="exam_controller_publication_status",
        create_type=False,
    )
    publication_status.create(op.get_bind(), checkfirst=True)
    op.execute(
        "ALTER TABLE exam_controller_publications "
        "ALTER COLUMN status TYPE exam_controller_publication_status "
        "USING status::exam_controller_publication_status"
    )
    if not _has_index("exam_controller_publications", "idx_ec_publications_tenant_year"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_ec_publications_tenant_year "
            "ON exam_controller_publications (tenant_id, academic_year_id)"
        )
    if not _has_index("exam_controller_publications", "idx_ec_publications_status"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_ec_publications_status "
            "ON exam_controller_publications (tenant_id, status)"
        )

    # 2. exam_controller_grade_cards
    if not _has_table("exam_controller_grade_cards"):
        op.create_table(
            "exam_controller_grade_cards",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "tenant_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("tenants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "publication_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("exam_controller_publications.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "student_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "class_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("classes.id"),
                nullable=False,
            ),
            sa.Column(
                "total_marks_obtained",
                sa.Numeric(8, 2),
                nullable=False,
            ),
            sa.Column(
                "total_marks_possible",
                sa.Numeric(8, 2),
                nullable=False,
            ),
            sa.Column("percentage", sa.Numeric(5, 2), nullable=False),
            sa.Column("grade", sa.String(5), nullable=False),
            sa.Column("rank", sa.Integer, nullable=True),
            sa.Column(
                "subject_scores",
                postgresql.JSONB,
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
            sa.Column(
                "status",
                sa.String(20),
                nullable=False,
                server_default="PENDING",
            ),
            sa.Column("generated_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
        )
    grade_card_status = postgresql.ENUM(
        "PENDING",
        "GENERATED",
        "PUBLISHED",
        "FAILED",
        name="exam_controller_grade_card_status",
        create_type=False,
    )
    grade_card_status.create(op.get_bind(), checkfirst=True)
    op.execute(
        "ALTER TABLE exam_controller_grade_cards "
        "ALTER COLUMN status TYPE exam_controller_grade_card_status "
        "USING status::exam_controller_grade_card_status"
    )
    if not _has_index("exam_controller_grade_cards", "idx_ec_grade_cards_publication"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_ec_grade_cards_publication "
            "ON exam_controller_grade_cards (publication_id)"
        )
    if not _has_index("exam_controller_grade_cards", "idx_ec_grade_cards_tenant_class"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_ec_grade_cards_tenant_class "
            "ON exam_controller_grade_cards (tenant_id, class_id)"
        )
    if not _has_index("exam_controller_grade_cards", "idx_grade_cards_tenant_pub"):
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_grade_cards_tenant_pub "
            "ON exam_controller_grade_cards (tenant_id, publication_id)"
        )

    # 3. role assignment bootstrap for EXAM_CONTROLLER (idempotent).
    op.execute(
        """
        INSERT INTO role_assignments (
          id, user_id, role_id, tenant_id, scope_type, assigned_at, is_active
        )
        SELECT gen_random_uuid(), u.id, r.id, u.tenant_id, 'INSTITUTION', NOW(), TRUE
          FROM users u
          JOIN roles r ON r.name = 'EXAM_CONTROLLER'
         WHERE u.deleted_at IS NULL
           AND u.is_active IS TRUE
           AND NOT EXISTS (
             SELECT 1
               FROM role_assignments ra
              WHERE ra.user_id = u.id
                AND ra.role_id = r.id
                AND ra.tenant_id = u.tenant_id
           )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_grade_cards_tenant_pub")
    op.execute("DROP INDEX IF EXISTS idx_ec_grade_cards_tenant_class")
    op.execute("DROP INDEX IF EXISTS idx_ec_grade_cards_publication")
    op.execute("DROP INDEX IF EXISTS idx_ec_publications_status")
    op.execute("DROP INDEX IF EXISTS idx_ec_publications_tenant_year")
    op.drop_table("exam_controller_grade_cards")
    op.drop_table("exam_controller_publications")
    op.execute("DROP TYPE IF EXISTS exam_controller_grade_card_status")
    op.execute("DROP TYPE IF EXISTS exam_controller_publication_status")
