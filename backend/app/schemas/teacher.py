"""Wire contracts for the Teacher console (C-TC-01 … C-TC-22).

Shapes mirror the canonical tables rather than the screens, so one response can
serve several pages without a second endpoint. Everything a teacher may act on
is keyed by an id the server has already proved is inside their subject scope —
no payload carries a class or subject as *authority*, only as a selector.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import APIResponse

# ── Shared option shapes ─────────────────────────────────────────────────────


class TeacherSubjectOption(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    class_id: uuid.UUID
    class_name: str
    subject_type: str
    role_in_subject: str


class TeacherClassOption(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    department_id: uuid.UUID
    department_name: str | None = None
    student_count: int = 0
    is_class_teacher: bool = False


class TeacherPage(BaseModel):
    total: int
    limit: int
    offset: int


# ── C-TC-01 dashboard ────────────────────────────────────────────────────────


class TeacherTodayClass(BaseModel):
    slot_id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    period_number: int
    start_time: time
    end_time: time
    room_no: str | None = None
    slot_type: str
    #: True when an attendance session already exists for this slot today, so
    #: the dashboard can show "Marked" instead of offering a duplicate.
    attendance_marked: bool = False
    #: Set when the coordinator arranged a substitute for today (C-AC-06).
    substituted_to_name: str | None = None


class TeacherUpcomingExam(BaseModel):
    id: uuid.UUID
    title: str
    class_name: str
    subject_code: str
    scheduled_at: datetime
    status: str
    mode: str


class TeacherPendingReview(BaseModel):
    assignment_id: uuid.UUID
    assignment_title: str
    class_name: str
    subject_code: str
    due_date: datetime
    pending_count: int


class TeacherNoticeRow(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author_name: str | None = None
    target_scope: str
    target_id: uuid.UUID | None = None
    target_name: str | None = None
    priority: str
    is_pinned: bool
    published_at: datetime
    expires_at: datetime | None = None


class TeacherDashboard(BaseModel):
    academic_year: str | None = None
    subject_count: int
    class_count: int
    student_count: int
    today: date
    today_classes: list[TeacherTodayClass] = Field(default_factory=list)
    unmarked_session_count: int
    pending_submission_count: int
    pending_leave_count: int
    upcoming_exam_count: int
    upcoming_exams: list[TeacherUpcomingExam] = Field(default_factory=list)
    pending_reviews: list[TeacherPendingReview] = Field(default_factory=list)
    recent_notices: list[TeacherNoticeRow] = Field(default_factory=list)
    subjects: list[TeacherSubjectOption] = Field(default_factory=list)
    classes: list[TeacherClassOption] = Field(default_factory=list)


# ── C-TC-02 schedule ─────────────────────────────────────────────────────────


class TeacherScheduleSlot(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    room_no: str | None = None
    slot_type: str


class TeacherSchedule(BaseModel):
    academic_year: str | None = None
    slots: list[TeacherScheduleSlot] = Field(default_factory=list)


# ── C-TC-03 / C-TC-04 / C-TC-05 attendance ───────────────────────────────────


class TeacherRosterStudent(BaseModel):
    student_id: uuid.UUID
    name: str
    roll_number: str | None = None
    #: Cumulative percentage for this subject, so the marking sheet can flag a
    #: learner who is about to fall below the tenant threshold.
    overall_percentage: float | None = None
    status: str = "PRESENT"
    late_by_minutes: int | None = None
    remarks: str | None = None


class TeacherMarkContext(BaseModel):
    date: date
    subjects: list[TeacherSubjectOption] = Field(default_factory=list)
    classes: list[TeacherClassOption] = Field(default_factory=list)
    roster: list[TeacherRosterStudent] = Field(default_factory=list)
    existing_session_id: uuid.UUID | None = None
    is_locked: bool = False
    period_label: str | None = None


class TeacherAttendanceMark(BaseModel):
    student_id: uuid.UUID
    status: Literal["PRESENT", "ABSENT", "LATE", "EXCUSED"]
    late_by_minutes: int | None = Field(default=None, ge=0, le=600)
    remarks: str | None = Field(default=None, max_length=255)


class TeacherSessionCreate(BaseModel):
    subject_id: uuid.UUID
    class_id: uuid.UUID
    date: date
    period_label: str = Field(min_length=1, max_length=30)
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = Field(default=None, max_length=2000)
    records: list[TeacherAttendanceMark] = Field(min_length=1)

    @model_validator(mode="after")
    def _validate(self) -> "TeacherSessionCreate":
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        seen: set[uuid.UUID] = set()
        for record in self.records:
            if record.student_id in seen:
                raise ValueError("A student may only be marked once per session")
            seen.add(record.student_id)
        return self


class TeacherSessionUpdate(BaseModel):
    """Corrections before the session is locked."""

    records: list[TeacherAttendanceMark] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _unique(self) -> "TeacherSessionUpdate":
        seen: set[uuid.UUID] = set()
        for record in self.records:
            if record.student_id in seen:
                raise ValueError("A student may only be marked once per session")
            seen.add(record.student_id)
        return self


class TeacherSessionRow(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    date: date
    period_label: str
    start_time: time | None = None
    end_time: time | None = None
    total_present: int
    total_absent: int
    total_marked: int
    attendance_percentage: float | None = None
    is_locked: bool
    locked_at: datetime | None = None
    created_at: datetime


class TeacherSessionPage(TeacherPage):
    items: list[TeacherSessionRow] = Field(default_factory=list)


class TeacherSessionDetail(TeacherSessionRow):
    notes: str | None = None
    records: list[TeacherRosterStudent] = Field(default_factory=list)


# ── C-TC-06 student leave review ─────────────────────────────────────────────


class TeacherLeaveRow(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    class_id: uuid.UUID
    class_name: str
    from_date: date
    to_date: date
    total_days: int
    reason: str
    document_url: str | None = None
    status: str
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class TeacherLeavePage(TeacherPage):
    pending_count: int = 0
    items: list[TeacherLeaveRow] = Field(default_factory=list)


class TeacherLeaveDecision(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    note: str | None = Field(default=None, max_length=1000)


# ── C-TC-07 … C-TC-11 examinations ───────────────────────────────────────────


class TeacherExamRow(BaseModel):
    id: uuid.UUID
    title: str
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    exam_type: str
    mode: str
    total_marks: int
    passing_marks: int
    duration_minutes: int
    scheduled_at: datetime
    window_end_at: datetime | None = None
    status: str
    schedule_approval_status: str
    allow_review: bool
    shuffle_questions: bool
    show_score_immediately: bool
    instructions: str | None = None
    question_count: int = 0
    total_question_marks: float = 0
    attempt_count: int = 0
    submitted_count: int = 0
    graded_count: int = 0
    pending_grading_count: int = 0


class TeacherExamPage(TeacherPage):
    items: list[TeacherExamRow] = Field(default_factory=list)


class TeacherExamCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    subject_id: uuid.UUID
    exam_type: Literal["MCQ", "DESCRIPTIVE", "MIXED", "QUIZ"]
    mode: Literal["ONLINE", "OFFLINE"] = "ONLINE"
    total_marks: int = Field(ge=1, le=1000)
    passing_marks: int = Field(ge=0, le=1000)
    duration_minutes: int = Field(ge=5, le=600)
    scheduled_at: datetime
    window_end_at: datetime | None = None
    instructions: str | None = Field(default=None, max_length=5000)
    allow_review: bool = False
    shuffle_questions: bool = False
    show_score_immediately: bool = False

    @model_validator(mode="after")
    def _validate(self) -> "TeacherExamCreate":
        if self.passing_marks > self.total_marks:
            raise ValueError("passing_marks cannot exceed total_marks")
        if self.window_end_at and self.window_end_at <= self.scheduled_at:
            raise ValueError("window_end_at must be after scheduled_at")
        return self


class TeacherExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    exam_type: Literal["MCQ", "DESCRIPTIVE", "MIXED", "QUIZ"] | None = None
    mode: Literal["ONLINE", "OFFLINE"] | None = None
    total_marks: int | None = Field(default=None, ge=1, le=1000)
    passing_marks: int | None = Field(default=None, ge=0, le=1000)
    duration_minutes: int | None = Field(default=None, ge=5, le=600)
    scheduled_at: datetime | None = None
    window_end_at: datetime | None = None
    instructions: str | None = Field(default=None, max_length=5000)
    allow_review: bool | None = None
    shuffle_questions: bool | None = None
    show_score_immediately: bool | None = None
    status: Literal["DRAFT", "PUBLISHED", "CANCELLED"] | None = None


class TeacherQuestionOption(BaseModel):
    id: uuid.UUID | None = None
    text: str = Field(min_length=1, max_length=2000)
    is_correct: bool = False
    sort_order: int = 0


class TeacherQuestionRow(BaseModel):
    id: uuid.UUID
    text: str
    question_type: str
    marks: float
    negative_marks: float
    explanation: str | None = None
    difficulty: str | None = None
    sort_order: int
    options: list[TeacherQuestionOption] = Field(default_factory=list)


class TeacherQuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    question_type: Literal[
        "MCQ", "SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE", "FILL_BLANK", "MATCH"
    ]
    marks: float = Field(gt=0, le=100)
    negative_marks: float = Field(default=0, ge=0, le=100)
    explanation: str | None = Field(default=None, max_length=2000)
    difficulty: Literal["EASY", "MEDIUM", "HARD"] | None = None
    sort_order: int = Field(default=0, ge=0, le=10_000)
    options: list[TeacherQuestionOption] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate(self) -> "TeacherQuestionCreate":
        # An auto-gradable question with no correct option would silently score
        # every student zero, so the engine refuses to store one.
        if self.question_type in {"MCQ", "TRUE_FALSE"}:
            if len(self.options) < 2:
                raise ValueError("Objective questions need at least two options")
            if not any(option.is_correct for option in self.options):
                raise ValueError("Mark at least one option correct")
        elif self.options:
            raise ValueError("Only MCQ and TRUE_FALSE questions carry options")
        return self


class TeacherExamPaper(BaseModel):
    exam: TeacherExamRow
    questions: list[TeacherQuestionRow] = Field(default_factory=list)


class TeacherAnswerRow(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    question_text: str
    question_type: str
    question_marks: float
    selected_option_id: uuid.UUID | None = None
    selected_option_text: str | None = None
    text_answer: str | None = None
    score: float | None = None
    is_auto_graded: bool
    feedback: str | None = None
    needs_grading: bool


class TeacherAttemptRow(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    started_at: datetime
    submitted_at: datetime | None = None
    auto_submitted: bool
    total_score: float | None = None
    percentage: float | None = None
    grade: str | None = None
    status: str
    tab_switch_count: int
    ungraded_count: int


class TeacherExamResults(BaseModel):
    exam: TeacherExamRow
    attempts: list[TeacherAttemptRow] = Field(default_factory=list)
    not_attempted: list[TeacherRosterStudent] = Field(default_factory=list)
    average_percentage: float | None = None
    pass_count: int = 0
    fail_count: int = 0


class TeacherAttemptDetail(BaseModel):
    attempt: TeacherAttemptRow
    exam: TeacherExamRow
    answers: list[TeacherAnswerRow] = Field(default_factory=list)


class TeacherAnswerGrade(BaseModel):
    answer_id: uuid.UUID
    score: float = Field(ge=0, le=1000)
    feedback: str | None = Field(default=None, max_length=2000)


class TeacherGradeRequest(BaseModel):
    grades: list[TeacherAnswerGrade] = Field(min_length=1)


# ── C-TC-12 … C-TC-16 assignments ────────────────────────────────────────────


class TeacherMilestoneInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    marks: int = Field(ge=0, le=1000)
    due_date: datetime | None = None


class TeacherMilestoneRow(TeacherMilestoneInput):
    id: uuid.UUID
    sort_order: int
    submitted_count: int = 0
    approved_count: int = 0


class TeacherAssignmentRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    assignment_type: str
    total_marks: int
    passing_marks: int
    due_date: datetime
    status: str
    allow_late_submission: bool
    late_penalty_percent: int
    is_overdue: bool
    class_strength: int = 0
    submission_count: int = 0
    pending_review_count: int = 0
    approved_count: int = 0
    created_at: datetime


class TeacherAssignmentPage(TeacherPage):
    active_count: int = 0
    pending_review_count: int = 0
    overdue_count: int = 0
    items: list[TeacherAssignmentRow] = Field(default_factory=list)


class TeacherAssignmentCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=1, max_length=10_000)
    subject_id: uuid.UUID
    assignment_type: Literal["REGULAR", "MILESTONE", "GROUP"] = "REGULAR"
    total_marks: int = Field(ge=1, le=1000)
    passing_marks: int = Field(ge=0, le=1000)
    due_date: datetime
    allow_late_submission: bool = False
    late_penalty_percent: int = Field(default=0, ge=0, le=100)
    max_file_size_mb: int = Field(default=10, ge=1, le=200)
    allowed_file_types: list[str] = Field(default_factory=lambda: ["pdf", "doc", "docx", "zip"])
    publish: bool = False
    milestones: list[TeacherMilestoneInput] = Field(default_factory=list)

    @field_validator("allowed_file_types")
    @classmethod
    def _clean_types(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip().lstrip(".").lower() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("At least one file type must be allowed")
        return sorted(set(cleaned))

    @model_validator(mode="after")
    def _validate(self) -> "TeacherAssignmentCreate":
        if self.passing_marks > self.total_marks:
            raise ValueError("passing_marks cannot exceed total_marks")
        if self.assignment_type == "MILESTONE" and not self.milestones:
            raise ValueError("A milestone assignment needs at least one milestone")
        if self.assignment_type != "MILESTONE" and self.milestones:
            raise ValueError("Only MILESTONE assignments carry milestones")
        if self.milestones:
            total = sum(milestone.marks for milestone in self.milestones)
            if total != self.total_marks:
                raise ValueError("Milestone marks must add up to total_marks")
        return self


class TeacherAssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=1, max_length=10_000)
    due_date: datetime | None = None
    total_marks: int | None = Field(default=None, ge=1, le=1000)
    passing_marks: int | None = Field(default=None, ge=0, le=1000)
    allow_late_submission: bool | None = None
    late_penalty_percent: int | None = Field(default=None, ge=0, le=100)
    status: Literal["DRAFT", "PUBLISHED", "CLOSED"] | None = None


class TeacherAssignmentDetail(TeacherAssignmentRow):
    max_file_size_mb: int
    allowed_file_types: list[str] = Field(default_factory=list)
    milestones: list[TeacherMilestoneRow] = Field(default_factory=list)


class TeacherSubmissionFile(BaseModel):
    id: uuid.UUID
    file_name: str
    file_key: str
    file_size_bytes: int
    mime_type: str
    uploaded_at: datetime


class TeacherSubmissionRow(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    assignment_title: str
    milestone_id: uuid.UUID | None = None
    milestone_title: str | None = None
    student_id: uuid.UUID
    student_name: str
    roll_number: str | None = None
    class_name: str
    submitted_at: datetime
    is_late: bool
    late_by_minutes: int | None = None
    score: float | None = None
    grade: str | None = None
    feedback: str | None = None
    status: str
    version: int
    reviewed_at: datetime | None = None
    reviewed_by_name: str | None = None
    file_count: int = 0


class TeacherSubmissionBoard(BaseModel):
    assignment: TeacherAssignmentDetail
    submissions: list[TeacherSubmissionRow] = Field(default_factory=list)
    not_submitted: list[TeacherRosterStudent] = Field(default_factory=list)


class TeacherSubmissionReviewRow(BaseModel):
    id: uuid.UUID
    reviewer_name: str | None = None
    decision: str
    marks_awarded: float | None = None
    feedback: str | None = None
    attempt_number: int
    reviewed_at: datetime


class TeacherSubmissionDetail(TeacherSubmissionRow):
    text_response: str | None = None
    total_marks: int
    files: list[TeacherSubmissionFile] = Field(default_factory=list)
    reviews: list[TeacherSubmissionReviewRow] = Field(default_factory=list)


class TeacherSubmissionReview(BaseModel):
    decision: Literal["APPROVED", "REJECTED", "CHANGES_REQUESTED"]
    score: float | None = Field(default=None, ge=0, le=1000)
    feedback: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _validate(self) -> "TeacherSubmissionReview":
        if self.decision == "APPROVED" and self.score is None:
            raise ValueError("An approved submission needs a score")
        if self.decision != "APPROVED" and not (self.feedback or "").strip():
            raise ValueError("Explain why the submission was not approved")
        return self


# ── C-TC-17 / C-TC-18 content ────────────────────────────────────────────────


class TeacherContentRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    content_type: str
    file_key: str | None = None
    external_url: str | None = None
    file_size_bytes: int | None = None
    duration_seconds: int | None = None
    chapter: str | None = None
    sort_order: int
    is_visible: bool
    view_count: int
    download_count: int
    created_at: datetime


class TeacherContentPage(TeacherPage):
    chapters: list[str] = Field(default_factory=list)
    items: list[TeacherContentRow] = Field(default_factory=list)


class TeacherContentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    subject_id: uuid.UUID
    content_type: Literal["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"]
    file_key: str | None = Field(default=None, max_length=2000)
    external_url: str | None = Field(default=None, max_length=2000)
    file_size_bytes: int | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    chapter: str | None = Field(default=None, max_length=100)
    sort_order: int = Field(default=0, ge=0, le=10_000)
    is_visible: bool = True

    @model_validator(mode="after")
    def _validate(self) -> "TeacherContentCreate":
        if self.content_type == "LINK":
            url = (self.external_url or "").strip()
            if not url.startswith(("http://", "https://")):
                raise ValueError("A LINK resource needs an http(s) external_url")
        elif not (self.file_key or "").strip():
            raise ValueError("An uploaded resource needs a file_key")
        return self


class TeacherContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    chapter: str | None = Field(default=None, max_length=100)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
    is_visible: bool | None = None


# ── C-TC-19 / C-TC-20 notices ────────────────────────────────────────────────


class TeacherNoticePage(TeacherPage):
    items: list[TeacherNoticeRow] = Field(default_factory=list)


class TeacherNoticeCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    body: str = Field(min_length=1, max_length=20_000)
    class_id: uuid.UUID
    priority: Literal["NORMAL", "IMPORTANT", "URGENT"] = "NORMAL"
    expires_at: datetime | None = None


# ── C-TC-21 / C-TC-22 discussion ─────────────────────────────────────────────


class TeacherThreadRow(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author_id: uuid.UUID
    author_name: str | None = None
    scope_type: str
    scope_id: uuid.UUID
    scope_name: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_pinned: bool
    is_locked: bool
    is_resolved: bool
    reply_count: int
    upvote_count: int
    view_count: int
    created_at: datetime
    updated_at: datetime


class TeacherThreadPage(TeacherPage):
    items: list[TeacherThreadRow] = Field(default_factory=list)


class TeacherReplyRow(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None = None
    body: str
    is_accepted_answer: bool
    upvote_count: int
    created_at: datetime


class TeacherThreadDetail(TeacherThreadRow):
    replies: list[TeacherReplyRow] = Field(default_factory=list)


class TeacherThreadCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    body: str = Field(min_length=1, max_length=20_000)
    scope_type: Literal["CLASS", "SUBJECT"]
    scope_id: uuid.UUID
    tags: list[str] = Field(default_factory=list, max_length=8)


class TeacherReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=20_000)


class TeacherThreadModeration(BaseModel):
    action: Literal["PIN", "UNPIN", "LOCK", "UNLOCK", "RESOLVE", "REOPEN"]


# ── API envelope aliases ─────────────────────────────────────────────────────

APIResponseTeacherDashboard = APIResponse[TeacherDashboard]
APIResponseTeacherSchedule = APIResponse[TeacherSchedule]
APIResponseTeacherMarkContext = APIResponse[TeacherMarkContext]
APIResponseTeacherSessionPage = APIResponse[TeacherSessionPage]
APIResponseTeacherSessionDetail = APIResponse[TeacherSessionDetail]
APIResponseTeacherLeavePage = APIResponse[TeacherLeavePage]
APIResponseTeacherLeaveRow = APIResponse[TeacherLeaveRow]
APIResponseTeacherExamPage = APIResponse[TeacherExamPage]
APIResponseTeacherExamRow = APIResponse[TeacherExamRow]
APIResponseTeacherExamPaper = APIResponse[TeacherExamPaper]
APIResponseTeacherExamResults = APIResponse[TeacherExamResults]
APIResponseTeacherAttemptDetail = APIResponse[TeacherAttemptDetail]
APIResponseTeacherAssignmentPage = APIResponse[TeacherAssignmentPage]
APIResponseTeacherAssignmentDetail = APIResponse[TeacherAssignmentDetail]
APIResponseTeacherSubmissionBoard = APIResponse[TeacherSubmissionBoard]
APIResponseTeacherSubmissionDetail = APIResponse[TeacherSubmissionDetail]
APIResponseTeacherContentPage = APIResponse[TeacherContentPage]
APIResponseTeacherContentRow = APIResponse[TeacherContentRow]
APIResponseTeacherNoticePage = APIResponse[TeacherNoticePage]
APIResponseTeacherNoticeRow = APIResponse[TeacherNoticeRow]
APIResponseTeacherThreadPage = APIResponse[TeacherThreadPage]
APIResponseTeacherThreadDetail = APIResponse[TeacherThreadDetail]
APIResponseTeacherEmpty = APIResponse[dict]
