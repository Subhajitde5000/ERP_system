"""Wire contracts for the Parent portal (C-PA-01 … C-PA-12) and the admin's
guardian-link console (C-IA-12).

The per-child read endpoints deliberately *reuse* the student schemas: the
parent service delegates to `StudentService` after resolving the link, so a
child's attendance summary is the same shape the child sees. Duplicating those
models here would give the two consoles a chance to drift apart while telling
the reader nothing new.

What is parent-only: the family rollup, the guardian's own profile, the link
rows themselves and the claim flow.

Access levels a guardian can be granted on a link. Mirrors `access_scope` in
`parent_student_links`, which defaults to all seven.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import APIResponse
from app.schemas.student import (
    StudentAssignmentPage,
    StudentDashboard,
    StudentFeeAccount,
    StudentAttendanceCalendar,
    StudentAttendanceSummary,
    StudentExamPage,
    StudentLeavePage,
    StudentLeaveRow,
    StudentNoticePage,
    StudentProfile,
    StudentResultDetail,
    StudentResultRow,
    StudentTimetable,
)

#: Modules a guardian can be granted on a link (see parent_student_links.access_scope).
ParentModule = Literal[
    "attendance", "timetable", "examination", "assignment", "results", "notice", "finance"
]

RELATION_MAX_LENGTH = 50
#: Days an activation code stays redeemable. Long enough for a printed slip to
#: reach home and be acted on, short enough that an old slip is not a key.
CODE_VALID_DAYS = 14


def _clean(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) else value


# ── C-PA-01 the family ──────────────────────────────────────────────────────


class ParentChildRow(BaseModel):
    """One linked child, with the access this guardian actually holds."""

    link_id: uuid.UUID
    student_id: uuid.UUID
    name: str
    avatar_url: str | None = None
    roll_number: str | None = None
    class_name: str | None = None
    department_name: str | None = None
    academic_year: str | None = None
    relation: str
    is_primary: bool
    access_scope: list[str] = Field(default_factory=list)
    access_upto: date | None = None
    days_left: int | None = None
    is_live: bool
    # Set when the row is visible but not usable, so the UI can say *why*
    # instead of showing an empty console: SUSPENDED | EXPIRED | NOT_ENROLLED.
    blocked_reason: str | None = None


class ParentPendingInvite(BaseModel):
    """An invitation the school recorded before the guardian had an account."""

    link_id: uuid.UUID
    student_name: str
    student_roll_no: str | None = None
    relation: str
    is_primary: bool
    code_expires_at: datetime | None = None
    created_at: datetime


class ParentChildren(BaseModel):
    parent_name: str
    parent_email: str | None = None
    tenant_name: str
    tenant_type: str
    #: School-only feature (role design §3 lists PARENT as a school role); a
    #: college tenant is told this rather than shown an empty console.
    portal_enabled: bool
    children: list[ParentChildRow] = Field(default_factory=list)
    pending_invites: list[ParentPendingInvite] = Field(default_factory=list)


class ParentFamilyRollup(BaseModel):
    """The one-request family overview: what a guardian actually scans."""

    child: ParentChildRow
    attendance_percentage: float | None = None
    attendance_low: bool = False
    last_attendance_date: date | None = None
    last_attendance_status: str | None = None
    pending_assignment_count: int | None = None
    next_exam: str | None = None
    unpublished_result_count: int = 0
    fee_balance_due: float | None = None
    fee_overdue: bool = False
    unread_notices: int | None = None
    restricted_modules: list[str] = Field(default_factory=list)


class ParentFamilyOverview(BaseModel):
    parent_name: str
    tenant_name: str
    portal_enabled: bool
    children: list[ParentFamilyRollup] = Field(default_factory=list)


# ── C-PA-02 child dashboard (student shapes, scope-filtered) ────────────────


class ParentChildDashboard(BaseModel):
    """The child's own dashboard, with the sections this guardian may not see
    emptied rather than rendered as a surprise.

    `restricted_modules` is what the UI uses to hide the card wholesale; the
    underlying fields are nulled server-side so a fee balance never reaches the
    browser in the payload and gets CSS-hidden.
    """

    child: ParentChildRow
    student: StudentDashboard
    restricted_modules: list[str] = Field(default_factory=list)


# ── C-PA-03 guardian's own profile ──────────────────────────────────────────


class ParentGuardianProfile(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    address: str | None = None
    last_login_at: datetime | None = None
    children_count: int
    can_edit_contact: bool


class ParentGuardianUpdate(BaseModel):
    """Only what a school lets a guardian self-serve: how to reach them.

    `name` is deliberately absent — it is the identity on the admission record
    and staff verify it against documents; letting a guardian rename themselves
    would make the audit trail quote whatever they typed.
    """

    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=2000)

    @field_validator("phone", "address", mode="before")
    @classmethod
    def _strip(cls, value):
        return _clean(value)


# ── C-PA-04 … C-PA-11 per-child reads ───────────────────────────────────────


class ParentExamSummary(BaseModel):
    """An exam result stripped to what a guardian is entitled to see.

    The student shape carries per-question answers once review is allowed.
    A parent console showing the correct-option markers of an unadministered
    exam would be an exam-integrity leak, so this reuses the student service for
    the score and drops the answer rows entirely.
    """

    exam_id: uuid.UUID
    title: str
    subject_name: str
    total_marks: int
    passing_marks: int
    status: str
    total_score: float | None = None
    percentage: float | None = None
    grade: str | None = None
    submitted_at: datetime | None = None
    attempt_missing: bool = False


class ParentLeaveCreate(BaseModel):
    from_date: date
    to_date: date
    reason: str = Field(..., min_length=5, max_length=2000)
    document_url: str | None = Field(default=None, max_length=2000)

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, value):
        return _clean(value)


class ParentLeaveRow(BaseModel):
    id: uuid.UUID
    from_date: date
    to_date: date
    reason: str
    status: str
    document_url: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None
    #: 'PARENT' when this guardian filed it, 'STUDENT' when the child did.
    request_source: str = "STUDENT"
    mine: bool = False


class ParentLeavePage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ParentLeaveRow] = Field(default_factory=list)


class ParentChildProfile(BaseModel):
    """The child's profile plus the adults a guardian should be able to call."""

    student: StudentProfile
    class_teacher_name: str | None = None
    class_teacher_email: str | None = None
    mentor_name: str | None = None
    hostel_room: str | None = None
    transport_route: str | None = None


