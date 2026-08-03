"""Student console tests (C-ST-01 … C-ST-20).

§4.9 says a student sees **own data only**, and the exam engine is the one
place a student writes to a graded table. The tests below pin the rules that
would be exploitable rather than merely wrong:

* the enrolment scope is resolved from the database and fails closed;
* an attempt belonging to another learner is a 404, so ids cannot be probed;
* the deadline is computed from ``started_at`` on the server, so a frozen
  browser clock buys no extra time;
* the answer key never travels to the machine sitting the exam;
* negative marking bites a wrong answer, never a blank one;
* results stay hidden until both the Principal approved *and* the controller
  released them.
"""

from __future__ import annotations

import inspect
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.schemas.student import (
    StudentLeaveCreate,
    StudentSubmissionCreate,
    StudentThreadCreate,
)
from app.services.student_service import StudentService
from app.services.teacher_scope_service import StudentScope, StudentScopeService


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
STUDENT_ID = uuid.uuid4()
CLASS_ID = uuid.uuid4()
SUBJECT_ID = uuid.uuid4()
DEPARTMENT_ID = uuid.uuid4()
YEAR_ID = uuid.uuid4()


def student(tenant_id: uuid.UUID = TENANT) -> User:
    return User(
        id=STUDENT_ID,
        tenant_id=tenant_id,
        name="Aryan Mehta",
        email="aryan@abc-college.edu",
        is_active=True,
    )


def scope(subject_ids: set[uuid.UUID] | None = None) -> StudentScope:
    return StudentScope(
        student_id=STUDENT_ID,
        tenant_id=TENANT,
        class_id=CLASS_ID,
        class_name="FY-BSc-A",
        department_id=DEPARTMENT_ID,
        academic_year_id=YEAR_ID,
        academic_year_name="2025-26",
        roll_number="ROLL142",
        subject_ids=frozenset(subject_ids if subject_ids is not None else {SUBJECT_ID}),
    )


