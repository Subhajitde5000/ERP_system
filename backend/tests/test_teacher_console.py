"""Focused Teacher console tests (C-TC-01 … C-TC-22).

They cover the teaching-scope fence (a teacher must never touch another
teacher's classes, exams or submissions) and the state machines that guard
the high-risk writes: attendance locking, leave review, exam publishing and
submission review.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.models.lms import LeaveStatus
from app.models.principal import ExamStatus
from app.models.user import User
from app.schemas.teacher import AttendanceSessionUpsert, TeacherLeaveReview, TeacherSubmissionReviewIn
from app.services.teacher_service import TeacherService


class Result:
    def __init__(self, scalar=None, rows=None, row=None):
        self._scalar = scalar
        self._rows = rows or []
        self._row = row

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def one(self):
        return self._row

    def one_or_none(self):
        return self._row

    def first(self):
        return self._row

    def all(self):
        return self._rows

    def scalars(self):
        return MagicMock(all=lambda: self._rows)


class FakeDB:
    def __init__(self, results):
        self.results = list(results)
        self.queries = []
        self.added = []
        self.execute = AsyncMock(side_effect=self._pop)

    async def _pop(self, statement):
        statement.compile(dialect=postgresql.dialect())
        self.queries.append(statement)
        if not self.results:
            raise AssertionError("Unexpected database query")
        return self.results.pop(0)

    async def flush(self):
        pass

    async def delete(self, value):
        pass

    def add(self, value):
        self.added.append(value)


def teacher(tenant_id: uuid.UUID | None = None) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=tenant_id or uuid.uuid4(),
        name="Teacher Asha",
        email="asha@example.edu",
        is_active=True,
    )


def teaching_row(tenant_id: uuid.UUID):
    subject = SimpleNamespace(id=uuid.uuid4(), code="CS101", name="Data Structures", is_active=True)
    school_class = SimpleNamespace(
        id=uuid.uuid4(), name="CSE Sem 3", department_id=uuid.uuid4(), class_teacher_id=None, is_active=True
    )
    department = SimpleNamespace(id=school_class.department_id, name="Computer Science")
    link = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role_in_subject="TEACHER")
    return link, subject, school_class, department


async def test_teacher_scope_fails_closed_without_assignments():
    db = FakeDB([Result(rows=[]), Result(rows=[])])
    with pytest.raises(HTTPException) as raised:
        await TeacherService.scope_for_user(db, teacher())
    assert raised.value.status_code == 403
    assert "No teaching assignments" in raised.value.detail


async def test_attendance_cannot_be_marked_for_a_future_date():
    actor = teacher()
    link, subject, school_class, department = teaching_row(actor.tenant_id)
    db = FakeDB([
        Result(rows=[(link, subject, school_class, department)]),
        Result(rows=[]),
        Result(scalar="UTC"),  # tenant timezone
    ])
    payload = AttendanceSessionUpsert(
        class_id=school_class.id,
        subject_id=subject.id,
        date=date.today() + timedelta(days=3),
        period_label="P1",
        records=[],
    )
    with pytest.raises(HTTPException) as raised:
        await TeacherService.save_attendance(db, actor, payload)
    assert raised.value.status_code == 422
    assert "future date" in raised.value.detail


async def test_attendance_rejects_a_subject_the_teacher_does_not_teach():
    actor = teacher()
    link, subject, school_class, department = teaching_row(actor.tenant_id)
    db = FakeDB([
        Result(rows=[(link, subject, school_class, department)]),
        Result(rows=[]),
    ])
    payload = AttendanceSessionUpsert(
        class_id=uuid.uuid4(),
        subject_id=uuid.uuid4(),
        date=date.today(),
        period_label="P1",
        records=[],
    )
    with pytest.raises(HTTPException) as raised:
        await TeacherService.save_attendance(db, actor, payload)
    assert raised.value.status_code == 403
    assert len(db.queries) == 2  # scope only — never reached attendance tables


async def test_leave_review_rejects_an_already_reviewed_request():
    actor = teacher()
    link, subject, school_class, department = teaching_row(actor.tenant_id)
    leave = SimpleNamespace(
        id=uuid.uuid4(),
        status=LeaveStatus.APPROVED,
        student_id=uuid.uuid4(),
    )
    student = SimpleNamespace(id=leave.student_id, name="Aryan", student_roll_no="CS-01")
    db = FakeDB([
        Result(rows=[(link, subject, school_class, department)]),
        Result(rows=[]),
        Result(row=(leave, student, school_class, None)),
    ])
    with pytest.raises(HTTPException) as raised:
        await TeacherService.review_leave(db, actor, leave.id, TeacherLeaveReview(decision="REJECTED"))
    assert raised.value.status_code == 409


async def test_exam_cannot_publish_without_questions():
    actor = teacher()
    exam = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=actor.tenant_id,
        created_by=actor.id,
        status=ExamStatus.DRAFT,
        total_marks=50,
    )
    db = FakeDB([
        Result(scalar=exam),  # owned exam
        Result(row=(0, 0)),  # question count + mark sum
    ])
    with pytest.raises(HTTPException) as raised:
        await TeacherService.publish_exam(db, actor, exam.id)
    assert raised.value.status_code == 422
    assert "at least one question" in raised.value.detail


async def test_exam_detail_is_invisible_to_other_teachers():
    actor = teacher()
    db = FakeDB([Result(scalar=None)])  # exam select → not this teacher's
    with pytest.raises(HTTPException) as raised:
        await TeacherService.exam_detail(db, actor, uuid.uuid4())
    assert raised.value.status_code == 404


async def test_submission_review_requires_a_score_to_approve():
    actor = teacher()
    submission = SimpleNamespace(
        id=uuid.uuid4(), status="SUBMITTED", version=1, milestone_id=None,
    )
    assignment = SimpleNamespace(id=uuid.uuid4(), teacher_id=actor.id, total_marks=100)
    student = SimpleNamespace(id=uuid.uuid4(), name="Aryan", student_roll_no="CS-01")
    db = FakeDB([
        Result(row=(submission, assignment, student, None, None)),
    ])
    with pytest.raises(HTTPException) as raised:
        await TeacherService.review_submission(
            db, actor, submission.id, TeacherSubmissionReviewIn(decision="APPROVED")
        )
    assert raised.value.status_code == 422
    assert "score is required" in raised.value.detail


async def test_discussion_moderation_is_limited_to_own_subjects():
    actor = teacher()
    link, subject, school_class, department = teaching_row(actor.tenant_id)
    thread = SimpleNamespace(
        id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        scope_type="CLASS",
        scope_id=uuid.uuid4(),  # a class outside the teacher's scope
        is_pinned=False,
        is_locked=False,
    )
    db = FakeDB([
        Result(rows=[(link, subject, school_class, department)]),
        Result(rows=[]),
        Result(scalar=thread),
    ])
    from app.schemas.teacher import TeacherThreadModeration

    with pytest.raises(HTTPException) as raised:
        await TeacherService.moderate_thread(db, actor, thread.id, TeacherThreadModeration(action="LOCK"))
    assert raised.value.status_code == 403


async def test_teacher_guard_rejects_non_teacher_role():
    from app.dependencies.auth import get_current_tenant_user_teacher

    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as raised:
        await get_current_tenant_user_teacher(teacher(), db)
    assert raised.value.status_code == 403


def test_teacher_router_exposes_the_documented_workflows():
    from app.routers.teacher import router

    paths = {route.path for route in router.routes}
    for expected in (
        "/teacher/dashboard",
        "/teacher/schedule",
        "/teacher/attendance/board",
        "/teacher/attendance/sessions",
        "/teacher/attendance/sessions/{session_id}/lock",
        "/teacher/attendance/leaves/{leave_id}/review",
        "/teacher/examinations",
        "/teacher/examinations/{exam_id}/questions",
        "/teacher/examinations/{exam_id}/attempts/{attempt_id}/grade",
        "/teacher/examinations/{exam_id}/release",
        "/teacher/assignments",
        "/teacher/assignments/{assignment_id}/milestones",
        "/teacher/submissions/{submission_id}/review",
        "/teacher/content",
        "/teacher/notices",
        "/teacher/discussion",
        "/teacher/discussion/replies/{reply_id}/accept",
    ):
        assert expected in paths, expected


@pytest.mark.parametrize(
    "path,method,json",
    [
        ("/api/v1/teacher/dashboard", "get", None),
        ("/api/v1/teacher/schedule", "get", None),
        ("/api/v1/teacher/attendance/sessions", "get", None),
        ("/api/v1/teacher/attendance/leaves", "get", None),
        ("/api/v1/teacher/examinations", "get", None),
        ("/api/v1/teacher/examinations", "post", {"title": "Unit Test 1", "subject_id": str(uuid.uuid4()), "class_id": str(uuid.uuid4()), "total_marks": 50, "passing_marks": 20, "duration_minutes": 60, "scheduled_at": "2026-08-10T09:00:00+00:00"}),
        ("/api/v1/teacher/assignments", "get", None),
        ("/api/v1/teacher/submissions", "get", None),
        ("/api/v1/teacher/content", "get", None),
        ("/api/v1/teacher/notices", "get", None),
        ("/api/v1/teacher/discussion", "get", None),
    ],
)
async def test_teacher_routes_require_bearer_token(client, path, method, json):
    response = await client.request(method.upper(), path, json=json)
    assert response.status_code == 401
