"""Teacher console tests (C-TC-01 … C-TC-22).

The rules worth pinning down here are the ones that would be silent failures
in production rather than obvious bugs:

* the subject/class fence returns **404**, not 403, so the URL space cannot be
  enumerated;
* an out-of-scope teacher with no assignment is refused rather than shown an
  empty console that looks like a data problem;
* the paper cannot change once students are attempting;
* a grade may not exceed the question's marks, and a late submission is
  discounted by the assignment's own penalty rather than full-marked.

Every route is also proved to reject an anonymous caller.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.schemas.teacher import (
    TeacherAssignmentCreate,
    TeacherContentCreate,
    TeacherExamCreate,
    TeacherQuestionCreate,
    TeacherSessionCreate,
    TeacherSubmissionReview,
)
from app.services.teacher_scope_service import TeacherScope, TeacherScopeService
from app.services.teacher_service import TeacherService


# ── Test doubles ─────────────────────────────────────────────────────────────


class Result:
    def __init__(self, scalar=None, row=None, rows=None):
        self._scalar = scalar
        self._row = row
        self._rows = rows or []

    def scalar(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def one(self):
        return self._row

    def first(self):
        return self._row

    def all(self):
        return self._rows

    def scalars(self):
        return MagicMock(all=lambda: self._rows)


class FakeDB:
    def __init__(self, results=()):
        self._results = list(results)
        self.added: list = []
        self.deleted: list = []
        self.queries: list = []
        self.committed = False
        self.execute = AsyncMock(side_effect=self._pop)
        self.flush = AsyncMock()
        self.delete = AsyncMock(side_effect=lambda obj: self.deleted.append(obj))

    async def _pop(self, statement):
        self.queries.append(statement)
        return self._results.pop(0) if self._results else Result()

    def add(self, instance):
        self.added.append(instance)

    async def commit(self):
        self.committed = True

    async def rollback(self):
        pass


TENANT = uuid.uuid4()
TEACHER_ID = uuid.uuid4()
SUBJECT_ID = uuid.uuid4()
CLASS_ID = uuid.uuid4()
YEAR_ID = uuid.uuid4()


def teacher(tenant_id: uuid.UUID = TENANT) -> User:
    return User(
        id=TEACHER_ID,
        tenant_id=tenant_id,
        name="Priya Nair",
        email="priya@abc-college.edu",
        is_active=True,
    )


def scope(
    *,
    subject_ids: set[uuid.UUID] | None = None,
    class_ids: set[uuid.UUID] | None = None,
    owned: set[uuid.UUID] | None = None,
) -> TeacherScope:
    return TeacherScope(
        teacher_id=TEACHER_ID,
        tenant_id=TENANT,
        subject_ids=frozenset(subject_ids if subject_ids is not None else {SUBJECT_ID}),
        class_ids=frozenset(class_ids if class_ids is not None else {CLASS_ID}),
        owned_class_ids=frozenset(owned or set()),
        academic_year_id=YEAR_ID,
        academic_year_name="2025-26",
    )


# ── Scope resolution ─────────────────────────────────────────────────────────


async def test_scope_resolves_subjects_and_owned_classes():
    """A teacher's reach is the union of their subject links and own classes."""
    other_class = uuid.uuid4()
    db = FakeDB(
        [
            Result(row=(YEAR_ID, "2025-26")),
            Result(rows=[(SUBJECT_ID, CLASS_ID)]),
            Result(rows=[other_class]),
        ]
    )

    resolved = await TeacherScopeService.resolve(db, teacher())

    assert resolved.subject_ids == frozenset({SUBJECT_ID})
    assert resolved.class_ids == frozenset({CLASS_ID, other_class})
    assert resolved.owned_class_ids == frozenset({other_class})
    assert resolved.academic_year_name == "2025-26"


async def test_scope_fails_closed_when_nothing_is_assigned():
    """No subject and no class is a 403 with an actionable message, not an
    empty console that looks broken."""
    db = FakeDB([Result(row=(YEAR_ID, "2025-26")), Result(rows=[]), Result(rows=[])])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherScopeService.resolve(db, teacher())

    assert excinfo.value.status_code == 403
    assert "HOD" in excinfo.value.detail