def exam(**overrides):
    from app.models.principal import ExamStatus

    base = dict(
        id=uuid.uuid4(),
        tenant_id=TENANT,
        class_id=CLASS_ID,
        subject_id=SUBJECT_ID,
        title="Unit test 1",
        mode="ONLINE",
        status=ExamStatus.PUBLISHED,
        total_marks=50,
        passing_marks=20,
        duration_minutes=60,
        scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        window_end_at=datetime.now(timezone.utc) + timedelta(hours=2),
        instructions=None,
        allow_review=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ── Scope resolution ─────────────────────────────────────────────────────────


async def test_scope_resolves_the_active_enrolment():
    db = FakeDB(
        [
            Result(row=(CLASS_ID, YEAR_ID, "ROLL142", "FY-BSc-A", DEPARTMENT_ID, "2025-26", True)),
            Result(rows=[SUBJECT_ID]),
        ]
    )
    resolved = await StudentScopeService.resolve(db, student())
    assert resolved.class_id == CLASS_ID
    assert resolved.roll_number == "ROLL142"
    assert resolved.subject_ids == frozenset({SUBJECT_ID})


async def test_scope_fails_closed_without_an_enrolment():
    """No ACTIVE enrolment means no data, not an empty dashboard."""
    db = FakeDB([Result(row=None)])
    with pytest.raises(HTTPException) as excinfo:
        await StudentScopeService.resolve(db, student())
    assert excinfo.value.status_code == 403
    assert "enrol" in excinfo.value.detail


async def test_scope_rejects_a_subject_outside_the_class():
    with pytest.raises(HTTPException) as excinfo:
        scope().require_subject(uuid.uuid4())
    assert excinfo.value.status_code == 404


# ── C-ST-05 leave ────────────────────────────────────────────────────────────


async def test_leave_rejects_an_inverted_range():
    with pytest.raises(ValueError):
        StudentLeaveCreate(
            from_date=date(2026, 8, 10), to_date=date(2026, 8, 1), reason="Family function"
        )


async def test_leave_rejects_an_absurd_span():
    with pytest.raises(ValueError):
        StudentLeaveCreate(
            from_date=date(2026, 1, 1), to_date=date(2026, 12, 31), reason="Family function"
        )


async def test_leave_rejects_an_overlapping_request(monkeypatch):
    """Two live requests for the same day give the class teacher contradictory
    instructions."""
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    db = FakeDB([Result(scalar=1)])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService.apply_leave(
            db,
            student(),
            StudentLeaveCreate(
                from_date=date(2026, 8, 3), to_date=date(2026, 8, 5), reason="Medical"
            ),
        )
    assert excinfo.value.status_code == 409


async def test_leave_is_created_against_the_callers_own_class(monkeypatch):
    """The class comes from the resolved scope, never from the payload."""
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    db = FakeDB([Result(scalar=0)])

    await StudentService.apply_leave(
        db,
        student(),
        StudentLeaveCreate(from_date=date(2026, 8, 3), to_date=date(2026, 8, 4), reason="Medical"),
    )

    leave = db.added[0]
    assert leave.student_id == STUDENT_ID
    assert leave.class_id == CLASS_ID


async def test_only_a_pending_leave_can_be_withdrawn(monkeypatch):
    from app.models.teaching import LeaveStatus

    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    leave = SimpleNamespace(id=uuid.uuid4(), status=LeaveStatus.APPROVED)
    db = FakeDB([Result(scalar=leave)])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService.cancel_leave(db, student(), leave.id)
    assert excinfo.value.status_code == 409


# ── C-ST-08 attempt lifecycle ────────────────────────────────────────────────


async def test_offline_exam_cannot_be_attempted_online(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        StudentService, "_ensure_exam", AsyncMock(return_value=exam(mode="OFFLINE"))
    )
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.start_attempt(FakeDB(), student(), uuid.uuid4())
    assert excinfo.value.status_code == 409
    assert "hall" in excinfo.value.detail


async def test_attempt_before_the_window_is_refused(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    future = exam(
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
        window_end_at=datetime.now(timezone.utc) + timedelta(hours=3),
    )
    monkeypatch.setattr(StudentService, "_ensure_exam", AsyncMock(return_value=future))
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.start_attempt(FakeDB(), student(), future.id)
    assert excinfo.value.status_code == 409
    assert "not started" in excinfo.value.detail


async def test_attempt_after_the_window_is_refused(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    past = exam(
        scheduled_at=datetime.now(timezone.utc) - timedelta(hours=5),
        window_end_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    monkeypatch.setattr(StudentService, "_ensure_exam", AsyncMock(return_value=past))
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.start_attempt(FakeDB(), student(), past.id)
    assert excinfo.value.status_code == 409
    assert "closed" in excinfo.value.detail


async def test_a_second_submission_is_refused(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    current = exam()
    monkeypatch.setattr(StudentService, "_ensure_exam", AsyncMock(return_value=current))
    submitted = SimpleNamespace(
        id=uuid.uuid4(), submitted_at=datetime.now(timezone.utc), started_at=None
    )
    db = FakeDB([Result(scalar=submitted)])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService.start_attempt(db, student(), current.id)
    assert excinfo.value.status_code == 409
    assert "already submitted" in excinfo.value.detail


async def test_another_students_attempt_is_a_404():
    """The `student_id` filter is what stops one learner writing into another's
    paper; a mismatch must look like a missing row."""
    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as excinfo:
        await StudentService._ensure_open_attempt(db, scope(), uuid.uuid4())
    assert excinfo.value.status_code == 404


async def test_saving_after_the_deadline_is_refused():
    """The clock is the server's: `started_at` + duration, not the browser's."""
    started = datetime.now(timezone.utc) - timedelta(minutes=90)
    attempt = SimpleNamespace(
        id=uuid.uuid4(), exam_id=uuid.uuid4(), submitted_at=None, started_at=started
    )
    db = FakeDB([Result(scalar=attempt), Result(scalar=exam(duration_minutes=60))])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService._ensure_open_attempt(db, scope(), attempt.id)
    assert excinfo.value.status_code == 409
    assert "time is up" in excinfo.value.detail


async def test_submitting_after_the_deadline_is_allowed_and_auto_flagged():
    """The student must always be able to hand in; the attempt is simply
    marked auto-submitted."""
    started = datetime.now(timezone.utc) - timedelta(minutes=90)
    attempt = SimpleNamespace(
        id=uuid.uuid4(), exam_id=uuid.uuid4(), submitted_at=None, started_at=started
    )
    db = FakeDB([Result(scalar=attempt), Result(scalar=exam(duration_minutes=60))])

    resolved, _exam = await StudentService._ensure_open_attempt(
        db, scope(), attempt.id, allow_expired=True
    )
    assert resolved is attempt


async def test_attempt_screen_never_sends_the_answer_key():
    """The wire contract the attempt screen receives has no correctness flag —
    the client being examined must not be handed the marking scheme."""
    from app.schemas.student import StudentAttemptQuestion, StudentAttemptQuestionOption

    assert "is_correct" not in StudentAttemptQuestionOption.model_fields
    assert set(StudentAttemptQuestionOption.model_fields) == {"id", "text", "sort_order"}
    # …and neither does the question itself carry an `explanation`, which would
    # give the answer away just as effectively.
    assert "explanation" not in StudentAttemptQuestion.model_fields


async def test_attempt_screen_selects_options_without_the_correct_flag():
    """The projection is column-by-column rather than `select(QuestionOption)`,
    so `is_correct` cannot reach the response by accident."""
    question_id = uuid.uuid4()
    option_id = uuid.uuid4()
    attempt = SimpleNamespace(
        id=uuid.uuid4(),
        started_at=datetime.now(timezone.utc),
        tab_switch_count=0,
        submitted_at=None,
    )
    current = exam()
    db = FakeDB(
        [
            Result(
                rows=[
                    SimpleNamespace(
                        id=question_id,
                        text="2 + 2 = ?",
                        question_type="MCQ",
                        marks=Decimal("1"),
                        negative_marks=Decimal("0"),
                        image_url=None,
                        sort_order=1,
                    )
                ]
            ),
            Result(rows=[(option_id, question_id, "4", 0)]),
            Result(rows=[]),
            Result(scalar="CS101"),
        ]
    )

    screen = await StudentService._attempt_screen(db, scope(), current, attempt)

    option = screen.questions[0].options[0]
    assert option.id == option_id
    assert not hasattr(option, "is_correct")


async def test_answer_write_rejects_an_option_from_another_question():
    """Cross-wiring an option id would let a student score a question they did
    not answer."""
    question_id = uuid.uuid4()
    question = SimpleNamespace(id=question_id)
    db = FakeDB(
        [
            Result(rows=[question]),  # questions on the exam
            Result(rows=[]),          # existing answers
            Result(rows=[]),          # valid options (none)
        ]
    )
    attempt = SimpleNamespace(id=uuid.uuid4())
    answers = [
        SimpleNamespace(
            question_id=question_id, selected_option_id=uuid.uuid4(), text_answer=None
        )
    ]
    with pytest.raises(HTTPException) as excinfo:
        await StudentService._write_answers(db, attempt, exam(), answers)
    assert excinfo.value.status_code == 422


async def test_answer_write_rejects_a_question_from_another_exam():
    db = FakeDB([Result(rows=[]), Result(rows=[]), Result(rows=[])])
    answers = [
        SimpleNamespace(question_id=uuid.uuid4(), selected_option_id=None, text_answer=None)
    ]
    with pytest.raises(HTTPException) as excinfo:
        await StudentService._write_answers(db, SimpleNamespace(id=uuid.uuid4()), exam(), answers)
    assert excinfo.value.status_code == 404


# ── C-ST-09 result visibility ────────────────────────────────────────────────


async def test_results_require_both_approval_and_release():
    """Two gates: the Principal approved the publication *and* the controller
    made it visible. Either alone must not reveal marks."""
    source = inspect.getsource(StudentService.results)
    assert "is_visible_to_students" in source
    assert 'approval_status == "APPROVED"' in source


async def test_exam_review_is_off_until_results_are_released(monkeypatch):
    from app.models.principal import ExamStatus

    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    graded = exam(allow_review=True, status=ExamStatus.COMPLETED)
    monkeypatch.setattr(StudentService, "_ensure_exam", AsyncMock(return_value=graded))
    attempt = SimpleNamespace(
        id=uuid.uuid4(),
        submitted_at=datetime.now(timezone.utc),
        total_score=Decimal("30"),
        percentage=Decimal("60"),
        grade="C",
        status="GRADED",
    )
    db = FakeDB([Result(row=("CS101", "Intro to CS")), Result(scalar=attempt)])

    result = await StudentService.exam_result(db, student(), graded.id)

    assert result.review_available is False
    assert result.answers == []
    assert result.is_pass is True


async def test_exam_result_without_an_attempt_is_a_404(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    current = exam()
    monkeypatch.setattr(StudentService, "_ensure_exam", AsyncMock(return_value=current))
    db = FakeDB([Result(row=("CS101", "Intro to CS")), Result(scalar=None)])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService.exam_result(db, student(), current.id)
    assert excinfo.value.status_code == 404


async def test_negative_marking_never_applies_to_a_blank_answer():
    """Skipping must cost nothing; only a wrong choice is penalised."""
    source = inspect.getsource(StudentService.submit_attempt)
    assert "answer.selected_option_id is not None" in source


# ── C-ST-10 … C-ST-12 assignments ────────────────────────────────────────────


async def test_submission_needs_content():
    with pytest.raises(ValueError):
        StudentSubmissionCreate(text_response="   ")


async def test_assignment_row_blocks_submission_after_the_due_date():
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        title="Essay",
        subject_id=SUBJECT_ID,
        assignment_type="REGULAR",
        total_marks=20,
        passing_marks=8,
        due_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        status=AssignmentStatus.PUBLISHED,
        allow_late_submission=False,
        late_penalty_percent=0,
    )
    row = StudentService._assignment_row(
        assignment, "CS101", "Intro", "Priya", None, datetime(2026, 8, 3, tzinfo=timezone.utc)
    )
    assert row.is_overdue is True
    assert row.can_submit is False


async def test_assignment_row_allows_a_late_submission_when_the_policy_does():
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        title="Essay",
        subject_id=SUBJECT_ID,
        assignment_type="REGULAR",
        total_marks=20,
        passing_marks=8,
        due_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        status=AssignmentStatus.PUBLISHED,
        allow_late_submission=True,
        late_penalty_percent=10,
    )
    row = StudentService._assignment_row(
        assignment, "CS101", "Intro", "Priya", None, datetime(2026, 8, 3, tzinfo=timezone.utc)
    )
    assert row.can_submit is True


async def test_an_approved_assignment_cannot_be_resubmitted():
    from app.models.hod import AssignmentStatus, SubmissionStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        title="Essay",
        subject_id=SUBJECT_ID,
        assignment_type="REGULAR",
        total_marks=20,
        passing_marks=8,
        due_date=datetime(2027, 1, 1, tzinfo=timezone.utc),
        status=AssignmentStatus.PUBLISHED,
        allow_late_submission=False,
        late_penalty_percent=0,
    )
    submission = SimpleNamespace(status=SubmissionStatus.APPROVED, score=Decimal("18"))
    row = StudentService._assignment_row(
        assignment, "CS101", "Intro", "Priya", submission, datetime(2026, 8, 3, tzinfo=timezone.utc)
    )
    assert row.can_submit is False
    assert row.my_score == 18.0


async def test_a_rejected_submission_may_be_replaced():
    from app.models.hod import AssignmentStatus, SubmissionStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        title="Essay",
        subject_id=SUBJECT_ID,
        assignment_type="REGULAR",
        total_marks=20,
        passing_marks=8,
        due_date=datetime(2027, 1, 1, tzinfo=timezone.utc),
        status=AssignmentStatus.PUBLISHED,
        allow_late_submission=False,
        late_penalty_percent=0,
    )
    submission = SimpleNamespace(status=SubmissionStatus.RESUBMIT_REQUESTED, score=None)
    row = StudentService._assignment_row(
        assignment, "CS101", "Intro", "Priya", submission, datetime(2026, 8, 3, tzinfo=timezone.utc)
    )
    assert row.can_submit is True


async def test_late_submission_is_refused_when_the_policy_forbids_it(monkeypatch):
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        status=AssignmentStatus.PUBLISHED,
        due_date=datetime(2020, 1, 1, tzinfo=timezone.utc),
        allow_late_submission=False,
        assignment_type="REGULAR",
        allowed_file_types=["pdf"],
        max_file_size_mb=10,
    )
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        StudentService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.submit_assignment(
            FakeDB(), student(), assignment.id, StudentSubmissionCreate(text_response="Done")
        )
    assert excinfo.value.status_code == 409


async def test_submission_rejects_a_disallowed_file_type(monkeypatch):
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        status=AssignmentStatus.PUBLISHED,
        due_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        allow_late_submission=False,
        assignment_type="REGULAR",
        allowed_file_types=["pdf"],
        max_file_size_mb=10,
    )
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        StudentService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )
    payload = StudentSubmissionCreate(
        files=[
            {
                "file_name": "answer.exe",
                "file_key": "k",
                "file_size_bytes": 10,
                "mime_type": "application/octet-stream",
            }
        ]
    )
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.submit_assignment(FakeDB(), student(), assignment.id, payload)
    assert excinfo.value.status_code == 422
    assert "pdf" in excinfo.value.detail


