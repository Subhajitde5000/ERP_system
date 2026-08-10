"""Wire contracts for the Academic Coordinator console (C-AC-01 … C-AC-08).

Mirrors the docs in ``doc/complete_webpage_developer_assignment.md`` and the
data boundaries in ``role_based_system_design.md`` §4.5.  The Academic
Coordinator owns the timetable, the substitution board, the academic calendar
and academic notices; every contract below is tenant-scoped and matches the
canonical rows owned by the base schema.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import APIResponse

# ── Shared paging contracts ──────────────────────────────────────────────────


class CoordinatorPage(BaseModel):
    total: int
    limit: int
    offset: int


# ── Dashboard (C-AC-01) ──────────────────────────────────────────────────────


class CoordinatorTimetableKpi(BaseModel):
    total_slots: int
    classes_covered: int
    teachers_scheduled: int
    coverage_percentage: float | None = None


class CoordinatorSubstitutionKpi(BaseModel):
    today: int
    upcoming: int
    past: int
    covering_teachers: int


class CoordinatorExamKpi(BaseModel):
    scheduled: int
    upcoming: int
    ongoing: int
    pending_hall_allocation: int


class CoordinatorDashboard(BaseModel):
    academic_year: str | None = None
    today: date
    timetable: CoordinatorTimetableKpi
    substitutions: CoordinatorSubstitutionKpi
    exams: CoordinatorExamKpi
    upcoming_events: list["CoordinatorEventRow"]
    upcoming_substitutions: list["CoordinatorSubstitutionRow"]
    pending_exam_schedules: int
    timetable_conflicts: int
    active_notices: int


# ── Timetable builder (C-AC-02) ──────────────────────────────────────────────


class CoordinatorClassOption(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    class_teacher_name: str | None = None


class CoordinatorSubjectOption(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None


class CoordinatorTeacherOption(BaseModel):
    id: uuid.UUID
    name: str
    employee_code: str | None = None
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    designation: str | None = None
    is_active: bool


class CoordinatorTimetableSlot(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    department_name: str | None = None
    day_of_week: int = Field(ge=1, le=6)
    period_number: int = Field(ge=1, le=20)
    start_time: time
    end_time: time
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    teacher_id: uuid.UUID | None = None
    teacher_name: str | None = None
    room_no: str | None = None
    slot_type: Literal["CLASS", "BREAK", "LAB", "ACTIVITY"]
    effective_from: date
    effective_to: date | None = None


class CoordinatorTimetableGrid(BaseModel):
    classes: list[CoordinatorClassOption]
    subjects: list[CoordinatorSubjectOption]
    teachers: list[CoordinatorTeacherOption]
    slots: list[CoordinatorTimetableSlot]
    period_labels: list[dict[str, str | int]]


class CoordinatorSlotCreate(BaseModel):
    class_id: uuid.UUID
    # Resolved server-side against the institution's current academic year. The
    # field is kept on the wire for clients that already know the year; the
    # service accepts an empty UUID/string and falls back to the canonical row.
    academic_year_id: uuid.UUID | None = None
    day_of_week: int = Field(ge=1, le=6)
    period_number: int = Field(ge=1, le=20)
    start_time: time
    end_time: time
    subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    room_no: str | None = Field(default=None, max_length=20)
    slot_type: Literal["CLASS", "BREAK", "LAB", "ACTIVITY"] = "CLASS"
    effective_from: date
    effective_to: date | None = None

    @field_validator("academic_year_id", "subject_id", "teacher_id", mode="before")
    @classmethod
    def _sanitize_empty_uuid(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    @field_validator("room_no", mode="before")
    @classmethod
    def _sanitize_empty_str(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    @model_validator(mode="after")
    def _validate_window(self) -> "CoordinatorSlotCreate":
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("effective_to cannot be before effective_from")
        return self


class CoordinatorSlotUpdate(BaseModel):
    class_id: uuid.UUID | None = None
    day_of_week: int | None = Field(default=None, ge=1, le=6)
    period_number: int | None = Field(default=None, ge=1, le=20)
    start_time: time | None = None
    end_time: time | None = None
    subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None
    room_no: str | None = Field(default=None, max_length=20)
    slot_type: Literal["CLASS", "BREAK", "LAB", "ACTIVITY"] | None = None
    effective_from: date | None = None
    effective_to: date | None = None

    @field_validator("class_id", "subject_id", "teacher_id", mode="before")
    @classmethod
    def _sanitize_empty_uuid(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    @field_validator("room_no", mode="before")
    @classmethod
    def _sanitize_empty_str(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v



# ── Conflict checker (C-AC-04) ──────────────────────────────────────────────


class CoordinatorConflictRow(BaseModel):
    id: str
    kind: Literal["TEACHER_DOUBLE_BOOKED", "ROOM_DOUBLE_BOOKED"]
    day_of_week: int
    period_number: int
    resource: str
    class_ids: list[uuid.UUID]
    class_names: list[str]
    subject_names: list[str]
    teacher_names: list[str]


class CoordinatorConflictReport(BaseModel):
    total: int
    teacher_conflicts: int
    room_conflicts: int
    items: list[CoordinatorConflictRow]


# ── Substitutions (C-AC-05 / C-AC-06) ────────────────────────────────────────


class CoordinatorSubstitutionRow(BaseModel):
    id: uuid.UUID
    slot_id: uuid.UUID
    date: date
    when: Literal["TODAY", "UPCOMING", "PAST"]
    substitute_teacher_id: uuid.UUID
    substitute_teacher_name: str
    original_teacher_id: uuid.UUID
    original_teacher_name: str
    reason: str | None = None
    arranged_by_id: uuid.UUID | None = None
    arranged_by_name: str | None = None
    created_at: datetime
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    subject_code: str | None = None
    subject_name: str | None = None
    class_id: uuid.UUID
    class_name: str
    room_no: str | None = None
    slot_type: Literal["CLASS", "BREAK", "LAB", "ACTIVITY"]


class CoordinatorSubstitutionBoard(BaseModel):
    today: date
    rows: list[CoordinatorSubstitutionRow]
    counts: dict[str, int]
    can_edit: bool


class CoordinatorSubstituteCandidate(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    designation: str | None = None
    is_active: bool


class CoordinatorSubstitutableSlot(BaseModel):
    slot_id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    teacher_id: uuid.UUID | None = None
    teacher_name: str | None = None
    room_no: str | None = None
    slot_type: Literal["CLASS", "BREAK", "LAB", "ACTIVITY"]


class CoordinatorSubstitutionTakenKey(BaseModel):
    slot_id: uuid.UUID
    date: date
    substitute_teacher_id: uuid.UUID


class CoordinatorSubstitutionFormContext(BaseModel):
    today: date
    slots: list[CoordinatorSubstitutableSlot]
    candidates: list[CoordinatorSubstituteCandidate]
    taken: list[CoordinatorSubstitutionTakenKey]
    busy_cells: dict[str, list[str]]


class CoordinatorSubstitutionCreate(BaseModel):
    slot_id: uuid.UUID
    date: date
    substitute_teacher_id: uuid.UUID
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("reason")
    @classmethod
    def _trim_reason(cls, value: str | None) -> str | None:
        return value.strip() if value else value


# ── Academic calendar (C-AC-07) ─────────────────────────────────────────────


class CoordinatorEventRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    event_type: Literal["HOLIDAY", "EVENT", "EXAM", "TERM"]
    start_date: date
    end_date: date
    is_holiday: bool
    applies_to: Literal["ALL", "DEPARTMENT", "CLASS"]
    scope_id: uuid.UUID | None = None
    scope_name: str | None = None
    color: str | None = None
    created_by_name: str | None = None


class CoordinatorEventPage(CoordinatorPage):
    items: list[CoordinatorEventRow]


class CoordinatorEventCreate(BaseModel):
    academic_year_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    event_type: Literal["HOLIDAY", "EVENT", "EXAM", "TERM"]
    start_date: date
    end_date: date
    is_holiday: bool = False
    applies_to: Literal["ALL", "DEPARTMENT", "CLASS"] = "ALL"
    scope_id: uuid.UUID | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("academic_year_id", "scope_id", mode="before")
    @classmethod
    def _sanitize_empty_uuid(cls, v: Any) -> Any:
        if v == "" or v is None:
            return None
        return v

    @model_validator(mode="after")
    def _validate_window(self) -> "CoordinatorEventCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        if self.applies_to != "ALL" and self.scope_id is None:
            raise ValueError("scope_id is required when applies_to is DEPARTMENT or CLASS")
        if self.is_holiday and self.event_type != "HOLIDAY":
            raise ValueError("is_holiday may only be set for HOLIDAY event_type")
        return self


class CoordinatorEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None
    is_holiday: bool | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


# ── Post academic notice (C-AC-08) ──────────────────────────────────────────


class CoordinatorNoticeRow(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author_id: uuid.UUID
    author_name: str | None = None
    target_scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS", "HOSTEL", "TRANSPORT"]
    target_id: uuid.UUID | None = None
    target_name: str | None = None
    priority: Literal["NORMAL", "IMPORTANT", "URGENT"]
    is_pinned: bool
    published_at: datetime
    expires_at: datetime | None = None
    read_count: int


class CoordinatorNoticePage(CoordinatorPage):
    items: list[CoordinatorNoticeRow]


class CoordinatorNoticeTargets(BaseModel):
    departments: list["CoordinatorTargetOption"]
    classes: list["CoordinatorClassOption"]


class CoordinatorTargetOption(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None


class CoordinatorNoticeCreate(BaseModel):
    """C-AC-08 — post an academic notice (class-scoped only per §4.5)."""

    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=10_000)
    target_scope: Literal["CLASS"] = "CLASS"
    target_id: uuid.UUID
    priority: Literal["NORMAL", "IMPORTANT", "URGENT"] = "NORMAL"
    is_pinned: bool = False
    expires_at: datetime | None = None

    @field_validator("title", "body")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("must not be blank")
        return cleaned

    @model_validator(mode="after")
    def _validate_expiry(self) -> "CoordinatorNoticeCreate":
        if self.expires_at and self.expires_at <= datetime.now(__import__("datetime").timezone.utc):
            raise ValueError("expires_at must be in the future")
        return self


# Resolve forward references for the dashboard and notice list responses.
CoordinatorDashboard.model_rebuild()
CoordinatorEventPage.model_rebuild()
CoordinatorNoticePage.model_rebuild()
CoordinatorNoticeTargets.model_rebuild()


# ── APIResponse envelopes ────────────────────────────────────────────────────


APIResponseCoordinatorDashboard = APIResponse[CoordinatorDashboard]
APIResponseCoordinatorTimetableGrid = APIResponse[CoordinatorTimetableGrid]
APIResponseCoordinatorTimetableSlot = APIResponse[CoordinatorTimetableSlot]
APIResponseCoordinatorConflictReport = APIResponse[CoordinatorConflictReport]
APIResponseCoordinatorSubstitutionBoard = APIResponse[CoordinatorSubstitutionBoard]
APIResponseCoordinatorSubstitutionFormContext = APIResponse[CoordinatorSubstitutionFormContext]
APIResponseCoordinatorSubstitution = APIResponse[CoordinatorSubstitutionRow]
APIResponseCoordinatorEventPage = APIResponse[CoordinatorEventPage]
APIResponseCoordinatorEvent = APIResponse[CoordinatorEventRow]
APIResponseCoordinatorNoticePage = APIResponse[CoordinatorNoticePage]
APIResponseCoordinatorNotice = APIResponse[CoordinatorNoticeRow]
APIResponseCoordinatorNoticeTargets = APIResponse[CoordinatorNoticeTargets]
APIResponseCoordinatorEmpty = APIResponse[None]