async def test_scope_rejects_a_foreign_subject_with_404():
    """`ARCHITECTURE.md` §1: an out-of-scope read is indistinguishable from a
    missing one. A 403 here would confirm the subject exists."""
    with pytest.raises(HTTPException) as excinfo:
        scope().require_subject(uuid.uuid4())
    assert excinfo.value.status_code == 404


async def test_scope_rejects_a_foreign_class_with_404():
    with pytest.raises(HTTPException) as excinfo:
        scope().require_class(uuid.uuid4())
    assert excinfo.value.status_code == 404


# ── C-TC-03 attendance ───────────────────────────────────────────────────────


async def test_session_payload_rejects_a_duplicate_student():
    """Two marks for one learner would make total_present meaningless."""
    student_id = uuid.uuid4()
    with pytest.raises(ValueError):
        TeacherSessionCreate(
            subject_id=SUBJECT_ID,
            class_id=CLASS_ID,
            date=date(2026, 8, 3),
            period_label="Period 1",
            records=[
                {"student_id": str(student_id), "status": "PRESENT"},
                {"student_id": str(student_id), "status": "ABSENT"},
            ],
        )


async def test_session_payload_rejects_an_inverted_time_range():
    with pytest.raises(ValueError):
        TeacherSessionCreate(
            subject_id=SUBJECT_ID,
            class_id=CLASS_ID,
            date=date(2026, 8, 3),
            period_label="Period 1",
            start_time="10:00",
            end_time="09:00",
            records=[{"student_id": str(uuid.uuid4()), "status": "PRESENT"}],
        )


async def test_create_session_rejects_a_future_date(monkeypatch):
    """Marking tomorrow's register is always a mistake, never a workflow."""
    resolved = scope()
    monkeypatch.setattr(
        TeacherService, "scope_for_user", AsyncMock(return_value=resolved)
    )
    monkeypatch.setattr(
        TeacherService,
        "_ensure_subject",
        AsyncMock(return_value=SimpleNamespace(id=SUBJECT_ID, class_id=CLASS_ID)),
    )
    from app.services.principal_service import PrincipalService

    monkeypatch.setattr(
        PrincipalService, "_tenant_today", AsyncMock(return_value=date(2026, 8, 3))
    )

    payload = TeacherSessionCreate(
        subject_id=SUBJECT_ID,
        class_id=CLASS_ID,
        date=date(2026, 8, 10),
        period_label="Period 1",
        records=[{"student_id": str(uuid.uuid4()), "status": "PRESENT"}],
    )
    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.create_session(FakeDB(), teacher(), payload)
    assert excinfo.value.status_code == 422


async def test_create_session_rejects_a_student_outside_the_roster(monkeypatch):
    """A stray id would write an attendance row for another class's learner."""
    resolved = scope()
    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=resolved))
    monkeypatch.setattr(
        TeacherService,
        "_ensure_subject",
        AsyncMock(return_value=SimpleNamespace(id=SUBJECT_ID, class_id=CLASS_ID)),
    )
    monkeypatch.setattr(TeacherService, "_roster", AsyncMock(return_value=[]))
    from app.services.principal_service import PrincipalService

    monkeypatch.setattr(
        PrincipalService, "_tenant_today", AsyncMock(return_value=date(2026, 8, 3))
    )

    payload = TeacherSessionCreate(
        subject_id=SUBJECT_ID,
        class_id=CLASS_ID,
        date=date(2026, 8, 3),
        period_label="Period 1",
        records=[{"student_id": str(uuid.uuid4()), "status": "PRESENT"}],
    )
    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.create_session(FakeDB(), teacher(), payload)
    assert excinfo.value.status_code == 422
    assert "not enrolled" in excinfo.value.detail


async def test_count_statuses_treats_late_and_excused_as_present():
    """Only ABSENT reduces the present count — a late arrival still attended."""
    records = [
        SimpleNamespace(status="PRESENT"),
        SimpleNamespace(status="LATE"),
        SimpleNamespace(status="EXCUSED"),
        SimpleNamespace(status="ABSENT"),
    ]
    assert TeacherService._count_statuses(records) == {"present": 3, "absent": 1}