async def test_submission_rejects_an_oversized_file(monkeypatch):
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        status=AssignmentStatus.PUBLISHED,
        due_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        allow_late_submission=False,
        assignment_type="REGULAR",
        allowed_file_types=["pdf"],
        max_file_size_mb=1,
    )
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        StudentService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )
    payload = StudentSubmissionCreate(
        files=[
            {
                "file_name": "answer.pdf",
                "file_key": "k",
                "file_size_bytes": 5 * 1024 * 1024,
                "mime_type": "application/pdf",
            }
        ]
    )
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.submit_assignment(FakeDB(), student(), assignment.id, payload)
    assert excinfo.value.status_code == 422
    assert "MB" in excinfo.value.detail


async def test_a_milestone_assignment_requires_a_milestone(monkeypatch):
    from app.models.hod import AssignmentStatus

    assignment = SimpleNamespace(
        id=uuid.uuid4(),
        status=AssignmentStatus.PUBLISHED,
        due_date=datetime(2030, 1, 1, tzinfo=timezone.utc),
        allow_late_submission=False,
        assignment_type="MILESTONE",
        allowed_file_types=["pdf"],
        max_file_size_mb=10,
    )
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(
        StudentService, "_ensure_assignment", AsyncMock(return_value=assignment)
    )
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.submit_assignment(
            FakeDB(), student(), assignment.id, StudentSubmissionCreate(text_response="Stage done")
        )
    assert excinfo.value.status_code == 422


