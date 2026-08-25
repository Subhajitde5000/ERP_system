"""Online class API registration and automatic-attendance policy regressions."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import uuid

import pytest

from app.main import app
from app.models.online_class import OnlineAttendanceStatus, OnlineClassStatus
from app.services.online_class_service import OnlineClassService


def test_online_class_routes_registered():
    paths = app.openapi()["paths"]
    expected = {
        "/api/v1/online-classes",
        "/api/v1/online-classes/instant",
        "/api/v1/online-classes/setup-options",
        "/api/v1/online-classes/my/classes",
        "/api/v1/online-classes/{class_id}/start",
        "/api/v1/online-classes/{class_id}/end",
        "/api/v1/online-classes/{class_id}/join",
        "/api/v1/online-classes/{class_id}/attendance",
    }
    assert expected <= set(paths)


@pytest.mark.parametrize(
    "attended,expected",
    [(50, "PRESENT"), (44, "LATE"), (10, "ABSENT"), (0, "ABSENT")],
)
def test_attendance_policy_thresholds(attended, expected):
    status = OnlineClassService._attendance_status(attended * 60, 60 * 60)
    assert status.value == expected


def test_attendance_policy_zero_length_class_is_absent():
    assert OnlineClassService._attendance_status(300, 0) is OnlineAttendanceStatus.ABSENT


def test_admit_sets_first_join_and_session_start():
    p = SimpleNamespace(joined_at=None, waiting_since=None, is_online=False)
    OnlineClassService._admit_participant(p)
    assert p.joined_at is not None and p.waiting_since is not None and p.is_online


def test_leave_accumulates_duration_only_while_online():
    start = datetime.now(timezone.utc) - timedelta(minutes=47)
    p = SimpleNamespace(joined_at=start, waiting_since=start, left_at=None, is_online=True, duration_seconds=0, hand_raised_at=None)
    OnlineClassService._record_leave(p)
    assert 46 * 60 <= p.duration_seconds <= 48 * 60
    assert not p.is_online and p.left_at is not None
    # A second leave without rejoin must not double-count.
    OnlineClassService._record_leave(p)
    assert 46 * 60 <= p.duration_seconds <= 48 * 60


async def test_student_cannot_join_class_that_is_not_live(monkeypatch):
    student = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    oc = SimpleNamespace(id=uuid.uuid4(), tenant_id=student.tenant_id, status=OnlineClassStatus.SCHEDULED)
    monkeypatch.setattr(OnlineClassService, "_get_visible_class", AsyncMock(return_value=oc))
    with pytest.raises(Exception) as raised:
        await OnlineClassService.request_join(MagicMock(), student, oc.id)
    assert raised.value.status_code == 409


async def test_only_owner_can_end_class(monkeypatch):
    teacher = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    oc = SimpleNamespace(id=uuid.uuid4(), tenant_id=teacher.tenant_id, teacher_id=uuid.uuid4(), status=OnlineClassStatus.LIVE)
    db = MagicMock()
    db.get = AsyncMock(return_value=oc)
    with pytest.raises(Exception) as raised:
        await OnlineClassService.end(db, teacher, oc.id)
    assert raised.value.status_code == 403


async def test_finalize_attendance_syncs_policy_to_register(monkeypatch):
    """Class end must write one attendance_session + one record per roster student."""
    from app.models.hod import AttendanceRecord
    from app.models.principal import AttendanceSession

    tenant_id, teacher_id = uuid.uuid4(), uuid.uuid4()
    oc = SimpleNamespace(
        id=uuid.uuid4(), tenant_id=tenant_id, teacher_id=teacher_id,
        subject_id=uuid.uuid4(), class_id=uuid.uuid4(), topic="SQL Joins",
        started_at=datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc),
        ended_at=datetime(2026, 8, 25, 11, 0, tzinfo=timezone.utc),
    )
    roster = [
        SimpleNamespace(student_id=uuid.uuid4(), student_name="Rahul", roll_number="1"),
        SimpleNamespace(student_id=uuid.uuid4(), student_name="Priya", roll_number="2"),
        SimpleNamespace(student_id=uuid.uuid4(), student_name="Amit", roll_number="3"),
        SimpleNamespace(student_id=uuid.uuid4(), student_name="Neha", roll_number="4"),
    ]
    # 47 min → PRESENT, 40 min → LATE, 13 min → ABSENT, Neha never joined.
    participants = [
        SimpleNamespace(student_id=roster[0].student_id, duration_seconds=47 * 60, attendance_status=None, joined_at=oc.started_at),
        SimpleNamespace(student_id=roster[1].student_id, duration_seconds=40 * 60, attendance_status=None, joined_at=datetime(2026, 8, 25, 10, 5, tzinfo=timezone.utc)),
        SimpleNamespace(student_id=roster[2].student_id, duration_seconds=13 * 60, attendance_status=None, joined_at=datetime(2026, 8, 25, 10, 17, tzinfo=timezone.utc)),
    ]
    monkeypatch.setattr("app.services.online_class_service.TeacherService._current_year", AsyncMock(return_value=SimpleNamespace(id=uuid.uuid4())))
    monkeypatch.setattr("app.services.online_class_service.TeacherService._roster", AsyncMock(return_value=roster))
    monkeypatch.setattr(OnlineClassService, "_timezone", AsyncMock(return_value="UTC"))

    db = MagicMock()
    db.flush = AsyncMock()
    session_id = await OnlineClassService._finalize_attendance(db, oc, participants)

    assert session_id is not None
    added = [call.args[0] for call in db.add.call_args_list]
    sessions = [row for row in added if isinstance(row, AttendanceSession)]
    records = [row for row in added if isinstance(row, AttendanceRecord)]
    assert len(sessions) == 1 and sessions[0].period_label.startswith("ONLINE 10:00")
    assert len(records) == 4
    assert {r.status.value for r in records} == {"PRESENT", "LATE", "ABSENT"}
    assert sessions[0].total_present == 2 and sessions[0].total_absent == 2
    assert [p.attendance_status.value for p in participants] == ["PRESENT", "LATE", "ABSENT"]
    # Neha never joined → no participant row, but an ABSENT register record.
    neha_record = next(r for r in records if r.student_id == roster[3].student_id)
    assert neha_record.status.value == "ABSENT"
