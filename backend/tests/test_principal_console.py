"""Focused tests for the production Principal console (C-PR-01 … C-PR-10).

The existing suite's integration test is optional when a local Postgres binary
is unavailable.  These service tests cover the governance rules that must hold
regardless of transport, and router tests prove the Principal surface never
falls back to an unauthenticated demo response.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.principal import Exam, ExamStatus, ResultPublication
from app.models.user import User
from app.schemas.principal import (
    PrincipalNoticeCreate,
    ResultApprovalRequest,
    ScheduleApprovalRequest,
)
from app.services.principal_service import PrincipalService


class Result:
    def __init__(self, scalar=None, row=None, rows=None):
        self._scalar = scalar
        self._row = row
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def one_or_none(self):
        return self._row

    def all(self):
        return self._rows

    def scalars(self):
        return MagicMock(all=lambda: self._rows)


class FakeDB:
    def __init__(self, results):
        self._results = list(results)
        self.added = []
        self.execute = AsyncMock(side_effect=self._pop)
        self.flush = AsyncMock()

    async def _pop(self, _statement):
        if not self._results:
            raise AssertionError("Unexpected database query")
        return self._results.pop(0)

    def add(self, instance):
        self.added.append(instance)


def principal(tenant_id: uuid.UUID | None = None) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=tenant_id or uuid.uuid4(),
        name="Principal Patel",
        email="principal@example.edu",
        is_active=True,
    )


def exam(tenant_id: uuid.UUID) -> Exam:
    return Exam(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        title="End-term Mathematics",
        subject_id=uuid.uuid4(),
        class_id=uuid.uuid4(),
        academic_year_id=uuid.uuid4(),
        exam_type="MCQ",
        mode="ONLINE",
        total_marks=100,
        passing_marks=40,
        duration_minutes=90,
        scheduled_at=datetime.now(timezone.utc) + timedelta(days=3),
        status=ExamStatus.DRAFT,
        created_by=uuid.uuid4(),
        schedule_approval_status="PENDING",
    )


async def test_schedule_approval_is_audited_and_final():
    actor = principal()
    item = exam(actor.tenant_id)
    db = FakeDB([Result(row=(item, "Class 10-A", "Mathematics", "MTH101", "Science"))])

    updated = await PrincipalService.approve_schedule(
        db,
        actor.tenant_id,
        actor,
        item.id,
        ScheduleApprovalRequest(decision="APPROVE", note="Room allocation verified."),
    )

    assert updated.schedule_approval_status == "APPROVED"
    assert item.schedule_approved_by == actor.id
    assert item.schedule_approved_at is not None
    assert item.schedule_approval_note == "Room allocation verified."
    assert db.flush.await_count == 1
    assert db.added[0].action == "APPROVE_EXAM_SCHEDULE"

    already_decided = exam(actor.tenant_id)
    already_decided.schedule_approval_status = "APPROVED"
    db = FakeDB([Result(row=(already_decided, "Class 10-A", "Mathematics", "MTH101", "Science"))])
    with pytest.raises(HTTPException) as raised:
        await PrincipalService.approve_schedule(
            db,
            actor.tenant_id,
            actor,
            already_decided.id,
            ScheduleApprovalRequest(decision="REJECT", note="Not needed"),
        )
    assert raised.value.status_code == 409


async def test_result_approval_keeps_publication_in_two_person_flow():
    actor = principal()
    publication = ResultPublication(
        id=uuid.uuid4(),
        tenant_id=actor.tenant_id,
        title="Semester 1 results",
        academic_year_id=uuid.uuid4(),
        exam_ids=[],
        published_by=uuid.uuid4(),
        published_at=datetime.now(timezone.utc),
        is_visible_to_students=False,
        approval_status="PENDING",
    )
    # First result is the FOR UPDATE load; second is the standard list
    # projection returned after the decision is saved.
    db = FakeDB([
        Result(scalar=publication),
        Result(rows=[(publication, "2026-27", "Class 10-A", "Controller", 20, 18, 82.5)]),
    ])

    updated = await PrincipalService.approve_result_publication(
        db,
        actor.tenant_id,
        actor,
        publication.id,
        ResultApprovalRequest(decision="APPROVE"),
    )

    assert updated.approval_status == "APPROVED"
    assert publication.approved_by == actor.id
    assert publication.is_visible_to_students is False
    assert db.added[0].action == "APPROVE_RESULT_PUBLICATION"


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "  ", "body": "Message", "target_scope": "INSTITUTION"},
        {"title": "Notice", "body": "Message", "target_scope": "DEPARTMENT"},
        {"title": "Notice", "body": "Message", "target_scope": "INSTITUTION", "target_id": str(uuid.uuid4())},
    ],
)
def test_notice_payload_rejects_invalid_scope_shape(payload):
    if payload["title"].strip() == "":
        # Pydantic validates field length, while service validates post-strip
        # text before writing.  The constructor may accept spaces by design.
        model = PrincipalNoticeCreate(**payload)
        assert model.title.strip() == ""
    else:
        with pytest.raises(ValueError):
            PrincipalNoticeCreate(**payload)


async def test_principal_can_publish_an_institution_notice_with_audit_row():
    actor = principal()
    db = FakeDB([])
    created = await PrincipalService.create_notice(
        db,
        actor.tenant_id,
        actor,
        PrincipalNoticeCreate(
            title="Academic calendar update",
            body="The revised calendar is now available.",
            target_scope="INSTITUTION",
            priority="IMPORTANT",
            is_pinned=True,
        ),
    )
    assert created.title == "Academic calendar update"
    assert created.target_name == "Institution-wide"
    assert created.read_count == 0
    assert db.added[0].tenant_id == actor.tenant_id
    assert db.added[1].action == "CREATE_NOTICE"


async def test_notice_service_rejects_whitespace_only_content_before_any_query():
    actor = principal()
    db = FakeDB([])
    payload = PrincipalNoticeCreate(title="  ", body="Message", target_scope="INSTITUTION")
    with pytest.raises(HTTPException) as raised:
        await PrincipalService.create_notice(db, actor.tenant_id, actor, payload)
    assert raised.value.status_code == 422
    assert db.execute.await_count == 0


def test_notice_payload_rejects_timezone_less_expiry():
    with pytest.raises(ValueError):
        PrincipalNoticeCreate(
            title="Notice",
            body="Message",
            target_scope="INSTITUTION",
            expires_at="2026-08-03T10:00:00",
        )


async def test_principal_guard_rejects_a_non_principal_assignment():
    from app.dependencies.auth import get_current_tenant_user_principal

    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as raised:
        await get_current_tenant_user_principal(principal(), db)
    assert raised.value.status_code == 403


def test_csv_export_neutralises_spreadsheet_formulas():
    csv_text = PrincipalService.csv_content(
        ["Name", "Value"],
        [["=HYPERLINK(\"https://bad.example\")", "+44"], ["Normal", "42"]],
    )
    assert "'=HYPERLINK" in csv_text
    assert "'+44" in csv_text
    assert "Normal,42" in csv_text


@pytest.mark.parametrize(
    "path,method,json",
    [
        ("/api/v1/principal/dashboard", "get", None),
        ("/api/v1/principal/attendance", "get", None),
        ("/api/v1/principal/examinations", "get", None),
        ("/api/v1/principal/results", "get", None),
        ("/api/v1/principal/staff", "get", None),
        ("/api/v1/principal/students", "get", None),
        ("/api/v1/principal/notices", "get", None),
        ("/api/v1/principal/notices/targets", "get", None),
        ("/api/v1/principal/timetable", "get", None),
        ("/api/v1/principal/reports", "get", None),
        ("/api/v1/principal/reports/export?kind=attendance", "get", None),
        ("/api/v1/principal/notices", "post", {"title": "N", "body": "B", "target_scope": "INSTITUTION"}),
    ],
)
async def test_principal_routes_require_a_bearer_token(client, path, method, json):
    response = await client.request(method.upper(), path, json=json)
    assert response.status_code == 401