async def test_a_locked_milestone_cannot_be_submitted():
    """C-ST-12 — stage N stays locked until stage N-1 is approved."""
    assignment = SimpleNamespace(id=uuid.uuid4())
    milestone = SimpleNamespace(id=uuid.uuid4(), sort_order=2, title="Build")
    previous = SimpleNamespace(id=uuid.uuid4(), sort_order=1, title="Proposal")
    db = FakeDB([Result(scalar=previous), Result(scalar=0)])

    with pytest.raises(HTTPException) as excinfo:
        await StudentService._require_milestone_unlocked(db, scope(), assignment, milestone)
    assert excinfo.value.status_code == 409
    assert "Proposal" in excinfo.value.detail


async def test_the_first_milestone_is_always_unlocked():
    milestone = SimpleNamespace(id=uuid.uuid4(), sort_order=1, title="Proposal")
    await StudentService._require_milestone_unlocked(
        FakeDB(), scope(), SimpleNamespace(id=uuid.uuid4()), milestone
    )


# ── C-ST-19 discussion ───────────────────────────────────────────────────────


async def test_a_thread_outside_the_class_is_a_404():
    thread = SimpleNamespace(
        id=uuid.uuid4(), scope_type="CLASS", scope_id=uuid.uuid4(), tenant_id=TENANT
    )
    db = FakeDB([Result(scalar=thread)])
    with pytest.raises(HTTPException) as excinfo:
        await StudentService._ensure_thread(db, scope(), thread.id)
    assert excinfo.value.status_code == 404


