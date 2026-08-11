"""Wire contracts for the Exam Controller console (C-EC-01 … C-EC-10).

Mirrors the docs in ``doc/complete_webpage_developer_assignment.md`` and the
data boundaries in ``role_based_system_design.md`` §4.6.  The Exam
Controller owns the institution-wide examination module: scheduling, hall
allocation, malpractice resolution, result compilation, publication and
reporting.  Every contract below is tenant-scoped and matches the canonical
rows owned by the base schema or the controller's own publication/grade
card tables.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import APIResponse

# ── Shared paging contracts ──────────────────────────────────────────────────


class ExamControllerPage(BaseModel):
    total: int
    limit: int
    offset: int


# ── Dashboard (C-EC-01) ──────────────────────────────────────────────────────


class ExamControllerStatusBucket(BaseModel):
    status: str
    count: int


class ExamControllerDashboard(BaseModel):
    academic_year: str | None = None
    today: date
    total_exams: int
    by_status: list[ExamControllerStatusBucket]
    upcoming: list["ExamControllerExamRow"]
    ongoing: list["ExamControllerExamRow"]
    pending_grading: int
    pending_hall_allocation: int
    pending_publication: int
    flagged_attempts: int
    next_publication: "ExamControllerPublicationRow | None" = None
    recent_publishes: list["ExamControllerPublicationRow"]


# ── Exam schedule (C-EC-02) ──────────────────────────────────────────────────


class ExamControllerExamRow(BaseModel):
    id: uuid.UUID
    title: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    exam_type: str
    mode: str
    total_marks: int
    passing_marks: int
    duration_minutes: int
    scheduled_at: datetime
    window_end_at: datetime | None = None
    status: str
    schedule_approval_status: str
    halls_allocated: int
    halls_required: int
    enrolled_count: int
    submitted_count: int
    pending_grading_count: int
    created_by: uuid.UUID
    created_by_name: str | None = None
    academic_year_id: uuid.UUID | None = None


class ExamControllerExamPage(ExamControllerPage):
    items: list[ExamControllerExamRow]


class ExamControllerClassOption(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None


class ExamControllerSubjectOption(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    department_id: uuid.UUID | None = None


class ExamControllerScheduleContext(BaseModel):
    classes: list[ExamControllerClassOption]
    subjects: list[ExamControllerSubjectOption]
    default_duration_minutes: int
    today: date
    # Window used to clamp a new exam's scheduled_at; surfaced so the form
    # can show a warning rather than blocking an edit of a past record.
    past_date_window_days: int
    scheduled: list["ExamControllerScheduledSlot"]
    # Current active academic year — used by the form so it can pre-fill
    # academic_year_id without a separate lookup.
    current_academic_year_id: uuid.UUID | None = None


class ExamControllerScheduledSlot(BaseModel):
    exam_id: uuid.UUID
    title: str
    class_id: uuid.UUID
    class_name: str
    subject_code: str
    mode: str
    status: str
    scheduled_at: datetime
    duration_minutes: int
    rooms: list[str]
    invigilator_names: list[str]


class ExamControllerScheduleClash(BaseModel):
    kind: Literal["CLASS_BUSY", "ROOM_TAKEN", "INVIGILATOR_BUSY", "PAST_DATE"]
    message: str
    blocking: bool
    exam_id: uuid.UUID | None = None


# ── Create / edit exam schedule (C-EC-03) ────────────────────────────────────


class ExamControllerExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    subject_id: uuid.UUID
    class_id: uuid.UUID
    academic_year_id: uuid.UUID
    exam_type: Literal["MCQ", "DESCRIPTIVE", "MIXED", "QUIZ"]
    mode: Literal["ONLINE", "OFFLINE"] = "ONLINE"
    total_marks: int = Field(ge=1, le=1000)
    passing_marks: int = Field(ge=0, le=1000)
    duration_minutes: int = Field(ge=1, le=24 * 60)
    scheduled_at: datetime
    window_end_at: datetime | None = None
    instructions: str | None = Field(default=None, max_length=4000)
    allow_review: bool = False
    shuffle_questions: bool = False
    show_score_immediately: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "ExamControllerExamCreate":
        if self.passing_marks > self.total_marks:
            raise ValueError("passing_marks cannot exceed total_marks")
        if self.window_end_at and self.window_end_at <= self.scheduled_at:
            raise ValueError("window_end_at must be after scheduled_at")
        return self


class ExamControllerExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    scheduled_at: datetime | None = None
    window_end_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=24 * 60)
    total_marks: int | None = Field(default=None, ge=1, le=1000)
    passing_marks: int | None = Field(default=None, ge=0, le=1000)
    instructions: str | None = Field(default=None, max_length=4000)
    allow_review: bool | None = None
    shuffle_questions: bool | None = None
    show_score_immediately: bool | None = None
    mode: Literal["ONLINE", "OFFLINE"] | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ExamControllerExamUpdate":
        if (
            self.total_marks is not None
            and self.passing_marks is not None
            and self.passing_marks > self.total_marks
        ):
            raise ValueError("passing_marks cannot exceed total_marks")
        if (
            self.scheduled_at is not None
            and self.window_end_at is not None
            and self.window_end_at <= self.scheduled_at
        ):
            raise ValueError("window_end_at must be after scheduled_at")
        return self


class ExamControllerClashCheckRequest(BaseModel):
    class_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = Field(ge=1, le=24 * 60)
    rooms: list[str] = Field(default_factory=list)
    invigilator_names: list[str] = Field(default_factory=list)
    editing_exam_id: uuid.UUID | None = None


class ExamControllerClashCheckResponse(BaseModel):
    clashes: list[ExamControllerScheduleClash]
    has_blocking: bool


class ExamControllerExamStatusUpdate(BaseModel):
    """Lifecycle transitions the controller can perform unilaterally.

    §4.6 grants the controller the publish + release levers for the
    examination module.  Cancellation is included because a controller
    must be able to call off an exam the principal cannot see in time.
    """

    action: Literal["PUBLISH", "CANCEL", "COMPLETE", "RELEASE_RESULTS"]
    note: str | None = Field(default=None, max_length=2000)


# ── Hall allocation (C-EC-04) ────────────────────────────────────────────────


class ExamControllerHallAllocationRow(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    room_no: str
    invigilator_id: uuid.UUID | None = None
    invigilator_name: str | None = None
    student_ids: list[uuid.UUID]
    seated_count: int
    capacity: int
    created_at: datetime


class ExamControllerHallBoardExam(BaseModel):
    exam: ExamControllerExamRow
    halls: list[ExamControllerHallAllocationRow]
    enrolled: int
    seated: int
    capacity: int
    rooms_outstanding: int
    invigilators_missing: int
    ready: bool


class ExamControllerHallBoard(BaseModel):
    exams: list[ExamControllerHallBoardExam]
    rooms: list["ExamControllerRoomOption"]
    invigilators: list["ExamControllerInvigilatorOption"]
    total_exams: int
    ready_exams: int
    rooms_outstanding: int
    invigilators_missing: int


class ExamControllerRoomOption(BaseModel):
    room_no: str
    capacity: int


class ExamControllerInvigilatorOption(BaseModel):
    id: uuid.UUID
    name: str
    department_id: uuid.UUID | None = None
    department_name: str | None = None
    designation: str | None = None
    is_active: bool


class ExamControllerHallAllocationCreate(BaseModel):
    exam_id: uuid.UUID
    room_no: str = Field(min_length=1, max_length=50)
    capacity: int = Field(ge=1, le=500)
    invigilator_id: uuid.UUID | None = None
    student_ids: list[uuid.UUID] = Field(default_factory=list)


class ExamControllerHallAllocationUpdate(BaseModel):
    invigilator_id: uuid.UUID | None = None
    capacity: int | None = Field(default=None, ge=1, le=500)
    student_ids: list[uuid.UUID] | None = None


# ── Active exams monitor (C-EC-05) ──────────────────────────────────────────


class ExamControllerAttemptRow(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    status: str
    started_at: datetime
    submitted_at: datetime | None = None
    total_score: float | None = None
    percentage: float | None = None
    tab_switch_count: int
    ip_address: str | None = None
    device_info: str | None = None


class ExamControllerMonitoredExam(BaseModel):
    exam: ExamControllerExamRow
    attempts: list[ExamControllerAttemptRow]
    in_progress: int
    submitted: int
    not_started: int
    flagged: int
    minutes_remaining: int
    response_rate: int
    window_end_at: datetime | None = None


class ExamControllerMonitorBoard(BaseModel):
    live: list[ExamControllerMonitoredExam]
    starting_soon: list["ExamControllerStartingSoon"]
    total_candidates: int
    total_in_progress: int
    total_flagged: int
    now: datetime


class ExamControllerStartingSoon(BaseModel):
    exam: ExamControllerExamRow
    minutes_until_start: int
    mode: str


# ── Malpractice logs (C-EC-06) ──────────────────────────────────────────────


class ExamControllerMalpracticeRow(BaseModel):
    id: uuid.UUID
    attempt_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    exam_id: uuid.UUID
    exam_title: str
    subject_code: str
    class_name: str
    department_name: str | None = None
    type: str
    description: str | None = None
    evidence_url: str | None = None
    action_taken: str | None = None
    logged_at: datetime
    handled_by: uuid.UUID | None = None
    handled_by_name: str | None = None
    tab_switch_count: int
    attempt_status: str


class ExamControllerMalpracticeBoard(BaseModel):
    cases: list[ExamControllerMalpracticeRow]
    open_count: int
    warned: int
    disqualified: int
    ignored: int
    exams: list["ExamControllerMalpracticeExamOption"]


class ExamControllerMalpracticeExamOption(BaseModel):
    id: uuid.UUID
    title: str


class ExamControllerMalpracticeAction(BaseModel):
    action: Literal["WARNED", "DISQUALIFIED", "IGNORED"]
    note: str | None = Field(default=None, max_length=2000)


# ── Results compilation (C-EC-07) ───────────────────────────────────────────


class ExamControllerResultSourceExam(BaseModel):
    id: uuid.UUID
    title: str
    subject_code: str
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    total_marks: int
    passing_marks: int
    attempts: int
    submitted: int
    graded: int
    pending_grading: int


class ExamControllerResultCompilationContext(BaseModel):
    academic_year: str | None = None
    classes: list[ExamControllerClassOption]
    available_exams: list[ExamControllerResultSourceExam]
    today: date


class ExamControllerCompilationPreview(BaseModel):
    exam_count: int
    students: int
    attempts_pending: int
    attempts_submitted: int
    attempts_graded: int
    by_exam: list[ExamControllerResultSourceExam]


class ExamControllerPublicationRow(BaseModel):
    id: uuid.UUID
    title: str
    academic_year: str | None = None
    class_id: uuid.UUID | None = None
    class_name: str | None = None
    exam_ids: list[uuid.UUID]
    exam_titles: list[str]
    compiled_by: uuid.UUID
    compiled_by_name: str | None = None
    compiled_at: datetime
    published_at: datetime | None = None
    status: str
    student_count: int
    pass_count: int
    fail_count: int
    withheld_count: int
    note: str | None = None


class ExamControllerPublicationPage(ExamControllerPage):
    items: list[ExamControllerPublicationRow]


class ExamControllerPublicationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    academic_year_id: uuid.UUID
    class_id: uuid.UUID | None = None
    exam_ids: list[uuid.UUID] = Field(min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("exam_ids")
    @classmethod
    def _unique_exams(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(value)) != len(value):
            raise ValueError("exam_ids must be unique")
        return value


class ExamControllerPublicationForwardRequest(BaseModel):
    """Hand the compiled publication off to the principal approval queue.

    §4.6 lets the controller *compile* and *publish* results, but
    institution governance routes publication through the principal
    queue. The controller records the intent here; the principal service
    flips the canonical row's approval state on submit.
    """

    note: str | None = Field(default=None, max_length=2000)


# ── Publish results (C-EC-08) ────────────────────────────────────────────────


class ExamControllerPublishRequest(BaseModel):
    publish: bool = True
    notify_students: bool = True
    note: str | None = Field(default=None, max_length=2000)


# ── Grade cards (C-EC-09) ────────────────────────────────────────────────────


class ExamControllerGradeCardRow(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    publication_title: str
    student_id: uuid.UUID
    student_name: str
    roll_no: str | None = None
    class_id: uuid.UUID
    class_name: str
    total_marks_obtained: Decimal
    total_marks_possible: Decimal
    percentage: Decimal
    grade: str
    rank: int | None = None
    subject_scores: list[dict]
    status: str
    generated_at: datetime | None = None
    published_at: datetime | None = None


class ExamControllerGradeCardClassGroup(BaseModel):
    class_id: uuid.UUID
    class_name: str
    publication_id: uuid.UUID
    publication_title: str
    total: int
    generated: int
    published: int
    failed: int
    pending: int
    cards: list[ExamControllerGradeCardRow]


class ExamControllerGradeCardsOverview(BaseModel):
    publications: list[ExamControllerPublicationRow]
    groups: list[ExamControllerGradeCardClassGroup]
    total_cards: int
    total_published: int
    total_pending: int
    total_failed: int


class ExamControllerGradeCardRegenerateRequest(BaseModel):
    publication_id: uuid.UUID
    note: str | None = Field(default=None, max_length=2000)


# ── Exam reports (C-EC-10) ───────────────────────────────────────────────────


class ExamControllerReportClassSummary(BaseModel):
    class_id: uuid.UUID
    class_name: str
    department_name: str | None = None
    students: int
    pass_count: int
    fail_count: int
    withheld_count: int
    pass_percentage: float
    average_percentage: float


class ExamControllerReportSubjectSummary(BaseModel):
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    exams: int
    students: int
    pass_count: int
    pass_percentage: float
    average_percentage: float


class ExamControllerReportTopper(BaseModel):
    student_id: uuid.UUID
    student_name: str
    roll_no: str | None = None
    class_name: str
    publication_id: uuid.UUID
    publication_title: str
    percentage: Decimal
    grade: str
    rank: int | None = None


class ExamControllerReportOverview(BaseModel):
    academic_year: str | None = None
    total_publications: int
    total_published: int
    total_students_compiled: int
    pass_percentage: float
    by_class: list[ExamControllerReportClassSummary]
    by_subject: list[ExamControllerReportSubjectSummary]
    toppers: list[ExamControllerReportTopper]


# Resolve forward references.
ExamControllerDashboard.model_rebuild()
ExamControllerScheduleContext.model_rebuild()
ExamControllerHallBoard.model_rebuild()
ExamControllerMonitorBoard.model_rebuild()
ExamControllerMalpracticeBoard.model_rebuild()


# ── APIResponse envelopes ────────────────────────────────────────────────────


APIResponseExamControllerDashboard = APIResponse[ExamControllerDashboard]
APIResponseExamControllerExamPage = APIResponse[ExamControllerExamPage]
APIResponseExamControllerExamRow = APIResponse[ExamControllerExamRow]
APIResponseExamControllerScheduleContext = APIResponse[ExamControllerScheduleContext]
APIResponseExamControllerClashCheck = APIResponse[ExamControllerClashCheckResponse]
APIResponseExamControllerHallBoard = APIResponse[ExamControllerHallBoard]
APIResponseExamControllerHallAllocation = APIResponse[ExamControllerHallAllocationRow]
APIResponseExamControllerMonitor = APIResponse[ExamControllerMonitorBoard]
APIResponseExamControllerMalpractice = APIResponse[ExamControllerMalpracticeBoard]
APIResponseExamControllerMalpracticeRow = APIResponse[ExamControllerMalpracticeRow]
APIResponseExamControllerResultContext = APIResponse[ExamControllerResultCompilationContext]
APIResponseExamControllerPreview = APIResponse[ExamControllerCompilationPreview]
APIResponseExamControllerPublicationPage = APIResponse[ExamControllerPublicationPage]
APIResponseExamControllerPublication = APIResponse[ExamControllerPublicationRow]
APIResponseExamControllerGradeCards = APIResponse[ExamControllerGradeCardsOverview]
APIResponseExamControllerReport = APIResponse[ExamControllerReportOverview]
APIResponseExamControllerEmpty = APIResponse[None]
