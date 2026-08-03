"""ORM models required by the Exam Controller console (C-EC-01 … C-EC-10).

The exam module's canonical tables already belong to the base schema
(``exams`` §7.2, ``exam_hall_allocations`` §7.2, ``exam_attempts`` §7.2,
``malpractice_logs`` §7.2, ``result_publications`` and ``student_results``
introduced by the principal governance migration).

The Exam Controller's authority (`role_based_system_design.md` §4.6):

  * Exam Schedule — create, edit, publish exam timetable
  * Hall Allocation — assign exam halls and invigilators
  * Malpractice — log and manage malpractice reports
  * Results — compile and publish results
  * Grade Cards — generate and release grade cards
  * Reports — examination analytics across institution

The console is **institution-wide**; the per-class ``exam_id`` of the
operational module stays the boundary. The notices module is reused as-is
for the exam result publication; no second notice table is created here.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

__all__ = [
    "ExamControllerPublication",
    "ExamControllerPublicationStatus",
    "ExamControllerGradeCard",
    "ExamControllerGradeCardStatus",
]


class ExamControllerPublicationStatus(str, enum.Enum):
    """Lifecycle of a compiled-result bundle.

    Mirrors the principal approval lifecycle but lives here because the
    controller is the side that *compiles* the bundle; the principal is
    the side that *approves* it. Keeping the enums close to the column
    makes the cross-role handshake self-documenting.
    """

    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"
    WITHDRAWN = "WITHDRAWN"


class ExamControllerGradeCardStatus(str, enum.Enum):
    PENDING = "PENDING"
    GENERATED = "GENERATED"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


class ExamControllerPublication(Base):
    """A bundled result publication assembled by the Exam Controller.

    The principal console already owns ``result_publications`` (§7.2 with
    the approval fields). The controller console cannot write to that
    table directly because the controller has no approval authority, so
    this module-local mirror records the *controller's* draft before it
    is forwarded to the principal queue. Once approved, the canonical
    publication is updated to PUBLISHED by the principal service.
    """

    __tablename__ = "exam_controller_publications"
    __table_args__ = (
        Index(
            "idx_ec_publications_tenant_year",
            "tenant_id",
            "academic_year_id",
        ),
        Index(
            "idx_ec_publications_status",
            "tenant_id",
            "status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )
    exam_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    compiled_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    compiled_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    status: Mapped[ExamControllerPublicationStatus] = mapped_column(
        SAEnum(
            ExamControllerPublicationStatus,
            name="exam_controller_publication_status",
        ),
        nullable=False,
        default=ExamControllerPublicationStatus.DRAFT,
    )
    summary: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExamControllerGradeCard(Base):
    """A grade card generated for a single student in a publication.

    The grade card is the per-student face of a published result. The
    summary rollup lives on the parent publication; the row below carries
    the marks table so the C-EC-09 page can render a printable card
    without re-aggregating every exam.
    """

    __tablename__ = "exam_controller_grade_cards"
    __table_args__ = (
        Index(
            "idx_ec_grade_cards_publication",
            "publication_id",
        ),
        Index(
            "idx_ec_grade_cards_tenant_class",
            "tenant_id",
            "class_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("exam_controller_publications.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    total_marks_obtained: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    total_marks_possible: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    grade: Mapped[str] = mapped_column(String(5), nullable=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subject_scores: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[ExamControllerGradeCardStatus] = mapped_column(
        SAEnum(
            ExamControllerGradeCardStatus,
            name="exam_controller_grade_card_status",
        ),
        nullable=False,
        default=ExamControllerGradeCardStatus.PENDING,
    )
    generated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