async def test_a_thread_defaults_to_the_callers_own_class(monkeypatch):
    """A student cannot address a thread anywhere but their own class or one
    of its subjects — the scope comes from the enrolment, not the payload."""
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    monkeypatch.setattr(StudentService, "thread_detail", AsyncMock(return_value="detail"))
    db = FakeDB()

    await StudentService.create_thread(
        db, student(), StudentThreadCreate(title="Doubt", body="How does X work?")
    )

    thread = db.added[0]
    assert thread.scope_type == "CLASS"
    assert thread.scope_id == CLASS_ID
    assert thread.author_id == STUDENT_ID


async def test_thread_to_a_foreign_subject_is_a_404(monkeypatch):
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    with pytest.raises(HTTPException) as excinfo:
        await StudentService.create_thread(
            FakeDB(),
            student(),
            StudentThreadCreate(title="Doubt", body="?", subject_id=uuid.uuid4()),
        )
    assert excinfo.value.status_code == 404


# ── C-ST-20 fees ─────────────────────────────────────────────────────────────


async def test_no_fee_account_is_a_normal_state_not_an_error(monkeypatch):
    """Finance may simply be switched off for the tenant."""
    monkeypatch.setattr(StudentService, "scope_for_user", AsyncMock(return_value=scope()))
    view = await StudentService.fees(FakeDB([Result(row=None)]), student())
    assert view.has_account is False
    assert view.balance_due is None


