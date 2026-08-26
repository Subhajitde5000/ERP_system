"""Wire contracts for the Online Class module.

Snake_case payloads, matching the other institution console clients
(``fontend/lib/online-class.ts`` mirrors these one-to-one).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import APIResponse
from app.schemas.teacher import TeacherScheduleSlot, TeachingAssignment


# ── Setup options (teacher) ───────────────────────────────────────────────────


class OnlineClassSetupOptions(BaseModel):
    assignments: list[TeachingAssignment]
    today_slots: list[TeacherScheduleSlot]


# ── Create / update payloads ──────────────────────────────────────────────────


class OnlineClassCreate(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    topic: str = Field(min_length=1, max_length=255)
    scheduled_at: datetime | None = None
    duration_minutes: int = Field(default=60, ge=5, le=480)
    allow_join: bool = True
    recording_enabled: bool = False
    timetable_slot_id: uuid.UUID | None = None


class OnlineClassUpdate(BaseModel):
    allow_join: bool | None = None
    recording_enabled: bool | None = None


# ── Rows ──────────────────────────────────────────────────────────────────────


class OnlineClassRow(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    teacher_id: uuid.UUID
    teacher_name: str
    topic: str
    mode: str
    status: str
    scheduled_at: datetime | None = None
    duration_minutes: int
    allow_join: bool
    recording_enabled: bool
    recording_url: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime
    participant_count: int = 0


class OnlineParticipantRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    waiting_since: datetime
    joined_at: datetime | None = None
    left_at: datetime | None = None
    duration_seconds: int = 0
    attendance_status: str | None = None
    hand_raised_at: datetime | None = None
    is_online: bool = False


class OnlineFileRow(BaseModel):
    id: uuid.UUID
    uploader_name: str
    file_name: str
    url: str
    file_size_bytes: int
    mime_type: str
    created_at: datetime


class OnlineMessageRow(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_role: str
    body: str
    created_at: datetime


class OnlineMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class OnlineClassDetail(OnlineClassRow):
    roster_size: int = 0
    participants: list[OnlineParticipantRow] = []
    files: list[OnlineFileRow] = []
    join_state: str | None = None  # populated for the student view


class OnlineClassPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[OnlineClassRow]


# ── Attendance (the automatic report) ────────────────────────────────────────


class OnlineAttendanceRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    joined_at: datetime | None = None
    left_at: datetime | None = None
    duration_seconds: int = 0
    percent: float | None = None
    attendance_status: str


class OnlineAttendanceReport(BaseModel):
    class_id: str
    class_name: str
    subject_name: str
    topic: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int
    present_min_percent: float
    late_min_percent: float
    totals_present: int
    totals_late: int
    totals_absent: int
    rows: list[OnlineAttendanceRow]


# ── Student console ───────────────────────────────────────────────────────────


class StudentOnlineClassRow(OnlineClassRow):
    join_state: str  # NOT_ELIGIBLE | UPCOMING | JOINABLE | WAITING | IN_CLASS | ENDED


class StudentOnlineClassList(BaseModel):
    today: list[StudentOnlineClassRow]
    upcoming: list[StudentOnlineClassRow]
    past: list[StudentOnlineClassRow]


# ── Envelope aliases ──────────────────────────────────────────────────────────

APIResponseOnlineClassSetupOptions = APIResponse[OnlineClassSetupOptions]
APIResponseOnlineClass = APIResponse[OnlineClassRow]
APIResponseOnlineClassDetail = APIResponse[OnlineClassDetail]
APIResponseOnlineClassPage = APIResponse[OnlineClassPage]
APIResponseOnlineAttendanceReport = APIResponse[OnlineAttendanceReport]
APIResponseOnlineMessages = APIResponse[list[OnlineMessageRow]]
APIResponseOnlineMessage = APIResponse[OnlineMessageRow]
APIResponseOnlineFiles = APIResponse[list[OnlineFileRow]]
APIResponseOnlineFile = APIResponse[OnlineFileRow]
APIResponseStudentOnlineClasses = APIResponse[StudentOnlineClassList]
