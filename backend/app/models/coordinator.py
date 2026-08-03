"""ORM models required by the Academic Coordinator console (C-AC-01 … C-AC-08).

The tables already belong to the base ERP schema.  The coordinator console
mirrors them locally so the timetable builder, substitution board, conflict
checker and notice composer can read and write the canonical rows instead of
maintaining a second fixture or reporting store.

The Academic Coordinator's authority (role_based_system_design.md §4.5):

  * Timetable — create and manage timetable
  * Examination — schedule exams, allocate halls
  * Attendance — view department-wide reports
  * Notices — post academic notices
  * Reports — academic calendar reports

Every model below keeps the same tenant boundary as the operational module
that owns the underlying table.  The notice model itself lives in
``app.models.principal`` because the notice board is a shared resource; the
coordinator service imports it from there.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

__all__ = [
    "AcademicEvent",
    "AcademicEventScope",
    "AcademicEventType",
    "TimetableSubstitution",
]


class AcademicEventType(str, enum.Enum):
    HOLIDAY = "HOLIDAY"
    EVENT = "EVENT"
    EXAM = "EXAM"
    TERM = "TERM"


class AcademicEventScope(str, enum.Enum):
    ALL = "ALL"
    DEPARTMENT = "DEPARTMENT"
    CLASS = "CLASS"


class AcademicEvent(Base):
    __tablename__ = "academic_events"
    __table_args__ = (
        Index("idx_academic_events_tenant_year", "tenant_id", "academic_year_id"),
        Index("idx_academic_events_dates", "tenant_id", "start_date", "end_date"),
        Index(
            "idx_academic_events_is_holiday",
            "tenant_id",
            "is_holiday",
            "start_date",
            postgresql_where="is_holiday = TRUE",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[AcademicEventType] = mapped_column(
        SAEnum(AcademicEventType, name="academic_event_type"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_holiday: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    applies_to: Mapped[AcademicEventScope] = mapped_column(
        SAEnum(AcademicEventScope, name="event_scope"), nullable=False, default=AcademicEventScope.ALL
    )
    scope_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True, default="#3B82F6")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TimetableSubstitution(Base):
    __tablename__ = "timetable_substitutions"
    __table_args__ = (
        Index("idx_timetable_substitutions_tenant_id", "tenant_id"),
        Index("idx_timetable_substitutions_date", "tenant_id", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False
    )
    slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_slots.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    substitute_teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    original_teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    arranged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
