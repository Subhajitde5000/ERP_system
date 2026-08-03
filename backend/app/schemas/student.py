"""Wire contracts for the Student console (C-ST-01 … C-ST-20).

§4.9 limits a student to **their own data**, so nothing here accepts a student
id: the caller *is* the subject of every request. Ids that do appear (an exam,
an assignment, a result) are checked against the caller's enrolment before a
row is returned.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import APIResponse


class StudentPage(BaseModel):
    total: int
    limit: int
    offset: int


class StudentSubjectOption(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    subject_type: str
    teacher_names: list[str] = Field(default_factory=list)


# ── C-ST-01 dashboard / C-ST-02 profile ──────────────────────────────────────


class StudentTodayClass(BaseModel):
    slot_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    teacher_name: str | None = None
    period_number: int
    start_time: time
    end_time: time
    room_no: str | None = None
    slot_type: str


class StudentNoticeRow(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    author_name: str | None = None
    target_scope: str
    priority: str
    is_pinned: bool
    published_at: datetime
    expires_at: datetime | None = None
    is_read: bool = False


class StudentUpcomingExam(BaseModel):
    id: uuid.UUID
    title: str
    subject_code: str
    subject_name: str
    exam_type: str
    mode: str
    scheduled_at: datetime
    window_end_at: datetime | None = None
    duration_minutes: int
    total_marks: int
    status: str
    attempt_status: str | None = None
    can_attempt: bool = False


class StudentPendingAssignment(BaseModel):
    id: uuid.UUID
    title: str
    subject_code: str
    due_date: datetime
    is_overdue: bool
    status: str


class StudentDashboard(BaseModel):
    academic_year: str | None = None
    class_name: str
    roll_number: str | None = None
    today: date
    attendance_percentage: float | None = None
    attendance_threshold: int | None = None
    is_attendance_short: bool = False
    today_classes: list[StudentTodayClass] = Field(default_factory=list)
    pending_assignment_count: int = 0
    pending_assignments: list[StudentPendingAssignment] = Field(default_factory=list)
    upcoming_exam_count: int = 0
    upcoming_exams: list[StudentUpcomingExam] = Field(default_factory=list)
    unread_notice_count: int = 0
    recent_notices: list[StudentNoticeRow] = Field(default_factory=list)
    fee_balance_due: float | None = None
    subjects: list[StudentSubjectOption] = Field(default_factory=list)


class StudentProfile(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    roll_number: str | None = None
    class_id: uuid.UUID
    class_name: str
    department_name: str | None = None
    academic_year: str | None = None
    enrollment_date: date | None = None
    enrollment_status: str
    mentor_name: str | None = None


class StudentProfileUpdate(BaseModel):
    """The fields §4.9 lets a learner maintain themselves.

    Name, roll number and class are institution records — changing them is an
    admin action, so they are deliberately absent.
    """

    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=1000)
    avatar_url: str | None = Field(default=None, max_length=2000)


# ── C-ST-03 / C-ST-04 attendance ─────────────────────────────────────────────


class StudentSubjectAttendance(BaseModel):
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    total_sessions: int
    attendance_percentage: float | None = None
    is_short: bool = False


class StudentAttendanceDay(BaseModel):
    date: date
    #: Worst status of the day — one absence matters more than three presents.
    status: str
    present_count: int
    absent_count: int


class StudentAttendanceOverview(BaseModel):
    from_date: date
    to_date: date
    attendance_percentage: float | None = None
    attendance_threshold: int | None = None
    is_short: bool = False
    total_sessions: int
    present_count: int
    absent_count: int
    subjects: list[StudentSubjectAttendance] = Field(default_factory=list)
    days: list[StudentAttendanceDay] = Field(default_factory=list)


class StudentLeaveRow(BaseModel):
    id: uuid.UUID
    from_date: date
    to_date: date
    total_days: int
    reason: str
    document_url: str | None = None
    status: str
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class StudentLeavePage(StudentPage):
    items: list[StudentLeaveRow] = Field(default_factory=list)


class StudentLeaveCreate(BaseModel):
    from_date: date
    to_date: date
    reason: str = Field(min_length=5, max_length=2000)
    document_url: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _validate(self) -> "StudentLeaveCreate":
        if self.from_date > self.to_date:
            raise ValueError("from_date must be on or before to_date")
        if (self.to_date - self.from_date).days > 90:
            raise ValueError("A single leave request cannot span more than 90 days")
        return self


# ── C-ST-06 timetable ────────────────────────────────────────────────────────


class StudentTimetableSlot(BaseModel):
    id: uuid.UUID
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    subject_id: uuid.UUID | None = None
    subject_code: str | None = None
    subject_name: str | None = None
    teacher_name: str | None = None
    room_no: str | None = None
    slot_type: str


class StudentTimetable(BaseModel):
    class_name: str
    academic_year: str | None = None
    slots: list[StudentTimetableSlot] = Field(default_factory=list)


# ── C-ST-07 / C-ST-08 / C-ST-09 examinations ─────────────────────────────────


class StudentExamPage(StudentPage):
    items: list[StudentUpcomingExam] = Field(default_factory=list)


class StudentAttemptQuestionOption(BaseModel):
    id: uuid.UUID
    text: str
    sort_order: int


class StudentAttemptQuestion(BaseModel):
    id: uuid.UUID
    text: str
    question_type: str
    marks: float
    negative_marks: float
    image_url: str | None = None
    sort_order: int
    options: list[StudentAttemptQuestionOption] = Field(default_factory=list)
    selected_option_id: uuid.UUID | None = None
    text_answer: str | None = None


class StudentAttemptScreen(BaseModel):
    attempt_id: uuid.UUID
    exam_id: uuid.UUID
    title: str
    subject_code: str
    instructions: str | None = None
    total_marks: int
    duration_minutes: int
    started_at: datetime
    #: Server-computed deadline. The browser clock is advisory only — the
    #: submit path re-checks this before accepting answers.
    expires_at: datetime
    server_time: datetime
    tab_switch_count: int
    is_submitted: bool
    questions: list[StudentAttemptQuestion] = Field(default_factory=list)


class StudentAnswerInput(BaseModel):
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    text_answer: str | None = Field(default=None, max_length=20_000)


class StudentAnswerSave(BaseModel):
    answers: list[StudentAnswerInput] = Field(min_length=1, max_length=200)


class StudentAttemptSubmit(BaseModel):
    answers: list[StudentAnswerInput] = Field(default_factory=list)


class StudentTabSwitch(BaseModel):
    """Reported by the attempt screen when the tab loses focus."""

    count: int = Field(default=1, ge=1, le=10)


class StudentExamResultAnswer(BaseModel):
    question_id: uuid.UUID
    question_text: str
    question_type: str
    question_marks: float
    your_answer: str | None = None
    correct_answer: str | None = None
    score: float | None = None
    feedback: str | None = None
    explanation: str | None = None


class StudentExamResult(BaseModel):
    exam_id: uuid.UUID
    title: str
    subject_code: str
    subject_name: str
    total_marks: int
    passing_marks: int
    submitted_at: datetime | None = None
    total_score: float | None = None
    percentage: float | None = None
    grade: str | None = None
    is_pass: bool | None = None
    status: str
    #: False until grading completes or the teacher enables review.
    review_available: bool = False
    answers: list[StudentExamResultAnswer] = Field(default_factory=list)


# ── C-ST-10 … C-ST-12 assignments ────────────────────────────────────────────


class StudentMilestoneRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    marks: int
    due_date: datetime | None = None
    sort_order: int
    #: A stage stays locked until the previous one is approved (C-ST-12).
    is_locked: bool
    submission_id: uuid.UUID | None = None
    submission_status: str | None = None
    score: float | None = None
    feedback: str | None = None


class StudentSubmissionFile(BaseModel):
    id: uuid.UUID
    file_name: str
    file_key: str
    file_size_bytes: int
    mime_type: str
    uploaded_at: datetime


class StudentSubmissionRow(BaseModel):
    id: uuid.UUID
    milestone_id: uuid.UUID | None = None
    milestone_title: str | None = None
    text_response: str | None = None
    submitted_at: datetime
    is_late: bool
    late_by_minutes: int | None = None
    score: float | None = None
    grade: str | None = None
    feedback: str | None = None
    status: str
    version: int
    reviewed_at: datetime | None = None
    files: list[StudentSubmissionFile] = Field(default_factory=list)


class StudentAssignmentRow(BaseModel):
    id: uuid.UUID
    title: str
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    teacher_name: str | None = None
    assignment_type: str
    total_marks: int
    passing_marks: int
    due_date: datetime
    is_overdue: bool
    allow_late_submission: bool
    late_penalty_percent: int
    #: PENDING | SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | RESUBMIT_REQUESTED
    my_status: str
    my_score: float | None = None
    can_submit: bool


class StudentAssignmentPage(StudentPage):
    pending_count: int = 0
    submitted_count: int = 0
    items: list[StudentAssignmentRow] = Field(default_factory=list)


class StudentAssignmentDetail(StudentAssignmentRow):
    description: str
    max_file_size_mb: int
    allowed_file_types: list[str] = Field(default_factory=list)
    instructions_url: str | None = None
    milestones: list[StudentMilestoneRow] = Field(default_factory=list)
    submissions: list[StudentSubmissionRow] = Field(default_factory=list)


class StudentSubmissionFileInput(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_key: str = Field(min_length=1, max_length=2000)
    file_size_bytes: int = Field(ge=0)
    mime_type: str = Field(min_length=1, max_length=100)


class StudentSubmissionCreate(BaseModel):
    milestone_id: uuid.UUID | None = None
    text_response: str | None = Field(default=None, max_length=20_000)
    files: list[StudentSubmissionFileInput] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _validate(self) -> "StudentSubmissionCreate":
        if not (self.text_response or "").strip() and not self.files:
            raise ValueError("Attach a file or write a response before submitting")
        return self


# ── C-ST-13 / C-ST-14 content ────────────────────────────────────────────────


class StudentContentRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: uuid.UUID
    subject_code: str
    subject_name: str
    content_type: str
    file_key: str | None = None
    external_url: str | None = None
    file_size_bytes: int | None = None
    duration_seconds: int | None = None
    chapter: str | None = None
    uploaded_by_name: str | None = None
    created_at: datetime


class StudentContentPage(StudentPage):
    chapters: list[str] = Field(default_factory=list)
    subjects: list[StudentSubjectOption] = Field(default_factory=list)
    items: list[StudentContentRow] = Field(default_factory=list)


# ── C-ST-15 … C-ST-17 results ────────────────────────────────────────────────


class StudentResultRow(BaseModel):
    id: uuid.UUID
    publication_id: uuid.UUID
    publication_title: str
    published_at: datetime
    total_marks_obtained: float
    total_marks_possible: float
    percentage: float
    grade: str
    rank: int | None = None
    result: str


class StudentResultSubject(BaseModel):
    subject_code: str | None = None
    subject_name: str | None = None
    marks_obtained: float | None = None
    marks_possible: float | None = None
    grade: str | None = None


class StudentResultDetail(StudentResultRow):
    class_name: str
    remarks: str | None = None
    subjects: list[StudentResultSubject] = Field(default_factory=list)


class StudentResultList(BaseModel):
    items: list[StudentResultRow] = Field(default_factory=list)


# ── C-ST-18 notices ──────────────────────────────────────────────────────────


class StudentNoticePage(StudentPage):
    unread_count: int = 0
    items: list[StudentNoticeRow] = Field(default_factory=list)


# ── C-ST-19 discussion ───────────────────────────────────────────────────────


class StudentThreadRow(BaseModel):
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
    has_upvoted: bool = False
    is_mine: bool = False
    created_at: datetime
    updated_at: datetime


class StudentThreadPage(StudentPage):
    items: list[StudentThreadRow] = Field(default_factory=list)


class StudentReplyRow(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author_name: str | None = None
    body: str
    is_accepted_answer: bool
    upvote_count: int
    has_upvoted: bool = False
    is_mine: bool = False
    created_at: datetime


class StudentThreadDetail(StudentThreadRow):
    replies: list[StudentReplyRow] = Field(default_factory=list)


class StudentThreadCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    body: str = Field(min_length=1, max_length=20_000)
    subject_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list, max_length=8)


class StudentReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=20_000)


class StudentVote(BaseModel):
    target_type: Literal["THREAD", "REPLY"]
    target_id: uuid.UUID


# ── C-ST-20 fees ─────────────────────────────────────────────────────────────


class StudentInstallmentRow(BaseModel):
    id: uuid.UUID
    installment_number: int
    label: str
    amount: float
    due_date: date
    paid_amount: float
    late_fine: float
    status: str
    is_overdue: bool


class StudentPaymentRow(BaseModel):
    id: uuid.UUID
    amount: float
    payment_mode: str
    transaction_reference: str | None = None
    payment_date: date
    receipt_number: str
    notes: str | None = None


class StudentFeeAccountView(BaseModel):
    has_account: bool
    academic_year: str | None = None
    total_fee: float | None = None
    concession_amount: float | None = None
    scholarship_amount: float | None = None
    net_payable: float | None = None
    total_paid: float | None = None
    balance_due: float | None = None
    status: str | None = None
    installments: list[StudentInstallmentRow] = Field(default_factory=list)
    payments: list[StudentPaymentRow] = Field(default_factory=list)


# ── API envelope aliases ─────────────────────────────────────────────────────

APIResponseStudentDashboard = APIResponse[StudentDashboard]
APIResponseStudentProfile = APIResponse[StudentProfile]
APIResponseStudentAttendance = APIResponse[StudentAttendanceOverview]
APIResponseStudentLeavePage = APIResponse[StudentLeavePage]
APIResponseStudentLeaveRow = APIResponse[StudentLeaveRow]
APIResponseStudentTimetable = APIResponse[StudentTimetable]
APIResponseStudentExamPage = APIResponse[StudentExamPage]
APIResponseStudentAttemptScreen = APIResponse[StudentAttemptScreen]
APIResponseStudentExamResult = APIResponse[StudentExamResult]
APIResponseStudentAssignmentPage = APIResponse[StudentAssignmentPage]
APIResponseStudentAssignmentDetail = APIResponse[StudentAssignmentDetail]
APIResponseStudentContentPage = APIResponse[StudentContentPage]
APIResponseStudentContentRow = APIResponse[StudentContentRow]
APIResponseStudentResultList = APIResponse[StudentResultList]
APIResponseStudentResultDetail = APIResponse[StudentResultDetail]
APIResponseStudentNoticePage = APIResponse[StudentNoticePage]
APIResponseStudentThreadPage = APIResponse[StudentThreadPage]
APIResponseStudentThreadDetail = APIResponse[StudentThreadDetail]
APIResponseStudentFees = APIResponse[StudentFeeAccountView]
APIResponseStudentEmpty = APIResponse[dict]
