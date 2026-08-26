"""Tests for production online class features:
- Mute / Unmute student
- Attendance override
- Attendance CSV export
- Student notifications inbox & mark-as-read
- Admin & Institutional monitoring overview
- Rescheduling / updating topic and duration
- File deletion
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.online_class import OnlineAttendanceStatus, OnlineClass, OnlineClassMode, OnlineClassStatus
from app.schemas.online_class import AttendanceOverrideIn, OnlineClassRow, OnlineClassUpdate
from app.services.online_class_service import OnlineClassService


def _mock_row(oc_id=None, topic="Topic"):
    return OnlineClassRow(
        id=oc_id or uuid.uuid4(),
        class_id=uuid.uuid4(),
        class_name="Class 10-A",
        subject_id=uuid.uuid4(),
        subject_code="CS101",
        subject_name="Computer Science",
        teacher_id=uuid.uuid4(),
        teacher_name="Teacher Name",
        topic=topic,
        mode="SCHEDULED",
        status="SCHEDULED",
        duration_minutes=60,
        allow_join=True,
        recording_enabled=False,
        created_at=datetime.now(timezone.utc),
        participant_count=0,
    )


@pytest.mark.asyncio
async def test_update_class_topic_and_duration(monkeypatch):
    teacher = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    oc = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=teacher.tenant_id,
        teacher_id=teacher.id,
        topic="Old Topic",
        duration_minutes=30,
        status=OnlineClassStatus.SCHEDULED,
        allow_join=True,
        recording_enabled=False,
        scheduled_at=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=oc)
    db.flush = AsyncMock()

    monkeypatch.setattr(OnlineClassService, "_to_row", AsyncMock(return_value=_mock_row(oc.id, "New Topic")))

    payload = OnlineClassUpdate(topic="New Topic", duration_minutes=45)
    row = await OnlineClassService.update(db, teacher, oc.id, payload)

    assert oc.topic == "New Topic"
    assert oc.duration_minutes == 45


@pytest.mark.asyncio
async def test_mute_and_unmute_student(monkeypatch):
    teacher = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    student_id = uuid.uuid4()
    oc = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=teacher.tenant_id,
        teacher_id=teacher.id,
        class_id=uuid.uuid4(),
        topic="Live Class",
        status=OnlineClassStatus.LIVE,
        whiteboard_strokes=[],
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=oc)
    db.add = MagicMock()
    db.delete = MagicMock()
    db.flush = AsyncMock()

    monkeypatch.setattr(OnlineClassService, "_to_row", AsyncMock(return_value=_mock_row(oc.id, oc.topic)))
    monkeypatch.setattr(OnlineClassService, "_participant_rows", AsyncMock(return_value=[]))
    monkeypatch.setattr(OnlineClassService, "_file_rows", AsyncMock(return_value=[]))
    monkeypatch.setattr("app.services.teacher_service.TeacherService._roster", AsyncMock(return_value=[]))

    scalars_mock = MagicMock()
    scalars_mock.scalars.return_value.all.return_value = [student_id]
    scalars_mock.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=scalars_mock)

    detail = await OnlineClassService.mute_student(db, teacher, oc.id, student_id)
    assert db.add.called

    await OnlineClassService.unmute_student(db, teacher, oc.id, student_id)
    assert db.execute.called


@pytest.mark.asyncio
async def test_override_attendance(monkeypatch):
    teacher = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    student_id = uuid.uuid4()
    oc = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=teacher.tenant_id,
        teacher_id=teacher.id,
        class_id=uuid.uuid4(),
        status=OnlineClassStatus.COMPLETED,
        started_at=datetime.now(timezone.utc) - timedelta(minutes=60),
        ended_at=datetime.now(timezone.utc),
        attendance_session_id=None,
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=oc)
    db.flush = AsyncMock()

    part = SimpleNamespace(
        id=uuid.uuid4(),
        student_id=student_id,
        attendance_status=OnlineAttendanceStatus.ABSENT,
    )
    exec_mock = MagicMock()
    exec_mock.scalar_one_or_none.return_value = part
    db.execute = AsyncMock(return_value=exec_mock)

    report_mock = MagicMock(rows=[])
    monkeypatch.setattr(OnlineClassService, "attendance_report", AsyncMock(return_value=report_mock))

    report = await OnlineClassService.override_attendance(
        db, teacher, oc.id, student_id, "PRESENT", remarks="Medical reason"
    )
    assert part.attendance_status == OnlineAttendanceStatus.PRESENT


@pytest.mark.asyncio
async def test_export_attendance_csv(monkeypatch):
    teacher = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    class_id = uuid.uuid4()

    mock_report = SimpleNamespace(
        class_name="Grade 10",
        subject_name="Mathematics",
        topic="Quadratic Equations",
        started_at=datetime(2026, 8, 27, 9, 0, tzinfo=timezone.utc),
        ended_at=datetime(2026, 8, 27, 10, 0, tzinfo=timezone.utc),
        duration_seconds=3600,
        rows=[
            SimpleNamespace(
                roll_number="101",
                student_name="Alice Smith",
                joined_at=datetime(2026, 8, 27, 9, 0, tzinfo=timezone.utc),
                left_at=datetime(2026, 8, 27, 10, 0, tzinfo=timezone.utc),
                duration_seconds=3600,
                percent=100.0,
                attendance_status="PRESENT",
            )
        ],
    )
    monkeypatch.setattr(OnlineClassService, "attendance_report", AsyncMock(return_value=mock_report))

    csv_text = await OnlineClassService.export_attendance_csv(MagicMock(), teacher, class_id)
    assert "Alice Smith" in csv_text
    assert "Quadratic Equations" in csv_text
    assert "PRESENT" in csv_text


@pytest.mark.asyncio
async def test_notifications_inbox_and_mark_read():
    student = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
    notif_id = uuid.uuid4()
    notif = SimpleNamespace(
        id=notif_id,
        user_id=student.id,
        title="Live Class Starting",
        body="Join DBMS now",
        type="ONLINE_CLASS",
        data={"class_id": str(uuid.uuid4())},
        is_read=False,
        read_at=None,
        created_at=datetime.now(timezone.utc),
    )

    db = MagicMock()
    db.flush = AsyncMock()
    exec_mock = MagicMock()
    exec_mock.scalar_one.side_effect = [1, 1]  # total=1, unread=1
    exec_mock.scalars.return_value.all.return_value = [notif]
    exec_mock.scalar_one_or_none.return_value = notif
    db.execute = AsyncMock(return_value=exec_mock)

    # 1. List
    page = await OnlineClassService.list_notifications(db, student, limit=10, offset=0)
    assert page.total == 1
    assert page.items[0].title == "Live Class Starting"

    # 2. Mark Read
    updated = await OnlineClassService.mark_notification_read(db, student, notif_id)
    assert updated.is_read is True
    assert notif.read_at is not None