# ── C-TC-06 leave review ─────────────────────────────────────────────────────


async def test_leaves_are_empty_for_a_teacher_who_owns_no_class(monkeypatch):
    """Reviewing leave is a class-teacher duty; a subject teacher sees nothing
    rather than every learner in the department."""
    monkeypatch.setattr(
        TeacherService, "scope_for_user", AsyncMock(return_value=scope(owned=set()))
    )
    page = await TeacherService.leaves(FakeDB(), teacher())
    assert page.total == 0
    assert page.items == []


async def test_decide_leave_rejects_a_class_the_teacher_does_not_own(monkeypatch):
    monkeypatch.setattr(
        TeacherService, "scope_for_user", AsyncMock(return_value=scope(owned={CLASS_ID}))
    )
    leave = SimpleNamespace(id=uuid.uuid4(), class_id=uuid.uuid4(), status="PENDING")
    db = FakeDB([Result(scalar=leave)])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.decide_leave(
            db, teacher(), leave.id, SimpleNamespace(action="APPROVE", note=None)
        )
    assert excinfo.value.status_code == 404


# ── C-TC-08 / C-TC-09 exams ──────────────────────────────────────────────────


async def test_exam_create_rejects_passing_above_total():
    with pytest.raises(ValueError):
        TeacherExamCreate(
            title="Unit test 1",
            subject_id=SUBJECT_ID,
            exam_type="MCQ",
            total_marks=50,
            passing_marks=60,
            duration_minutes=45,
            scheduled_at=datetime.now(timezone.utc),
        )


async def test_exam_create_rejects_a_window_that_closes_before_it_opens():
    with pytest.raises(ValueError):
        TeacherExamCreate(
            title="Unit test 1",
            subject_id=SUBJECT_ID,
            exam_type="MCQ",
            total_marks=50,
            passing_marks=20,
            duration_minutes=45,
            scheduled_at=datetime(2026, 9, 1, 10, tzinfo=timezone.utc),
            window_end_at=datetime(2026, 9, 1, 9, tzinfo=timezone.utc),
        )


async def test_ensure_exam_hides_another_subject_behind_404(monkeypatch):
    """The fence is the subject, so a colleague's exam is simply not found."""
    exam = SimpleNamespace(id=uuid.uuid4(), tenant_id=TENANT, subject_id=uuid.uuid4())
    db = FakeDB([Result(scalar=exam)])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService._ensure_exam(db, scope(), exam.id)
    assert excinfo.value.status_code == 404


async def test_publish_requires_principal_approval(monkeypatch):
    """§4.3 gives schedule approval to the Principal; a teacher cannot bypass it."""
    from app.models.principal import ExamStatus

    exam = SimpleNamespace(
        id=uuid.uuid4(),
        status=ExamStatus.DRAFT,
        schedule_approval_status="PENDING",
        mode="ONLINE",
        total_marks=50,
    )
    with pytest.raises(HTTPException) as excinfo:
        await TeacherService._apply_exam_status(FakeDB(), scope(), exam, "PUBLISHED")
    assert excinfo.value.status_code == 409
    assert "approved" in excinfo.value.detail


async def test_publish_requires_question_marks_to_match_the_paper():
    """Publishing an online exam whose questions total 30 out of 50 would
    silently cap every student at 60%."""
    from app.models.principal import ExamStatus

    exam = SimpleNamespace(
        id=uuid.uuid4(),
        status=ExamStatus.DRAFT,
        schedule_approval_status="APPROVED",
        mode="ONLINE",
        total_marks=50,
    )
    db = FakeDB([Result(scalar=Decimal("30"))])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService._apply_exam_status(db, scope(), exam, "PUBLISHED")
    assert excinfo.value.status_code == 409
    assert "out of" in excinfo.value.detail


async def test_cancel_is_refused_once_students_have_attempted():
    from app.models.principal import ExamStatus

    exam = SimpleNamespace(
        id=uuid.uuid4(),
        status=ExamStatus.PUBLISHED,
        schedule_approval_status="APPROVED",
        mode="ONLINE",
        total_marks=50,
    )
    db = FakeDB([Result(scalar=4)])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService._apply_exam_status(db, scope(), exam, "CANCELLED")
    assert excinfo.value.status_code == 409