# ── C-PA-12 claims and links ────────────────────────────────────────────────


class ParentClaimByCode(BaseModel):
    """Attach this account to a code the school issued."""

    code: str = Field(..., min_length=6, max_length=24)

    @field_validator("code", mode="before")
    @classmethod
    def _normalise(cls, value):
        # Codes are printed on paper and typed on phones: strip, upper-case and
        # ignore the separators the slip uses (XXXX-XXXX-XXXX).
        if not isinstance(value, str):
            return value
        return "".join(ch for ch in value.upper() if ch.isalnum())


class ParentClaimedChild(BaseModel):
    student_id: uuid.UUID
    student_name: str
    class_name: str | None = None
    relation: str
    is_primary: bool


class ParentAccountClaim(BaseModel):
    """Public self-service: open the guardian account and claim the code in one
    step, so a school never has to key 400 parent passwords."""

    code: str = Field(..., min_length=6, max_length=24)
    #: The child's roll number, typed from the same slip. A second factor that
    #: turns a guessed code into nothing: without it the code is a capability
    #: that could be tried against any family on the platform.
    student_roll_no: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    #: 10 chars, not the 6 the staff-console invites use: this endpoint is
    #: reachable without any prior account and creates a login for a real family.
    password: str = Field(..., min_length=10, max_length=128)
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("code", mode="before")
    @classmethod
    def _normalise_code(cls, value):
        return ParentClaimByCode(code=value).code if isinstance(value, str) else value

    @field_validator("name", "student_roll_no", "phone", mode="before")
    @classmethod
    def _strip(cls, value):
        return _clean(value)

    @field_validator("email", mode="before")
    @classmethod
    def _lower_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class ParentCodeCheck(BaseModel):
    """Pre-claim preview: enough to confirm the right child, not enough to
    learn anything about a family you are not connected to."""

    institution_name: str
    student_name: str
    class_name: str | None = None
    relation: str
    is_primary: bool
    expires_at: datetime | None = None


# ── C-IA-12 admin: guardian link console ────────────────────────────────────


