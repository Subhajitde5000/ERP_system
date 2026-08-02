"""Wire contracts for the Head of Department console (C-HD-01 … C-HD-12)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import APIResponse
from app.schemas.principal import (
    PrincipalAttendanceOverview,
    PrincipalDashboard,
    PrincipalExamPage,
    LeadershipNoticeRow,
    PrincipalNoticeCreate,
    PrincipalNoticeTargets,
    PrincipalPage,
    PrincipalResultsOverview,
    PrincipalTargetOption,
    PrincipalTimetable,
)


class HodDashboard(PrincipalDashboard):
    departments: list[PrincipalTargetOption]
    active_assignments: int
    pending_assignment_reviews: int
    overdue_assignments: int


class HodAttendanceDetailRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_percentage: float | None = None


class HodAttendanceDetailPage(PrincipalPage):
    from_date: date
    to_date: date
    items: list[HodAttendanceDetailRow]


class HodAssignmentRow(BaseModel):
    id: uuid.UUID
    title: str
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    teacher_id: uuid.UUID
    teacher_name: str | None = None
    due_date: datetime
    status: str
    total_marks: int
    submission_count: int
    pending_review_count: int
    reviewed_count: int


class HodAssignmentsOverview(BaseModel):
    active_assignments: int
    pending_reviews: int
    overdue_assignments: int
    rows: list[HodAssignmentRow]


class HodTeacherSubject(BaseModel):
    teacher_subject_id: uuid.UUID
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    role_in_subject: str


class HodTeacherRow(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    employee_code: str | None = None
    designation: str | None = None
    department_id: uuid.UUID
    department_name: str
    roles: list[str] = Field(default_factory=list)
    is_active: bool
    subjects: list[HodTeacherSubject] = Field(default_factory=list)
    primary_subject_count: int
    total_subject_count: int
    class_count: int
    mentor_count: int


class HodSubjectOption(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    class_id: uuid.UUID
    class_name: str
    assigned_teacher_count: int


class HodTeachersBoard(BaseModel):
    departments: list[PrincipalTargetOption]
    teachers: list[HodTeacherRow]
    subjects: list[HodSubjectOption]
    unstaffed_subjects: list[HodSubjectOption]


class HodTeacherSubjectAssign(BaseModel):
    teacher_id: uuid.UUID
    subject_id: uuid.UUID
    role_in_subject: str = Field(default="TEACHER", min_length=1, max_length=50)


class HodMentorMentee(BaseModel):
    mentor_assignment_id: uuid.UUID | None = None
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    class_id: uuid.UUID
    class_name: str
    assigned_at: datetime | None = None
    attendance_percentage: float | None = None


class HodMentorGroup(BaseModel):
    mentor_id: uuid.UUID
    mentor_name: str
    designation: str | None = None
    email: str | None = None
    mentees: list[HodMentorMentee] = Field(default_factory=list)
    at_risk_count: int


class HodMentorCandidate(BaseModel):
    id: uuid.UUID
    name: str
    designation: str | None = None
    is_mentor: bool


class HodMentorBoard(BaseModel):
    departments: list[PrincipalTargetOption]
    academic_year: str | None = None
    attendance_threshold: int | None = None
    mentor_role_in_use: bool
    groups: list[HodMentorGroup]
    unassigned_students: list[HodMentorMentee]
    eligible_teachers: list[HodMentorCandidate]


class HodMentorAssign(BaseModel):
    student_id: uuid.UUID
    mentor_id: uuid.UUID
    notes: str | None = Field(default=None, max_length=2000)


class HodNoticePage(PrincipalPage):
    items: list[LeadershipNoticeRow]


class HodNoticeDetail(LeadershipNoticeRow):
    """HOD notices deliberately omit Principal-only read receipt data."""


class HodDiscussionThread(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author_name: str | None = None
    scope_type: str
    scope_id: uuid.UUID
    tags: list[str] = Field(default_factory=list)
    is_pinned: bool
    is_locked: bool
    is_resolved: bool
    reply_count: int
    upvote_count: int
    created_at: datetime
    updated_at: datetime


class HodDiscussionPage(PrincipalPage):
    items: list[HodDiscussionThread]


class HodDiscussionModeration(BaseModel):
    action: Literal["PIN", "UNPIN", "LOCK", "UNLOCK", "DELETE"]


# ── API envelope aliases ─────────────────────────────────────────────────────

APIResponseHodDashboard = APIResponse[HodDashboard]
APIResponseHodAttendance = APIResponse[PrincipalAttendanceOverview]
APIResponseHodAttendanceDetail = APIResponse[HodAttendanceDetailPage]
APIResponseHodExams = APIResponse[PrincipalExamPage]
APIResponseHodAssignments = APIResponse[HodAssignmentsOverview]
APIResponseHodResults = APIResponse[PrincipalResultsOverview]
APIResponseHodTeachers = APIResponse[HodTeachersBoard]
APIResponseHodTeacher = APIResponse[HodTeacherRow]
APIResponseHodMentors = APIResponse[HodMentorBoard]
APIResponseHodMentorAssign = APIResponse[HodMentorBoard]
APIResponseHodNotices = APIResponse[HodNoticePage]
APIResponseHodNotice = APIResponse[HodNoticeDetail]
APIResponseHodNoticeTargets = APIResponse[PrincipalNoticeTargets]
APIResponseHodDiscussion = APIResponse[HodDiscussionPage]
APIResponseHodDiscussionThread = APIResponse[HodDiscussionThread]
APIResponseHodTimetable = APIResponse[PrincipalTimetable]
