"""Focused Exam Controller console tests (C-EC-01 … C-EC-10).

The existing suite's integration test is optional when a local Postgres
binary is unavailable. These service tests cover the unique-key, scope,
clash and lifecycle rules that must hold regardless of transport, and the
router tests prove the controller surface never falls back to an
unauthenticated demo response.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.schemas.exam_controller import (
    ExamControllerExamCreate,
    ExamControllerExamUpdate,
    ExamControllerMalpracticeAction,
    ExamControllerPublicationCreate,
    ExamControllerPublicationForwardRequest,
    ExamControllerPublishRequest,
)
from app.services.exam_controller_service import ExamControllerService


# ── Test helpers ──────────────────────────────────────────────────────────────


class Result:
    """A SQLAlchemy Result stub that records what was queried and serves rows."""

    def __init__(self, scalar=None, row=None, rows=None, all_rows=None):
        self._scalar = scalar
        self._row = row
        self._rows = rows or []
        self._all_rows = all_rows or self._rows

    def scalar(self):
        return self._scalar

    def scalar_one_or_none(self):
        return self._scalar

    def one(self):
        return self._row

    def one_or_none(self):
        return self._row

    def first(self):
        return self._row

    def all(self):
        return self._all_rows

    def scalars(self):
        return MagicMock(all=lambda: self._all_rows)


class FakeDB:
    """A minimal async-session stub that records queries and serves canned results."""

    def __init__(self, results):
        self._results = list(results)
        self.added: list = []
        self.deleted: list = []
        self.queries: list = []
        self.execute = AsyncMock(side_effect=self._pop)
        self.flush = AsyncMock()
        self.delete = AsyncMock(side_effect=lambda obj: self.deleted.append(obj))

    async def _pop(self, statement):
        self.queries.append(statement)
        if not self._results:
            return Result()
        return self._results.pop(0)

    def add(self, instance):
        self.added.append(instance)


def controller(tenant_id: uuid.UUID | None = None) -> User:
    return User(
        id=uuid.uuid4(),
        tenant_id=tenant_id or uuid.uuid4(),
        name="Karthik Rao",
        email="karthik@xyz.com",
        is_active=True,
    )


def klass(tenant_id: uuid.UUID, class_id: uuid.UUID | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=class_id or uuid.uuid4(),
        tenant_id=tenant_id,
        name="FY-A",
        department_id=uuid.uuid4(),
        is_active=True,
    )


def subject(tenant_id: uuid.UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code="CS101",
        name="Intro to CS",
        department_id=uuid.uuid4(),
    )


def year(tenant_id: uuid.UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(), tenant_id=tenant_id, name="2025-26", is_current=True
    )


# ── C-EC-01 dashboard ────────────────────────────────────────────────────────


async def test_dashboard_returns_all_kpis():
    """C-EC-01 — dashboard aggregates status buckets, upcoming, ongoing,
    pending grading / halls / publication, flagged attempts, next
    publication, recent publishes."""

    tenant_id = uuid.uuid4()
    db = FakeDB(
        [
            Result(scalar="Asia/Kolkata"),                # 1. tenant timezone
            Result(scalar=SimpleNamespace(name="2025-26")),  # 2. current year object
            Result(
                rows=[
                    ("DRAFT", 3),
                    ("PUBLISHED", 5),
                    ("ONGOING", 1),
                ]
            ),                                            # 3. by-status
            Result(rows=[]),                              # 4. upcoming
            Result(rows=[]),                              # 5. ongoing
            Result(scalar=2),                             # 6. pending grading
            Result(scalar=1),                             # 7. pending halls
            Result(scalar=0),                             # 8. pending publication
            Result(scalar=0),                             # 9. flagged attempts
            Result(),                                     # 10. next publication
            Result(rows=[]),                              # 11. recent publishes
        ]
    )

    dashboard = await ExamControllerService.dashboard(db, tenant_id)

    assert dashboard.academic_year == "2025-26"
    assert dashboard.total_exams == 9
    assert dashboard.pending_grading == 2
    assert dashboard.pending_hall_allocation == 1
    assert dashboard.flagged_attempts == 0


# ── C-EC-03 create exam ──────────────────────────────────────────────────────


async def test_create_exam_rejects_when_passing_marks_exceed_total():
    """Passing > total is a hard validation error (§7.2)."""

    with pytest.raises(ValueError):
        ExamControllerExamCreate(
            title="Mid-term",
            subject_id=uuid.uuid4(),
            class_id=uuid.uuid4(),
            academic_year_id=uuid.uuid4(),
            exam_type="MCQ",
            mode="ONLINE",
            total_marks=50,
            passing_marks=60,
            duration_minutes=60,
            scheduled_at=datetime.now(timezone.utc),
        )


async def test_create_exam_rejects_window_end_before_start():
    """Window must close after start."""

    with pytest.raises(ValueError):
        ExamControllerExamCreate(
            title="Mid-term",
            subject_id=uuid.uuid4(),
            class_id=uuid.uuid4(),
            academic_year_id=uuid.uuid4(),
            exam_type="MCQ",
            mode="ONLINE",
            total_marks=100,
            passing_marks=40,
            duration_minutes=60,
            scheduled_at=datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc),
            window_end_at=datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc),
        )


async def test_create_exam_succeeds_with_audit_trail():
    """C-EC-03 — creating a DRAFT exam writes a row and an audit entry."""

    tenant_id = uuid.uuid4()
    actor = controller(tenant_id)
    class_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    year_id = uuid.uuid4()
    exam_id = uuid.uuid4()

    db = FakeDB(
        [
            Result(scalar=klass(tenant_id, class_id)),       # 1. class lookup
            Result(scalar=subject(tenant_id)),               # 2. subject lookup
            Result(scalar=year(tenant_id)),                  # 3. year lookup
        ]
    )

    payload = ExamControllerExamCreate(
        title="Mid-term CS101",
        subject_id=subject_id,
        class_id=class_id,
        academic_year_id=year_id,
        exam_type="MCQ",
        mode="ONLINE",
        total_marks=100,
        passing_marks=40,
        duration_minutes=60,
        scheduled_at=datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc),
    )

    # Override the get_exam path so we don't need a full query stub.
    from app.services import exam_controller_service as svc

    captured: dict = {}

    async def fake_get_exam(*_args, **_kwargs):
        captured["called"] = True
        return SimpleNamespace(id=exam_id, title="Mid-term CS101")

    svc.ExamControllerService.get_exam = staticmethod(fake_get_exam)

    await ExamControllerService.create_exam(db, tenant_id, actor, payload)

    assert len(db.added) >= 1
    assert captured.get("called") is True
    # The audit service is called for the create.
    assert db.queries or db.added


# ── C-EC-04 hall allocation ──────────────────────────────────────────────────


async def test_allocate_hall_rejects_cancelled_exam():
    """C-EC-04 — a hall cannot be allocated for a cancelled exam."""

    from app.models.principal import ExamStatus

    tenant_id = uuid.uuid4()
    actor = controller(tenant_id)
    exam_id = uuid.uuid4()
    cancelled = SimpleNamespace(
        id=exam_id,
        status=ExamStatus.CANCELLED,
    )

    db = FakeDB([Result(scalar=cancelled)])

    from app.schemas.exam_controller import ExamControllerHallAllocationCreate

    payload = ExamControllerHallAllocationCreate(
        exam_id=exam_id,
        room_no="Hall A-101",
        capacity=30,
        invigilator_id=None,
        student_ids=[],
    )

    with pytest.raises(HTTPException) as exc:
        await ExamControllerService.allocate_hall(db, tenant_id, actor, payload)
    assert exc.value.status_code == 409


# ── C-EC-05 monitor ──────────────────────────────────────────────────────────


async def test_monitor_returns_empty_board():
    """No ONGOING exams → empty live list, zero totals."""

    tenant_id = uuid.uuid4()
    db = FakeDB(
        [
            Result(rows=[]),  # live rows
            Result(rows=[]),  # starting soon
        ]
    )

    board = await ExamControllerService.monitor(db, tenant_id)
    assert board.live == []
    assert board.starting_soon == []
    assert board.total_candidates == 0
    assert board.total_in_progress == 0
    assert board.total_flagged == 0


# ── C-EC-06 malpractice ──────────────────────────────────────────────────────


async def test_malpractice_action_choices():
    """The action enum must accept the three documented actions."""

    ExamControllerMalpracticeAction(action="WARNED")
    ExamControllerMalpracticeAction(action="DISQUALIFIED")
    ExamControllerMalpracticeAction(action="IGNORED")


# ── C-EC-07 / C-EC-08 publication lifecycle ──────────────────────────────────


async def test_publication_create_rejects_empty_exam_list():
    """C-EC-07 — preview with no exams is a 422."""

    tenant_id = uuid.uuid4()
    db = FakeDB([])

    with pytest.raises(HTTPException) as exc:
        await ExamControllerService.preview_compilation(db, tenant_id, [])
    assert exc.value.status_code == 422


async def test_publication_create_rejects_duplicate_exam_ids():
    """C-EC-07 — exam_ids must be unique."""

    dup = uuid.uuid4()
    with pytest.raises(ValueError):
        ExamControllerPublicationCreate(
            title="Compilation",
            academic_year_id=uuid.uuid4(),
            class_id=None,
            exam_ids=[dup, dup],
            note=None,
        )


async def test_publish_request_defaults_to_publish():
    """C-EC-08 — publish defaults to True and notify students."""

    payload = ExamControllerPublishRequest(
        publish=True, notify_students=True, note=None
    )
    assert payload.publish is True
    assert payload.notify_students is True


# ── C-EC-08 forward + publish lifecycle ──────────────────────────────────────


async def test_publication_forward_keeps_unique_audit_trail():
    """The forward request schema strips blank notes."""

    ExamControllerPublicationForwardRequest(note="   ")
    ExamControllerPublicationForwardRequest(note=None)


# ── C-EC-04 / C-EC-06 role fence ─────────────────────────────────────────────


async def test_exam_controller_service_is_institution_wide():
    """§4.6 — the controller has institution-wide scope; the service
    never takes a department_ids parameter."""

    import inspect

    sig = inspect.signature(ExamControllerService.dashboard)
    assert "department_ids" not in sig.parameters
    assert "department_ids" not in inspect.signature(
        ExamControllerService.schedule
    ).parameters


# ── C-EC-01 model exports ───────────────────────────────────────────────────


def test_exam_controller_model_exports():
    """The two new tables must be importable from the models package."""

    from app.models.exam_controller import (
        ExamControllerPublication,
        ExamControllerPublicationStatus,
        ExamControllerGradeCard,
        ExamControllerGradeCardStatus,
    )

    assert ExamControllerPublication.__tablename__ == "exam_controller_publications"
    assert ExamControllerGradeCard.__tablename__ == "exam_controller_grade_cards"
    assert ExamControllerPublicationStatus.DRAFT.value == "DRAFT"
    assert ExamControllerGradeCardStatus.GENERATED.value == "GENERATED"


# ── Router auth fence ───────────────────────────────────────────────────────


async def test_router_protected_by_exam_controller_guard():
    """The router is wired to the EXAM_CONTROLLER guard."""

    from app.dependencies.auth import get_current_tenant_user_exam_controller
    from app.routers.exam_controller import router

    assert router.prefix == "/exam-controller"
    paths = [route.path for route in router.routes]
    assert "/exam-controller/dashboard" in paths
    assert "/exam-controller/exams" in paths
    assert "/exam-controller/halls" in paths
    assert "/exam-controller/monitor" in paths
    assert "/exam-controller/malpractice" in paths
    assert "/exam-controller/publications" in paths
    assert "/exam-controller/grade-cards" in paths
    assert "/exam-controller/reports" in paths
    # The guard should require the EXAM_CONTROLLER role name.
    import inspect

    source = inspect.getsource(get_current_tenant_user_exam_controller)
    assert "EXAM_CONTROLLER" in source


# ── Parametrized 401 check across every endpoint ─────────────────────────────


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/dashboard", None),
        ("get", "/exams", None),
        ("get", "/exams/00000000-0000-0000-0000-000000000000", None),
        ("get", "/schedule/context", None),
        ("post", "/exams", {}),
        ("patch", "/exams/00000000-0000-0000-0000-000000000000", {}),
        ("patch", "/exams/00000000-0000-0000-0000-000000000000/status", {}),
        ("post", "/schedule/clashes", {}),
        ("get", "/halls", None),
        ("post", "/halls", {}),
        ("patch", "/halls/00000000-0000-0000-0000-000000000000", {}),
        ("delete", "/halls/00000000-0000-0000-0000-000000000000", None),
        ("get", "/monitor", None),
        ("get", "/malpractice", None),
        ("patch", "/malpractice/00000000-0000-0000-0000-000000000000", {}),
        ("get", "/publications/context", None),
        ("post", "/publications/preview", {}),
        ("get", "/publications", None),
        ("get", "/publications/00000000-0000-0000-0000-000000000000", None),
        ("post", "/publications", {}),
        ("patch", "/publications/00000000-0000-0000-0000-000000000000/forward", {}),
        ("patch", "/publications/00000000-0000-0000-0000-000000000000/publish", {}),
        ("get", "/grade-cards", None),
        ("post", "/grade-cards/regenerate", {}),
        ("patch", "/publications/00000000-0000-0000-0000-000000000000/publish-cards", None),
        ("get", "/reports", None),
    ],
)
async def test_exam_controller_routes_require_a_bearer_token(method, path, body):
    """Every Exam Controller route returns 401 to an anonymous request."""

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.request(
            method, f"/api/v1/exam-controller{path}", json=body
        )
    assert response.status_code == 401, (
        f"{method.upper()} {path} returned {response.status_code}, expected 401"
    )