class ParentLinkRow(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    parent_name: str | None = None
    parent_email: str | None = None
    parent_phone: str | None = None
    parent_is_active: bool | None = None
    student_id: uuid.UUID
    student_name: str
    student_roll_no: str | None = None
    class_name: str | None = None
    relation: str
    is_primary: bool
    status: str
    access_scope: list[str] = Field(default_factory=list)
    access_upto: date | None = None
    activation_code: str | None = None
    code_expires_at: datetime | None = None
    claimed_at: datetime | None = None
    note: str | None = None
    managed_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ParentLinkPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ParentLinkRow] = Field(default_factory=list)
    counts: dict[str, int] = Field(default_factory=dict)
    tenant_type: str
    portal_enabled: bool = True
    #: Students with no guardian on record — the gap the page exists to close.
    unlinked_count: int = 0
    unlinked: list[dict] = Field(default_factory=list)


class ParentLinkCreate(BaseModel):
    """Either attach an existing parent account or invite a new guardian.

    Exactly one of `parent_user_id` / `email` — a school that has already
    created the account attaches it directly; otherwise the row waits as
    PENDING_CLAIM behind an activation code.
    """

    student_id: uuid.UUID
    relation: str = Field(..., min_length=2, max_length=RELATION_MAX_LENGTH)
    parent_user_id: uuid.UUID | None = None
    #: Only used when `create_account` is set — the account needs a display name
    #: and the admission record, not the local part of an address, is where it
    #: comes from.
    parent_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    is_primary: bool = False
    access_scope: list[ParentModule] | None = None
    access_upto: date | None = None
    note: str | None = Field(default=None, max_length=1000)
    #: Create a login for the guardian now and post them a reset link, the way
    #: staff invites work. Without it they self-serve with the activation code.
    create_account: bool = False
    send_email: bool = True

    @field_validator("relation", "note", "phone", "parent_name", mode="before")
    @classmethod
    def _strip(cls, value):
        return _clean(value)

    @field_validator("email", mode="before")
    @classmethod
    def _lower_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("access_upto")
    @classmethod
    def _future(cls, value: date | None) -> date | None:
        if value is not None and value < date.today():
            raise ValueError("access_upto must be today or later")
        return value


class ParentLinkUpdate(BaseModel):
    relation: str | None = Field(default=None, min_length=2, max_length=RELATION_MAX_LENGTH)
    is_primary: bool | None = None
    status: Literal["ACTIVE", "SUSPENDED"] | None = None
    access_scope: list[ParentModule] | None = None
    access_upto: date | None = None
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("relation", "note", mode="before")
    @classmethod
    def _strip(cls, value):
        return _clean(value)


# ── Envelopes ───────────────────────────────────────────────────────────────

APIResponseParentChildren = APIResponse[ParentChildren]
APIResponseParentOverview = APIResponse[ParentFamilyOverview]
APIResponseParentChildDashboard = APIResponse[ParentChildDashboard]
APIResponseParentGuardianProfile = APIResponse[ParentGuardianProfile]
APIResponseParentChildProfile = APIResponse[ParentChildProfile]
APIResponseParentAttendance = APIResponse[StudentAttendanceSummary]
APIResponseParentAttendanceCalendar = APIResponse[StudentAttendanceCalendar]
APIResponseParentTimetable = APIResponse[StudentTimetable]
APIResponseParentExaminations = APIResponse[StudentExamPage]
APIResponseParentExamSummary = APIResponse[ParentExamSummary]
APIResponseParentAssignments = APIResponse[StudentAssignmentPage]
APIResponseParentResults = APIResponse[list[StudentResultRow]]
APIResponseParentResult = APIResponse[StudentResultDetail]
APIResponseParentNotices = APIResponse[StudentNoticePage]
APIResponseParentFees = APIResponse[StudentFeeAccount]
APIResponseParentLeaves = APIResponse[ParentLeavePage]
APIResponseParentLeave = APIResponse[ParentLeaveRow]
APIResponseParentClaim = APIResponse[ParentClaimedChild]
APIResponseParentCodeCheck = APIResponse[ParentCodeCheck]
APIResponseParentLinkPage = APIResponse[ParentLinkPage]
APIResponseParentLinkRow = APIResponse[ParentLinkRow]