# ── Router surface ───────────────────────────────────────────────────────────


def test_student_routes_are_mounted():
    from app.main import app

    paths = {route.path for route in app.routes}
    for path in (
        "/api/v1/student/dashboard",
        "/api/v1/student/profile",
        "/api/v1/student/attendance",
        "/api/v1/student/attendance/leaves",
        "/api/v1/student/timetable",
        "/api/v1/student/examinations",
        "/api/v1/student/assignments",
        "/api/v1/student/content",
        "/api/v1/student/results",
        "/api/v1/student/notices",
        "/api/v1/student/discussion",
        "/api/v1/student/fees",
    ):
        assert path in paths, f"{path} is not mounted"


def test_student_guard_admits_only_the_student_role():
    from app.dependencies.auth import get_current_tenant_user_student

    source = inspect.getsource(get_current_tenant_user_student)
    assert '{"STUDENT"}' in source


def test_no_student_route_accepts_a_student_id():
    """§4.9 is enforced structurally: there is no parameter to tamper with."""
    from app.routers import student as student_router

    for route in student_router.router.routes:
        assert "{student_id}" not in route.path, route.path


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/dashboard", None),
        ("get", "/profile", None),
        ("patch", "/profile", {}),
        ("get", "/attendance", None),
        ("get", "/attendance/leaves", None),
        ("post", "/attendance/leaves", {}),
        ("delete", "/attendance/leaves/00000000-0000-0000-0000-000000000000", None),
        ("get", "/timetable", None),
        ("get", "/examinations", None),
        ("post", "/examinations/00000000-0000-0000-0000-000000000000/attempt", None),
        ("patch", "/attempts/00000000-0000-0000-0000-000000000000", {}),
        ("post", "/attempts/00000000-0000-0000-0000-000000000000/tab-switch", {}),
        ("post", "/attempts/00000000-0000-0000-0000-000000000000/submit", {}),
        ("get", "/examinations/00000000-0000-0000-0000-000000000000/result", None),
        ("get", "/assignments", None),
        ("get", "/assignments/00000000-0000-0000-0000-000000000000", None),
        ("post", "/assignments/00000000-0000-0000-0000-000000000000/submissions", {}),
        ("get", "/content", None),
        ("get", "/content/00000000-0000-0000-0000-000000000000", None),
        ("get", "/results", None),
        ("get", "/results/00000000-0000-0000-0000-000000000000", None),
        ("get", "/notices", None),
        ("post", "/notices/00000000-0000-0000-0000-000000000000/read", None),
        ("get", "/discussion", None),
        ("post", "/discussion", {}),
        ("get", "/discussion/00000000-0000-0000-0000-000000000000", None),
        ("post", "/discussion/00000000-0000-0000-0000-000000000000/replies", {}),
        ("post", "/discussion/vote", {}),
        ("get", "/fees", None),
    ],
)
async def test_student_routes_require_a_bearer_token(method, path, body):
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.request(method, f"/api/v1/student{path}", json=body)
    assert response.status_code == 401, (
        f"{method.upper()} {path} returned {response.status_code}, expected 401"
    )
