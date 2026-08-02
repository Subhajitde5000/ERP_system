"""Focused HOD console tests (C-HD-01 … C-HD-12).

They cover the department fence and the high-risk writes that should never be
allowed to escape an HOD's own classes, teachers, students or discussions.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.models.hod import DiscussionThread
from app.models.user import User
from app.schemas.hod import HodDiscussionModeration
from app.schemas.principal import PrincipalNoticeCreate
from app.services.hod_service import HodService


class Result:
    def __init__(self, scalar=None, rows=None, row=None):
        self._scalar = scalar
        self._rows = rows or []
        self._row = row

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def one(self):
        return self._row

    def one_or_none(self):
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

    def add(self, value):
        self.added.append(value)


def hod(tenant_id: uuid.UUID | None = None) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=tenant_id or uuid.uuid4(),
        name="HOD Sen",
        email="hod@example.edu",
        is_active=True,
    )


async def test_hod_scope_fails_closed_without_department():
    db = FakeDB([Result(rows=[])])
    with pytest.raises(HTTPException) as raised:
        await HodService.scope_for_user(db, hod())
    assert raised.value.status_code == 403
    assert "No active department" in raised.value.detail


async def test_hod_attendance_is_fenced_before_aggregation():
    actor = hod()
    department_id = uuid.uuid4()
    # scope → tenant timezone → attendance grouped aggregate
    db = FakeDB([
        Result(rows=[(department_id, "Computer Science")]),
        Result(scalar="Asia/Kolkata"),
        Result(rows=[]),
    ])
    overview = await HodService.attendance(db, actor)
    assert overview.departments == []
    sql = str(db.queries[-1].compile(dialect=postgresql.dialect()))
    assert "departments.id IN" in sql
    assert "attendance_sessions.tenant_id" in sql


async def test_hod_cannot_pin_a_notice():
    with pytest.raises(HTTPException) as raised:
        await HodService.create_notice(
            FakeDB([]),
            hod(),
            PrincipalNoticeCreate(
                title="Pinned department notice",
                body="HOD cannot pin this.",
                target_scope="DEPARTMENT",
                target_id=uuid.uuid4(),
                is_pinned=True,
            ),
        )
    assert raised.value.status_code == 403


async def test_hod_cannot_create_institution_wide_notice():
    actor = hod()
    department_id = uuid.uuid4()
    db = FakeDB([Result(rows=[(department_id, "Computer Science")])])
    with pytest.raises(HTTPException) as raised:
        await HodService.create_notice(
            db,
            actor,
            PrincipalNoticeCreate(
                title="Institution notice",
                body="HOD cannot publish this.",
                target_scope="INSTITUTION",
            ),
        )
    assert raised.value.status_code == 403
    assert not db.added


async def test_hod_discussion_moderation_is_scoped_and_audited():
    actor = hod()
    department_id = uuid.uuid4()
    thread = DiscussionThread(
        id=uuid.uuid4(),
        tenant_id=actor.tenant_id,
        title="Data structures question",
        body="Can someone explain stacks?",
        author_id=uuid.uuid4(),
        scope_type="DEPARTMENT",
        scope_id=department_id,
        tags=["data-structures"],
        is_pinned=False,
        is_locked=False,
        is_resolved=False,
        reply_count=0,
        upvote_count=0,
        view_count=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    # scope → locked, department-scoped thread
    db = FakeDB([Result(rows=[(department_id, "Computer Science")]), Result(scalar=thread)])
    updated = await HodService.moderate_discussion(
        db, actor, thread.id, HodDiscussionModeration(action="PIN")
    )
    assert updated.is_pinned is True
    assert db.added[0].action == "MODERATE_DISCUSSION_PIN"


async def test_hod_guard_rejects_non_hod_role():
    from app.dependencies.auth import get_current_tenant_user_hod

    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as raised:
        await get_current_tenant_user_hod(hod(), db)
    assert raised.value.status_code == 403


def test_hod_router_exposes_department_workflows_not_final_approval():
    from app.routers.hod import router

    paths = {route.path for route in router.routes}
    assert "/hod/attendance/report" in paths
    assert "/hod/mentor-assignments" in paths
    assert "/hod/discussion/{thread_id}" in paths
    assert not any("/approval" in path for path in paths)


@pytest.mark.parametrize(
    "path,method,json",
    [
        ("/api/v1/hod/dashboard", "get", None),
        ("/api/v1/hod/attendance", "get", None),
        ("/api/v1/hod/attendance/report", "get", None),
        ("/api/v1/hod/examinations", "get", None),
        ("/api/v1/hod/assignments", "get", None),
        ("/api/v1/hod/results", "get", None),
        ("/api/v1/hod/teachers", "get", None),
        ("/api/v1/hod/mentors", "get", None),
        ("/api/v1/hod/notices", "get", None),
        ("/api/v1/hod/discussion", "get", None),
        ("/api/v1/hod/timetable", "get", None),
        ("/api/v1/hod/mentor-assignments", "post", {"student_id": str(uuid.uuid4()), "mentor_id": str(uuid.uuid4())}),
    ],
)
async def test_hod_routes_require_bearer_token(client, path, method, json):
    response = await client.request(method.upper(), path, json=json)
    assert response.status_code == 401