# ── C-TC-10 questions ────────────────────────────────────────────────────────


async def test_objective_question_needs_a_correct_option():
    """An MCQ with no key would score every student zero, silently."""
    with pytest.raises(ValueError):
        TeacherQuestionCreate(
            text="2 + 2 = ?",
            question_type="MCQ",
            marks=1,
            options=[{"text": "3"}, {"text": "4"}],
        )


async def test_objective_question_needs_two_options():
    with pytest.raises(ValueError):
        TeacherQuestionCreate(
            text="2 + 2 = ?",
            question_type="MCQ",
            marks=1,
            options=[{"text": "4", "is_correct": True}],
        )


async def test_descriptive_question_rejects_options():
    with pytest.raises(ValueError):
        TeacherQuestionCreate(
            text="Explain recursion.",
            question_type="LONG_ANSWER",
            marks=10,
            options=[{"text": "n/a"}],
        )


async def test_question_cannot_be_added_once_an_attempt_exists(monkeypatch):
    from app.models.principal import ExamStatus

    exam = SimpleNamespace(
        id=uuid.uuid4(), tenant_id=TENANT, subject_id=SUBJECT_ID, status=ExamStatus.PUBLISHED
    )
    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(TeacherService, "_ensure_exam", AsyncMock(return_value=exam))
    db = FakeDB([Result(scalar=1)])

    payload = TeacherQuestionCreate(
        text="2 + 2 = ?",
        question_type="MCQ",
        marks=1,
        options=[{"text": "4", "is_correct": True}, {"text": "5"}],
    )
    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.add_question(db, teacher(), exam.id, payload)
    assert excinfo.value.status_code == 409
    assert "no longer change" in excinfo.value.detail


# ── C-TC-13 assignments ──────────────────────────────────────────────────────


async def test_milestone_marks_must_add_up_to_the_total():
    """Otherwise a student who completes every stage cannot reach full marks."""
    with pytest.raises(ValueError):
        TeacherAssignmentCreate(
            title="Capstone",
            description="Build it",
            subject_id=SUBJECT_ID,
            assignment_type="MILESTONE",
            total_marks=100,
            passing_marks=40,
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            milestones=[
                {"title": "Proposal", "marks": 20},
                {"title": "Build", "marks": 30},
            ],
        )


async def test_milestone_assignment_needs_at_least_one_milestone():
    with pytest.raises(ValueError):
        TeacherAssignmentCreate(
            title="Capstone",
            description="Build it",
            subject_id=SUBJECT_ID,
            assignment_type="MILESTONE",
            total_marks=100,
            passing_marks=40,
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
        )


async def test_regular_assignment_rejects_milestones():
    with pytest.raises(ValueError):
        TeacherAssignmentCreate(
            title="Essay",
            description="Write it",
            subject_id=SUBJECT_ID,
            assignment_type="REGULAR",
            total_marks=20,
            passing_marks=8,
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
            milestones=[{"title": "Draft", "marks": 20}],
        )


async def test_allowed_file_types_are_normalised():
    """'.PDF' and 'pdf' are the same rule; storing both would let one through."""
    payload = TeacherAssignmentCreate(
        title="Essay",
        description="Write it",
        subject_id=SUBJECT_ID,
        total_marks=20,
        passing_marks=8,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        allowed_file_types=[".PDF", "pdf", " DocX "],
    )
    assert payload.allowed_file_types == ["docx", "pdf"]


# ── C-TC-15 review ───────────────────────────────────────────────────────────


async def test_approval_requires_a_score():
    with pytest.raises(ValueError):
        TeacherSubmissionReview(decision="APPROVED")


async def test_rejection_requires_a_reason():
    """A bare rejection gives the student nothing to act on."""
    with pytest.raises(ValueError):
        TeacherSubmissionReview(decision="REJECTED", feedback="  ")


