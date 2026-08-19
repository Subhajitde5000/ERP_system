"""Wire contracts for the Principal console (C-PR-01 … C-PR-10).

The contracts deliberately contain aggregates and read-only directory data, not
raw operational rows.  A Principal needs institution-wide academic oversight;
they do not need payroll, passwords, bank data or another role's mutation
controls.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import APIResponse


# ── Shared paging / directory contracts ──────────────────────────────────────

class PrincipalPage(BaseModel):
    total: int
    limit: int
    offset: int


class PrincipalStaffRow(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    employee_code: str | None = None
    designation: str | None = None
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    employment_type: str | None = None
    date_of_joining: date | None = None
    roles: list[str] = Field(default_factory=list)
    is_active: bool


class PrincipalStaffDetail(PrincipalStaffRow):
    qualification: str | None = None
    experience_years: int | None = None


class PrincipalStudentEnrollment(BaseModel):
    class_id: uuid.UUID | None = None
    class_name: str | None = None
    department_name: str | None = None
    academic_year_name: str | None = None
    roll_number: str | None = None
    status: str | None = None
    enrollment_date: date | None = None


class PrincipalStudentRow(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    roll_no: str | None = None
    is_active: bool
    enrollment: PrincipalStudentEnrollment | None = None


class PrincipalStudentDetail(PrincipalStudentRow):
    date_of_birth: date | None = None
    gender: str | None = None


class PrincipalStaffPage(PrincipalPage):
    items: list[PrincipalStaffRow]


class PrincipalStudentPage(PrincipalPage):
    items: list[PrincipalStudentRow]


# ── Dashboard / attendance ──────────────────────────────────────────────────

class AttendanceClassSummary(BaseModel):
    id: uuid.UUID
    name: str
    attendance_percentage: float | None = None
    total_present: int
    total_absent: int
    attendance_marks: int


class AttendanceDepartmentSummary(BaseModel):
    id: uuid.UUID
    name: str
    attendance_percentage: float | None = None
    total_present: int
    total_absent: int
    attendance_marks: int
    classes: list[AttendanceClassSummary] = Field(default_factory=list)


class PrincipalAttendanceOverview(BaseModel):
    from_date: date
    to_date: date
    attendance_percentage: float | None = None
    total_present: int
    total_absent: int
    attendance_marks: int
    departments: list[AttendanceDepartmentSummary]


class PrincipalUpcomingExam(BaseModel):
    id: uuid.UUID
    title: str
    scheduled_at: datetime
    class_name: str
    subject_name: str
    department_name: str | None = None
    status: str


class PrincipalDashboard(BaseModel):
    academic_year: str | None = None
    attendance_percentage: float | None = None
    attendance_marks: int
    attendance_departments: list[AttendanceDepartmentSummary]
    ongoing_exams: int
    upcoming_exams: int
    upcoming_exam_items: list[PrincipalUpcomingExam]
    pending_result_approvals: int
    result_pass_percentage: float | None = None
    staff_on_leave_today: int
    staff_count: int
    total_notices: int


# ── Exams / schedule approval ────────────────────────────────────────────────

class PrincipalExamRow(BaseModel):
    id: uuid.UUID
    title: str
    class_id: uuid.UUID
    class_name: str
    department_name: str | None = None
    subject_id: uuid.UUID
    subject_name: str
    subject_code: str
    scheduled_at: datetime
    window_end_at: datetime | None = None
    duration_minutes: int
    total_marks: int
    passing_marks: int
    mode: str
    status: str
    schedule_approval_status: Literal["PENDING", "APPROVED", "REJECTED"]
    schedule_approved_at: datetime | None = None
    schedule_approval_note: str | None = None


class PrincipalExamPage(PrincipalPage):
    items: list[PrincipalExamRow]


class ScheduleApprovalRequest(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def rejection_needs_reason(self) -> "ScheduleApprovalRequest":
        if self.decision == "REJECT" and not (self.note or "").strip():
            raise ValueError("A reason is required when rejecting an exam schedule")
        return self


# ── Results / publication approval ──────────────────────────────────────────

class PrincipalResultGroup(BaseModel):
    id: uuid.UUID
    name: str
    student_count: int
    pass_count: int
    fail_count: int
    withheld_count: int
    absent_count: int
    pass_percentage: float | None = None
    average_percentage: float | None = None


class PrincipalPublicationRow(BaseModel):
    id: uuid.UUID
    title: str
    academic_year: str | None = None
    class_name: str | None = None
    published_at: datetime
    published_by_name: str | None = None
    exam_count: int
    student_count: int
    pass_percentage: float | None = None
    average_percentage: float | None = None
    is_visible_to_students: bool
    approval_status: Literal["PENDING", "APPROVED", "REJECTED"]
    approved_at: datetime | None = None
    approval_note: str | None = None


class PrincipalResultsOverview(BaseModel):
    overall: PrincipalResultGroup | None = None
    departments: list[PrincipalResultGroup]
    classes: list[PrincipalResultGroup]
    publications: list[PrincipalPublicationRow]


class ResultApprovalRequest(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def rejection_needs_reason(self) -> "ResultApprovalRequest":
        if self.decision == "REJECT" and not (self.note or "").strip():
            raise ValueError("A reason is required when rejecting a result publication")
        return self


# ── Notice board ─────────────────────────────────────────────────────────────

class NoticeAttachmentInput(BaseModel):
    """A browser-selected file (data URL) or a safe external link."""

    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=1, max_length=100)
    data_url: str | None = None
    external_url: str | None = Field(default=None, max_length=2048)

    @model_validator(mode="after")
    def has_one_source(self) -> "NoticeAttachmentInput":
        if bool(self.data_url) == bool(self.external_url):
            raise ValueError("Provide either a file or a link attachment")
        if self.external_url and not self.external_url.startswith(("https://", "http://")):
            raise ValueError("Links must use http or https")
        return self


class NoticeAttachment(BaseModel):
    id: uuid.UUID
    file_name: str
    file_size_bytes: int
    mime_type: str
    url: str
    is_image: bool
    is_link: bool


class LeadershipNoticeRow(BaseModel):
    """Notice metadata shared by leadership roles without receipt data."""

    id: uuid.UUID
    title: str
    body: str
    author_name: str | None = None
    # Principal reads every institution notice, including optional-module
    # notices. Posting remains restricted to the three academic scopes below.
    target_scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS", "HOSTEL", "TRANSPORT"]
    target_id: uuid.UUID | None = None
    target_name: str | None = None
    priority: Literal["NORMAL", "IMPORTANT", "URGENT"]
    is_pinned: bool
    published_at: datetime
    expires_at: datetime | None = None
    attachments: list[NoticeAttachment] = Field(default_factory=list)


class PrincipalNoticeRow(LeadershipNoticeRow):
    """Principal-only row adds the aggregate read receipt count."""

    read_count: int


class PrincipalNoticePage(PrincipalPage):
    items: list[PrincipalNoticeRow]


class NoticeReader(BaseModel):
    id: uuid.UUID
    name: str
    read_at: datetime


class PrincipalNoticeDetail(PrincipalNoticeRow):
    readers: list[NoticeReader]


class PrincipalNoticeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    body: str = Field(..., min_length=1, max_length=20_000)
    target_scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS"]
    target_id: uuid.UUID | None = None
    priority: Literal["NORMAL", "IMPORTANT", "URGENT"] = "NORMAL"
    is_pinned: bool = False
    expires_at: datetime | None = None
    attachments: list[NoticeAttachmentInput] = Field(default_factory=list, max_length=5)

    @field_validator("expires_at")
    @classmethod
    def expiry_must_include_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("expires_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_target(self) -> "PrincipalNoticeCreate":
        if self.target_scope == "INSTITUTION" and self.target_id is not None:
            raise ValueError("Institution-wide notices cannot have a target id")
        if self.target_scope != "INSTITUTION" and self.target_id is None:
            raise ValueError("A department or class target is required")
        return self


class PrincipalTargetOption(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None


class PrincipalNoticeTargets(BaseModel):
    departments: list[PrincipalTargetOption]
    classes: list[PrincipalTargetOption]


# ── Timetable ────────────────────────────────────────────────────────────────

class PrincipalTimetableSlot(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    department_name: str | None = None
    day_of_week: int = Field(..., ge=1, le=7)
    period_number: int
    start_time: time
    end_time: time
    subject_name: str | None = None
    subject_code: str | None = None
    teacher_name: str | None = None
    room_no: str | None = None
    slot_type: str


class PrincipalTimetable(BaseModel):
    classes: list[PrincipalTargetOption]
    slots: list[PrincipalTimetableSlot]


# ── Reports ──────────────────────────────────────────────────────────────────

class PrincipalPerformanceRow(BaseModel):
    department_id: uuid.UUID
    department_name: str
    attendance_percentage: float | None = None
    pass_percentage: float | None = None
    average_percentage: float | None = None
    student_count: int


class PrincipalReports(BaseModel):
    attendance: PrincipalAttendanceOverview
    results: PrincipalResultsOverview
    performance: list[PrincipalPerformanceRow]


# ── API envelope aliases ─────────────────────────────────────────────────────

APIResponsePrincipalDashboard = APIResponse[PrincipalDashboard]
APIResponsePrincipalAttendance = APIResponse[PrincipalAttendanceOverview]
APIResponsePrincipalExams = APIResponse[PrincipalExamPage]
APIResponsePrincipalExam = APIResponse[PrincipalExamRow]
APIResponsePrincipalResults = APIResponse[PrincipalResultsOverview]
APIResponsePrincipalPublication = APIResponse[PrincipalPublicationRow]
APIResponsePrincipalStaff = APIResponse[PrincipalStaffPage]
APIResponsePrincipalStaffDetail = APIResponse[PrincipalStaffDetail]
APIResponsePrincipalStudents = APIResponse[PrincipalStudentPage]
APIResponsePrincipalStudentDetail = APIResponse[PrincipalStudentDetail]
APIResponsePrincipalNotices = APIResponse[PrincipalNoticePage]
APIResponsePrincipalNotice = APIResponse[PrincipalNoticeDetail]
APIResponsePrincipalNoticeTargets = APIResponse[PrincipalNoticeTargets]
APIResponsePrincipalTimetable = APIResponse[PrincipalTimetable]
APIResponsePrincipalReports = APIResponse[PrincipalReports]