async def test_review_applies_the_late_penalty(monkeypatch):
    """A late submission is accepted but discounted by the assignment's own
    policy — not silently full-marked."""
    from app.models.hod import SubmissionStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=TENANT,
        subject_id=SUBJECT_ID,
        total_marks=100,
        late_penalty_percent=25,
    )
    submission = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=TENANT,
        assignment_id=assignment.id,
        milestone_id=None,
        is_late=True,
        status=SubmissionStatus.SUBMITTED,
        score=None,
        grade=None,
        feedback=None,
        reviewed_by=None,
        reviewed_at=None,
    )
    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        TeacherService, "_ensure_submission", AsyncMock(return_value=submission)
    )
    monkeypatch.setattr(
        TeacherService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )
    monkeypatch.setattr(
        TeacherService, "submission_detail", AsyncMock(return_value="detail")
    )
    db = FakeDB([Result(scalar=0)])

    await TeacherService.review_submission(
        db, teacher(), submission.id, TeacherSubmissionReview(decision="APPROVED", score=80)
    )

    assert float(submission.score) == 60.0  # 80 less the 25% late penalty
    assert submission.status is SubmissionStatus.APPROVED


async def test_review_rejects_a_score_above_the_total(monkeypatch):
    from app.models.hod import SubmissionStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=TENANT,
        subject_id=SUBJECT_ID,
        total_marks=20,
        late_penalty_percent=0,
    )
    submission = SimpleNamespace(
        id=uuid.uuid4(),
        assignment_id=assignment.id,
        milestone_id=None,
        is_late=False,
        status=SubmissionStatus.SUBMITTED,
    )
    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        TeacherService, "_ensure_submission", AsyncMock(return_value=submission)
    )
    monkeypatch.setattr(
        TeacherService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.review_submission(
            FakeDB(), teacher(), submission.id, TeacherSubmissionReview(decision="APPROVED", score=50)
        )
    assert excinfo.value.status_code == 422


# ── C-TC-18 content ──────────────────────────────────────────────────────────


async def test_link_content_requires_an_http_url():
    with pytest.raises(ValueError):
        TeacherContentCreate(
            title="Reference", subject_id=SUBJECT_ID, content_type="LINK", external_url="ftp://x"
        )


async def test_uploaded_content_requires_a_file_key():
    with pytest.raises(ValueError):
        TeacherContentCreate(title="Notes", subject_id=SUBJECT_ID, content_type="PDF")


async def test_content_cannot_be_edited_by_another_teacher(monkeypatch):
    """§4.5: 'Cannot edit other teachers' content'."""
    item = SimpleNamespace(
        id=uuid.uuid4(), subject_id=SUBJECT_ID, uploaded_by=uuid.uuid4(), tenant_id=TENANT
    )
    db = FakeDB([Result(scalar=item)])

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService._ensure_content(db, scope(), item.id)
    assert excinfo.value.status_code == 403


# ── C-TC-20 notices ──────────────────────────────────────────────────────────


async def test_teacher_notice_is_class_scoped_and_never_pinned(monkeypatch):
    """§4.5 allows 'post to assigned classes'. Pinning is a leadership
    affordance, so a class notice must not outrank the Principal's."""
    from app.schemas.teacher import TeacherNoticeCreate

    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    db = FakeDB([Result(scalar="FY-A")])

    row = await TeacherService.create_notice(
        db,
        teacher(),
        TeacherNoticeCreate(title="Lab shifted", body="Lab moves to 3pm", class_id=CLASS_ID),
    )

    assert row.target_scope == "CLASS"
    assert row.is_pinned is False
    notice = next(item for item in db.added if hasattr(item, "target_scope"))
    assert notice.is_pinned is False


async def test_notice_to_a_foreign_class_is_404(monkeypatch):
    from app.schemas.teacher import TeacherNoticeCreate

    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.create_notice(
            FakeDB(),
            teacher(),
            TeacherNoticeCreate(title="Hello", body="Body", class_id=uuid.uuid4()),
        )
    assert excinfo.value.status_code == 404


# ── C-TC-22 moderation ───────────────────────────────────────────────────────


async def test_moderation_is_limited_to_the_thread_author(monkeypatch):
    """§4.5: a teacher moderates their *own* threads; department-wide
    moderation belongs to the HOD console."""
    from app.schemas.teacher import TeacherThreadModeration

    thread = SimpleNamespace(
        id=uuid.uuid4(), author_id=uuid.uuid4(), scope_type="CLASS", scope_id=CLASS_ID
    )
    monkeypatch.setattr(TeacherService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(TeacherService, "_ensure_thread", AsyncMock(return_value=thread))

    with pytest.raises(HTTPException) as excinfo:
        await TeacherService.moderate_thread(
            FakeDB(), teacher(), thread.id, TeacherThreadModeration(action="LOCK")
        )
    assert excinfo.value.status_code == 403


# ── Router surface ───────────────────────────────────────────────────────────


def test_teacher_routes_are_mounted():
    from app.main import app

    paths = {route.path for route in app.routes}
    for path in (
        "/api/v1/teacher/dashboard",
        "/api/v1/teacher/schedule",
        "/api/v1/teacher/attendance/context",
        "/api/v1/teacher/attendance/sessions",
        "/api/v1/teacher/attendance/leaves",
        "/api/v1/teacher/examinations",
        "/api/v1/teacher/assignments",
        "/api/v1/teacher/content",
        "/api/v1/teacher/notices",
        "/api/v1/teacher/discussion",
    ):
        assert path in paths, f"{path} is not mounted"


def test_teacher_guard_requires_a_teaching_role():
    import inspect

    from app.dependencies.auth import get_current_tenant_user_teacher

    source = inspect.getsource(get_current_tenant_user_teacher)
    assert "TEACHER" in source
    assert "STUDENT" not in source


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/dashboard", None),
        ("get", "/schedule", None),
        ("get", "/attendance/context", None),
        ("post", "/attendance/sessions", {}),
        ("get", "/attendance/sessions", None),
        ("get", "/attendance/sessions/00000000-0000-0000-0000-000000000000", None),
        ("patch", "/attendance/sessions/00000000-0000-0000-0000-000000000000", {}),
        ("post", "/attendance/sessions/00000000-0000-0000-0000-000000000000/lock", None),
        ("get", "/attendance/leaves", None),
        ("patch", "/attendance/leaves/00000000-0000-0000-0000-000000000000", {}),
        ("get", "/examinations", None),
        ("post", "/examinations", {}),
        ("get", "/examinations/00000000-0000-0000-0000-000000000000", None),
        ("patch", "/examinations/00000000-0000-0000-0000-000000000000", {}),
        ("get", "/examinations/00000000-0000-0000-0000-000000000000/questions", None),
        ("post", "/examinations/00000000-0000-0000-0000-000000000000/questions", {}),
        ("get", "/examinations/00000000-0000-0000-0000-000000000000/results", None),
        ("get", "/attempts/00000000-0000-0000-0000-000000000000", None),
        ("post", "/attempts/00000000-0000-0000-0000-000000000000/grade", {}),
        ("get", "/assignments", None),
        ("post", "/assignments", {}),
        ("get", "/assignments/00000000-0000-0000-0000-000000000000", None),
        ("patch", "/assignments/00000000-0000-0000-0000-000000000000", {}),
        ("get", "/assignments/00000000-0000-0000-0000-000000000000/submissions", None),
        ("get", "/submissions/00000000-0000-0000-0000-000000000000", None),
        ("post", "/submissions/00000000-0000-0000-0000-000000000000/review", {}),
        ("get", "/content", None),
        ("post", "/content", {}),
        ("patch", "/content/00000000-0000-0000-0000-000000000000", {}),
        ("delete", "/content/00000000-0000-0000-0000-000000000000", None),
        ("get", "/notices", None),
        ("post", "/notices", {}),
        ("get", "/discussion", None),
        ("post", "/discussion", {}),
        ("get", "/discussion/00000000-0000-0000-0000-000000000000", None),
        ("post", "/discussion/00000000-0000-0000-0000-000000000000/replies", {}),
        ("patch", "/discussion/00000000-0000-0000-0000-000000000000", {}),
    ],
)
async def test_teacher_routes_require_a_bearer_token(method, path, body):
    """No teacher endpoint may answer an anonymous request."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.request(method, f"/api/v1/teacher{path}", json=body)
    assert response.status_code == 401, (
        f"{method.upper()} {path} returned {response.status_code}, expected 401"
    )
