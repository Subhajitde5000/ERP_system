"""Online Class workflows — schedule, go live, track joins, auto-attendance.

Scope model mirrors the teacher console: a teacher may only create classes
for subjects they actually teach (``teacher_subjects``), and a student may
only see/join classes of the class they are actively enrolled in.

Automatic attendance policy (institution default):

* attended >= 75% of the live duration  → PRESENT
* attended 30–74%                       → LATE (partial attendance)
* attended < 30% or never joined        → ABSENT

When a class ends the report is synced into the canonical
``attendance_sessions`` / ``attendance_records`` tables so the rest of the
ERP (teacher sessions, student calendar, HOD reports) sees it unchanged.

Participant timing columns: ``joined_at`` is the first admission, ``left_at``
the last departure, and ``waiting_since`` doubles as the start of the
*current* in-class segment so students who drop and rejoin accumulate real
time in ``duration_seconds``.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, WebSocket, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import SchoolClass, Subject
from app.models.enrollment import Enrollment
from app.models.hod import AttendanceRecord
from app.models.online_class import (
    Notification,
    OnlineAttendanceStatus,
    OnlineClass,
    OnlineClassFile,
    OnlineClassMessage,
    OnlineClassMode,
    OnlineClassParticipant,
    OnlineClassStatus,
)
from app.models.principal import AttendanceSession, AttendanceStatus
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.online_class import (
    OnlineAttendanceReport,
    OnlineAttendanceRow,
    OnlineClassCreate,
    OnlineClassDetail,
    OnlineClassPage,
    OnlineClassRow,
    OnlineClassSetupOptions,
    OnlineClassUpdate,
    OnlineFileRow,
    OnlineMessageRow,
    OnlineParticipantRow,
    StudentOnlineClassList,
    StudentOnlineClassRow,
)
from app.services.audit_service import AuditService
from app.services.principal_service import PrincipalService
from app.services.teacher_service import TeacherService

# ── Institution attendance policy for live classes ────────────────────────────
PRESENT_MIN_RATIO = 0.75
LATE_MIN_RATIO = 0.30

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _tenant_now(tz_name: str | None) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz_name or "UTC"))
    except (ValueError, TypeError, KeyError, ZoneInfoNotFoundError):
        return datetime.now(timezone.utc)


class LiveRoomManager:
    """In-memory hub for the live-classroom WebSockets of every running class."""

    def __init__(self) -> None:
        # class_id → user_id → {"ws": WebSocket, "name": str, "role": str}
        self.rooms: dict[uuid.UUID, dict[uuid.UUID, dict]] = {}

    def connect(self, class_id: uuid.UUID, user_id: uuid.UUID, ws: WebSocket, name: str, role: str) -> None:
        self.rooms.setdefault(class_id, {})[user_id] = {"ws": ws, "name": name, "role": role}

    def disconnect(self, class_id: uuid.UUID, user_id: uuid.UUID) -> None:
        room = self.rooms.get(class_id)
        if room:
            room.pop(user_id, None)
            if not room:
                self.rooms.pop(class_id, None)

    def online_peers(self, class_id: uuid.UUID, exclude: uuid.UUID | None = None) -> list[dict]:
        return [
            {"id": str(user_id), "name": info["name"], "role": info["role"]}
            for user_id, info in self.rooms.get(class_id, {}).items()
            if user_id != exclude
        ]

    async def broadcast(self, class_id: uuid.UUID, payload: dict, exclude: uuid.UUID | None = None) -> None:
        for user_id, info in list(self.rooms.get(class_id, {}).items()):
            if user_id == exclude:
                continue
            try:
                await info["ws"].send_json(payload)
            except Exception:
                pass  # half-closed socket; the disconnect handler cleans up

    async def send_to(self, class_id: uuid.UUID, user_id: uuid.UUID, payload: dict) -> None:
        info = self.rooms.get(class_id, {}).get(user_id)
        if info is not None:
            try:
                await info["ws"].send_json(payload)
            except Exception:
                pass


live_rooms = LiveRoomManager()


class OnlineClassService:
    # ── Shared helpers ────────────────────────────────────────────────────────

    @staticmethod
    async def _timezone(db: AsyncSession, tenant_id: uuid.UUID) -> str | None:
        return (await db.execute(select(Tenant.timezone).where(Tenant.id == tenant_id))).scalar_one_or_none()

    @staticmethod
    async def _get_owned_class(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineClass:
        oc = await db.get(OnlineClass, class_id)
        if oc is None or oc.tenant_id != teacher.tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Online class not found")
        if oc.teacher_id != teacher.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the class teacher can manage this class")
        return oc

    @staticmethod
    async def _get_visible_class(db: AsyncSession, user: User, class_id: uuid.UUID) -> OnlineClass:
        oc = await db.get(OnlineClass, class_id)
        if oc is None or oc.tenant_id != user.tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Online class not found")
        return oc

    @staticmethod
    async def _names(db: AsyncSession, oc: OnlineClass) -> tuple[str, str, str, str]:
        """(class_name, subject_code, subject_name, teacher_name)."""
        class_name, subject_name, teacher_name = (
            await db.execute(
                select(SchoolClass.name, Subject.name, User.name)
                .select_from(SchoolClass)
                .join(Subject, Subject.id == oc.subject_id)
                .join(User, User.id == oc.teacher_id)
                .where(SchoolClass.id == oc.class_id)
            )
        ).one()
        subject_code = (await db.execute(select(Subject.code).where(Subject.id == oc.subject_id))).scalar_one()
        return class_name, subject_code, subject_name, teacher_name

    @staticmethod
    async def _to_row(db: AsyncSession, oc: OnlineClass) -> OnlineClassRow:
        class_name, subject_code, subject_name, teacher_name = await OnlineClassService._names(db, oc)
        count = (
            await db.execute(
                select(func.count(OnlineClassParticipant.id)).where(
                    OnlineClassParticipant.class_id == oc.id,
                    OnlineClassParticipant.joined_at.is_not(None),
                )
            )
        ).scalar_one()
        return OnlineClassRow(
            id=oc.id,
            class_id=oc.class_id,
            class_name=class_name,
            subject_id=oc.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            teacher_id=oc.teacher_id,
            teacher_name=teacher_name,
            topic=oc.topic,
            mode=oc.mode.value,
            status=oc.status.value,
            scheduled_at=oc.scheduled_at,
            duration_minutes=oc.duration_minutes,
            allow_join=oc.allow_join,
            recording_enabled=oc.recording_enabled,
            recording_url=oc.recording_url,
            started_at=oc.started_at,
            ended_at=oc.ended_at,
            created_at=oc.created_at,
            participant_count=count,
        )

    @staticmethod
    async def _participant_rows(db: AsyncSession, oc: OnlineClass) -> list[OnlineParticipantRow]:
        rows = (
            await db.execute(
                select(OnlineClassParticipant, User.name, Enrollment.roll_number)
                .join(User, User.id == OnlineClassParticipant.student_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == OnlineClassParticipant.student_id,
                        Enrollment.class_id == oc.class_id,
                    ),
                )
                .where(OnlineClassParticipant.class_id == oc.id)
                .order_by(OnlineClassParticipant.waiting_since)
            )
        ).all()
        return [
            OnlineParticipantRow(
                student_id=p.student_id,
                student_name=name,
                roll_number=roll,
                waiting_since=p.waiting_since,
                joined_at=p.joined_at,
                left_at=p.left_at,
                duration_seconds=p.duration_seconds,
                attendance_status=p.attendance_status.value if p.attendance_status else None,
                hand_raised_at=p.hand_raised_at,
                is_online=p.is_online,
            )
            for p, name, roll in rows
        ]

    @staticmethod
    async def _file_rows(db: AsyncSession, class_id: uuid.UUID) -> list[OnlineFileRow]:
        rows = (
            await db.execute(
                select(OnlineClassFile, User.name)
                .join(User, User.id == OnlineClassFile.uploader_id)
                .where(OnlineClassFile.class_id == class_id)
                .order_by(OnlineClassFile.created_at)
            )
        ).all()
        return [
            OnlineFileRow(
                id=f.id,
                uploader_name=name,
                file_name=f.file_name,
                url=f"/uploads/online-classes/{class_id}/{f.file_path}",
                file_size_bytes=f.file_size_bytes,
                mime_type=f.mime_type,
                created_at=f.created_at,
            )
            for f, name in rows
        ]

    # ── Teacher: setup & creation ─────────────────────────────────────────────

    @staticmethod
    async def setup_options(db: AsyncSession, teacher: User) -> OnlineClassSetupOptions:
        scope = await TeacherService.scope_for_user(db, teacher)
        current_year = await TeacherService._current_year(db, teacher.tenant_id)
        slots = []
        if current_year is not None:
            today = await PrincipalService._tenant_today(db, teacher.tenant_id)
            slots = await TeacherService._slots_for(
                db, teacher.tenant_id, current_year.id, teacher_id=teacher.id, day=today
            )
            slots = [s for s in slots if s.class_id in scope.class_ids and s.subject_id is not None]
        return OnlineClassSetupOptions(assignments=list(scope.assignments), today_slots=slots)

    @staticmethod
    async def _create(
        db: AsyncSession,
        teacher: User,
        payload: OnlineClassCreate,
        mode: OnlineClassMode,
    ) -> OnlineClass:
        scope = await TeacherService.scope_for_user(db, teacher)
        TeacherService._ensure_teaches(scope, payload.subject_id, payload.class_id)
        subject = (
            await db.execute(
                select(Subject).where(Subject.id == payload.subject_id, Subject.class_id == payload.class_id)
            )
        ).scalar_one_or_none()
        if subject is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Subject does not belong to this class")

        now = _tenant_now(await OnlineClassService._timezone(db, teacher.tenant_id))
        if mode == OnlineClassMode.INSTANT:
            oc_status, started, scheduled = OnlineClassStatus.LIVE, now, now
        else:
            if payload.scheduled_at is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="scheduled_at is required")
            if payload.scheduled_at <= now:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Scheduled time must be in the future")
            oc_status, started, scheduled = OnlineClassStatus.SCHEDULED, None, payload.scheduled_at

        oc = OnlineClass(
            id=uuid.uuid4(),
            tenant_id=teacher.tenant_id,
            teacher_id=teacher.id,
            class_id=payload.class_id,
            subject_id=payload.subject_id,
            timetable_slot_id=payload.timetable_slot_id,
            topic=payload.topic.strip(),
            mode=mode,
            status=oc_status,
            scheduled_at=scheduled,
            duration_minutes=payload.duration_minutes,
            allow_join=payload.allow_join,
            recording_enabled=payload.recording_enabled,
            started_at=started,
        )
        db.add(oc)
        await db.flush()
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="CREATE_ONLINE_CLASS",
            entity="OnlineClass",
            entity_id=oc.id,
            tenant_id=teacher.tenant_id,
            new_value={"mode": mode.value, "topic": oc.topic},
        )
        return oc

    @staticmethod
    async def create_scheduled(db: AsyncSession, teacher: User, payload: OnlineClassCreate) -> OnlineClassRow:
        return await OnlineClassService._to_row(
            db, await OnlineClassService._create(db, teacher, payload, OnlineClassMode.SCHEDULED)
        )

    @staticmethod
    async def create_instant(db: AsyncSession, teacher: User, payload: OnlineClassCreate) -> OnlineClassRow:
        oc = await OnlineClassService._create(db, teacher, payload, OnlineClassMode.INSTANT)
        await OnlineClassService._notify_class(db, oc)
        return await OnlineClassService._to_row(db, oc)

    @staticmethod
    async def _notify_class(db: AsyncSession, oc: OnlineClass) -> None:
        """Tell every enrolled student the class is live now (instant classes)."""
        current_year = await TeacherService._current_year(db, oc.tenant_id)
        if current_year is None:
            return
        student_ids = (
            await db.execute(
                select(Enrollment.student_id).where(
                    Enrollment.tenant_id == oc.tenant_id,
                    Enrollment.class_id == oc.class_id,
                    Enrollment.academic_year_id == current_year.id,
                    Enrollment.status == "ACTIVE",
                )
            )
        ).scalars().all()
        subject_name = (await db.execute(select(Subject.name).where(Subject.id == oc.subject_id))).scalar_one()
        for student_id in student_ids:
            db.add(
                Notification(
                    id=uuid.uuid4(),
                    tenant_id=oc.tenant_id,
                    user_id=student_id,
                    title="Live class starting now",
                    body=f"{subject_name}: {oc.topic}. Join from Online classes.",
                    type="ONLINE_CLASS",
                    data={"class_id": str(oc.id)},
                )
            )

    # ── Teacher: lifecycle ────────────────────────────────────────────────────

    @staticmethod
    async def list_for_teacher(
        db: AsyncSession,
        teacher: User,
        status_filter: str | None,
        limit: int,
        offset: int,
    ) -> OnlineClassPage:
        TeacherService._validate_page(limit, offset)
        base = select(OnlineClass).where(
            OnlineClass.tenant_id == teacher.tenant_id, OnlineClass.teacher_id == teacher.id
        )
        if status_filter:
            try:
                base = base.where(OnlineClass.status == OnlineClassStatus(status_filter.upper()))
            except ValueError:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown status filter")
        total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        rows = (await db.execute(base.order_by(OnlineClass.created_at.desc()).limit(limit).offset(offset))).scalars().all()
        return OnlineClassPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[await OnlineClassService._to_row(db, oc) for oc in rows],
        )

    @staticmethod
    async def detail_for_teacher(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineClassDetail:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        row = await OnlineClassService._to_row(db, oc)
        roster = await TeacherService._roster(db, teacher.tenant_id, oc.class_id)
        return OnlineClassDetail(
            **row.model_dump(),
            roster_size=len(roster),
            participants=await OnlineClassService._participant_rows(db, oc),
            files=await OnlineClassService._file_rows(db, oc.id),
        )

    @staticmethod
    async def start(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineClassRow:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.SCHEDULED:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Only a scheduled class can be started")
        now = _tenant_now(await OnlineClassService._timezone(db, teacher.tenant_id))
        oc.status = OnlineClassStatus.LIVE
        oc.started_at = now
        await db.flush()
        await OnlineClassService._notify_class(db, oc)
        AuditService.record(
            db, actor=teacher, actor_role="TEACHER", action="START_ONLINE_CLASS",
            entity="OnlineClass", entity_id=oc.id, tenant_id=teacher.tenant_id,
        )
        return await OnlineClassService._to_row(db, oc)

    @staticmethod
    async def update(
        db: AsyncSession, teacher: User, class_id: uuid.UUID, payload: OnlineClassUpdate
    ) -> OnlineClassRow:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status in (OnlineClassStatus.COMPLETED, OnlineClassStatus.CANCELLED):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This class has already ended")
        if payload.allow_join is not None:
            oc.allow_join = payload.allow_join
        if payload.recording_enabled is not None:
            oc.recording_enabled = payload.recording_enabled
        await db.flush()
        return await OnlineClassService._to_row(db, oc)

    @staticmethod
    async def cancel(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineClassRow:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.SCHEDULED:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Only a scheduled class can be cancelled")
        oc.status = OnlineClassStatus.CANCELLED
        await db.flush()
        return await OnlineClassService._to_row(db, oc)

    @staticmethod
    async def end(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineAttendanceReport:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.LIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Only a live class can be ended")
        now = datetime.now(timezone.utc)
        oc.status = OnlineClassStatus.COMPLETED
        oc.ended_at = now

        participants = (
            await db.execute(select(OnlineClassParticipant).where(OnlineClassParticipant.class_id == oc.id))
        ).scalars().all()
        for p in participants:
            if p.is_online and p.joined_at is not None:
                p.duration_seconds += max(0, int((now - p.waiting_since).total_seconds()))
            if p.joined_at is not None and p.left_at is None:
                p.left_at = now
            p.is_online = False
            p.hand_raised_at = None
        await db.flush()

        oc.attendance_session_id = await OnlineClassService._finalize_attendance(db, oc, participants)
        await db.flush()
        AuditService.record(
            db, actor=teacher, actor_role="TEACHER", action="END_ONLINE_CLASS",
            entity="OnlineClass", entity_id=oc.id, tenant_id=teacher.tenant_id,
            new_value={"participants": len(participants)},
        )
        await live_rooms.broadcast(oc.id, {"type": "class-ended"})
        return await OnlineClassService.attendance_report(db, teacher, class_id)

    # ── Teacher: waiting room & participants ──────────────────────────────────

    @staticmethod
    async def _get_participant(db: AsyncSession, oc: OnlineClass, student_id: uuid.UUID) -> OnlineClassParticipant:
        p = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == student_id
                )
            )
        ).scalar_one_or_none()
        if p is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Student is not in the waiting room")
        return p

    @staticmethod
    def _admit_participant(p: OnlineClassParticipant) -> None:
        now = datetime.now(timezone.utc)
        if p.joined_at is None:
            p.joined_at = now
        p.waiting_since = now  # start of the current in-class segment
        p.is_online = True

    @staticmethod
    def _record_leave(p: OnlineClassParticipant) -> None:
        now = datetime.now(timezone.utc)
        if p.is_online and p.joined_at is not None:
            p.duration_seconds += max(0, int((now - p.waiting_since).total_seconds()))
            p.left_at = now
        p.is_online = False
        p.hand_raised_at = None

    @staticmethod
    async def admit(db: AsyncSession, teacher: User, class_id: uuid.UUID, student_id: uuid.UUID) -> OnlineClassDetail:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.LIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Class is not live")
        p = await OnlineClassService._get_participant(db, oc, student_id)
        OnlineClassService._admit_participant(p)
        await db.flush()
        await live_rooms.send_to(oc.id, student_id, {"type": "admitted"})
        return await OnlineClassService.detail_for_teacher(db, teacher, class_id)

    @staticmethod
    async def admit_all(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineClassDetail:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.LIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Class is not live")
        waiting = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id,
                    OnlineClassParticipant.joined_at.is_(None),
                )
            )
        ).scalars().all()
        for p in waiting:
            OnlineClassService._admit_participant(p)
            await live_rooms.send_to(oc.id, p.student_id, {"type": "admitted"})
        await db.flush()
        return await OnlineClassService.detail_for_teacher(db, teacher, class_id)

    @staticmethod
    async def remove_student(
        db: AsyncSession, teacher: User, class_id: uuid.UUID, student_id: uuid.UUID
    ) -> OnlineClassDetail:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        if oc.status != OnlineClassStatus.LIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Class is not live")
        p = await OnlineClassService._get_participant(db, oc, student_id)
        OnlineClassService._record_leave(p)
        await db.flush()
        await live_rooms.send_to(oc.id, student_id, {"type": "removed"})
        return await OnlineClassService.detail_for_teacher(db, teacher, class_id)

    # ── Attendance report & canonical sync ────────────────────────────────────

    @staticmethod
    def _attendance_status(duration_seconds: int, class_seconds: int) -> OnlineAttendanceStatus:
        if class_seconds <= 0 or duration_seconds <= 0:
            return OnlineAttendanceStatus.ABSENT
        ratio = duration_seconds / class_seconds
        if ratio >= PRESENT_MIN_RATIO:
            return OnlineAttendanceStatus.PRESENT
        if ratio >= LATE_MIN_RATIO:
            return OnlineAttendanceStatus.LATE
        return OnlineAttendanceStatus.ABSENT

    @staticmethod
    async def attendance_report(db: AsyncSession, teacher: User, class_id: uuid.UUID) -> OnlineAttendanceReport:
        oc = await OnlineClassService._get_owned_class(db, teacher, class_id)
        class_name, _, subject_name, _ = await OnlineClassService._names(db, oc)
        class_seconds = int((oc.ended_at - oc.started_at).total_seconds()) if oc.started_at and oc.ended_at else 0
        roster = await TeacherService._roster(db, teacher.tenant_id, oc.class_id)
        joined = {
            p.student_id: p
            for p in (
                await db.execute(select(OnlineClassParticipant).where(OnlineClassParticipant.class_id == oc.id))
            ).scalars().all()
        }
        rows: list[OnlineAttendanceRow] = []
        totals = {OnlineAttendanceStatus.PRESENT: 0, OnlineAttendanceStatus.LATE: 0, OnlineAttendanceStatus.ABSENT: 0}
        for entry in roster:
            p = joined.get(entry.student_id)
            seconds = p.duration_seconds if p else 0
            derived = (
                p.attendance_status
                if p is not None and p.attendance_status is not None
                else OnlineClassService._attendance_status(seconds, class_seconds)
            )
            totals[derived] += 1
            rows.append(
                OnlineAttendanceRow(
                    student_id=entry.student_id,
                    student_name=entry.student_name,
                    roll_number=entry.roll_number,
                    joined_at=p.joined_at if p else None,
                    left_at=p.left_at if p else None,
                    duration_seconds=seconds,
                    percent=round(seconds * 100 / class_seconds, 1) if class_seconds else None,
                    attendance_status=derived.value,
                )
            )
        return OnlineAttendanceReport(
            class_id=str(oc.id),
            class_name=class_name,
            subject_name=subject_name,
            topic=oc.topic,
            started_at=oc.started_at,
            ended_at=oc.ended_at,
            duration_seconds=class_seconds,
            present_min_percent=PRESENT_MIN_RATIO * 100,
            late_min_percent=LATE_MIN_RATIO * 100,
            totals_present=totals[OnlineAttendanceStatus.PRESENT],
            totals_late=totals[OnlineAttendanceStatus.LATE],
            totals_absent=totals[OnlineAttendanceStatus.ABSENT],
            rows=rows,
        )

    @staticmethod
    async def _finalize_attendance(
        db: AsyncSession, oc: OnlineClass, participants: list[OnlineClassParticipant]
    ) -> uuid.UUID | None:
        """Sync the finished live class into attendance_sessions/records."""
        current_year = await TeacherService._current_year(db, oc.tenant_id)
        if current_year is None or not oc.started_at or not oc.ended_at:
            return None
        class_seconds = int((oc.ended_at - oc.started_at).total_seconds())
        tz_name = await OnlineClassService._timezone(db, oc.tenant_id)
        try:
            tz = ZoneInfo(tz_name or "UTC")
        except (ValueError, TypeError, KeyError, ZoneInfoNotFoundError):
            tz = timezone.utc
        local_start = oc.started_at.astimezone(tz)
        local_end = oc.ended_at.astimezone(tz)

        roster = await TeacherService._roster(db, oc.tenant_id, oc.class_id)
        by_student = {p.student_id: p for p in participants}

        # Class id suffix keeps the (subject, class, date, period) key unique
        # even when a teacher holds two live sessions in the same slot.
        session = AttendanceSession(
            id=uuid.uuid4(),
            tenant_id=oc.tenant_id,
            subject_id=oc.subject_id,
            class_id=oc.class_id,
            teacher_id=oc.teacher_id,
            academic_year_id=current_year.id,
            date=local_start.date(),
            period_label=f"ONLINE {local_start.strftime('%H:%M')} #{oc.id.hex[:6]}",
            start_time=local_start.time(),
            end_time=local_end.time(),
            notes=f"Online class: {oc.topic}",
        )
        db.add(session)
        await db.flush()

        present = absent = 0
        for entry in roster:
            p = by_student.get(entry.student_id)
            seconds = p.duration_seconds if p else 0
            derived = OnlineClassService._attendance_status(seconds, class_seconds)
            if p is not None:
                p.attendance_status = derived
            mapped = {
                OnlineAttendanceStatus.PRESENT: AttendanceStatus.PRESENT,
                OnlineAttendanceStatus.LATE: AttendanceStatus.LATE,
                OnlineAttendanceStatus.ABSENT: AttendanceStatus.ABSENT,
            }[derived]
            if mapped is AttendanceStatus.ABSENT:
                absent += 1
            else:
                present += 1
            percent = round(seconds * 100 / class_seconds, 1) if class_seconds else 0.0
            db.add(
                AttendanceRecord(
                    id=uuid.uuid4(),
                    tenant_id=oc.tenant_id,
                    session_id=session.id,
                    student_id=entry.student_id,
                    status=mapped,
                    late_by_minutes=int((p.joined_at - oc.started_at).total_seconds() // 60)
                    if p and p.joined_at and derived is OnlineAttendanceStatus.LATE
                    else None,
                    remarks=f"Online class · {percent}% of {class_seconds // 60} min",
                    updated_by=oc.teacher_id,
                )
            )
        session.total_present = present
        session.total_absent = absent
        return session.id

    # ── Student console ───────────────────────────────────────────────────────

    @staticmethod
    async def _student_class(db: AsyncSession, student: User) -> uuid.UUID | None:
        current_year = await TeacherService._current_year(db, student.tenant_id)
        if current_year is None:
            return None
        return (
            await db.execute(
                select(Enrollment.class_id).where(
                    Enrollment.tenant_id == student.tenant_id,
                    Enrollment.student_id == student.id,
                    Enrollment.academic_year_id == current_year.id,
                    Enrollment.status == "ACTIVE",
                )
            )
        ).scalars().first()

    @staticmethod
    async def list_for_student(db: AsyncSession, student: User) -> StudentOnlineClassList:
        enrolled_class = await OnlineClassService._student_class(db, student)
        if enrolled_class is None:
            return StudentOnlineClassList(today=[], upcoming=[], past=[])
        now = _tenant_now(await OnlineClassService._timezone(db, student.tenant_id))
        rows = (
            await db.execute(
                select(OnlineClass)
                .where(
                    OnlineClass.tenant_id == student.tenant_id,
                    OnlineClass.class_id == enrolled_class,
                    OnlineClass.status != OnlineClassStatus.CANCELLED,
                )
                .order_by(OnlineClass.created_at.desc())
                .limit(50)
            )
        ).scalars().all()

        today, upcoming, past = [], [], []
        for oc in rows:
            row = await OnlineClassService._to_student_row(db, oc, student)
            if oc.status == OnlineClassStatus.LIVE:
                today.append(row)
            elif oc.status == OnlineClassStatus.SCHEDULED:
                (today if oc.scheduled_at and oc.scheduled_at.date() == now.date() else upcoming).append(row)
            else:
                past.append(row)
        return StudentOnlineClassList(today=today, upcoming=upcoming, past=past)

    @staticmethod
    async def _to_student_row(db: AsyncSession, oc: OnlineClass, student: User) -> StudentOnlineClassRow:
        base = await OnlineClassService._to_row(db, oc)
        p = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == student.id
                )
            )
        ).scalar_one_or_none()
        if oc.status == OnlineClassStatus.LIVE:
            if p and p.joined_at is not None and p.is_online:
                join_state = "IN_CLASS"
            elif p and p.joined_at is None:
                join_state = "WAITING"
            elif oc.allow_join:
                join_state = "JOINABLE"
            else:
                join_state = "UPCOMING"
        elif oc.status == OnlineClassStatus.SCHEDULED:
            join_state = "UPCOMING"
        else:
            join_state = "ENDED"
        return StudentOnlineClassRow(**base.model_dump(), join_state=join_state)

    @staticmethod
    async def detail_for_student(db: AsyncSession, student: User, class_id: uuid.UUID) -> OnlineClassDetail:
        oc = await OnlineClassService._get_visible_class(db, student, class_id)
        row = await OnlineClassService._to_student_row(db, oc, student)
        participants = await OnlineClassService._participant_rows(db, oc)
        return OnlineClassDetail(
            **row.model_dump(),
            roster_size=0,
            participants=[p for p in participants if p.joined_at is not None or p.student_id == student.id],
            files=await OnlineClassService._file_rows(db, oc.id),
        )

    @staticmethod
    async def request_join(db: AsyncSession, student: User, class_id: uuid.UUID) -> StudentOnlineClassRow:
        oc = await OnlineClassService._get_visible_class(db, student, class_id)
        if oc.status != OnlineClassStatus.LIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This class is not live right now")
        if not oc.allow_join:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="The teacher has not opened this class for joining")
        enrolled_class = await OnlineClassService._student_class(db, student)
        if enrolled_class != oc.class_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this class")
        existing = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == student.id
                )
            )
        ).scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if existing is None:
            db.add(
                OnlineClassParticipant(
                    id=uuid.uuid4(),
                    tenant_id=oc.tenant_id,
                    class_id=oc.id,
                    student_id=student.id,
                    waiting_since=now,
                )
            )
        elif existing.joined_at is not None and not existing.is_online:
            # Rejoin after a drop — previously admitted, no waiting room again.
            OnlineClassService._admit_participant(existing)
        await db.flush()
        await live_rooms.broadcast(
            oc.id, {"type": "waiting-updated", "student_id": str(student.id), "name": student.name}
        )
        return await OnlineClassService._to_student_row(db, oc, student)

    @staticmethod
    async def leave(db: AsyncSession, student: User, class_id: uuid.UUID) -> StudentOnlineClassRow:
        oc = await OnlineClassService._get_visible_class(db, student, class_id)
        p = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == student.id
                )
            )
        ).scalar_one_or_none()
        if p is not None and oc.status == OnlineClassStatus.LIVE:
            OnlineClassService._record_leave(p)
            await db.flush()
        await live_rooms.broadcast(oc.id, {"type": "peer-left", "peer_id": str(student.id)})
        return await OnlineClassService._to_student_row(db, oc, student)

    # ── Chat & files (both roles) ─────────────────────────────────────────────

    @staticmethod
    async def _ensure_room_member(db: AsyncSession, user: User, oc: OnlineClass) -> str:
        if user.id == oc.teacher_id:
            return "TEACHER"
        p = (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == user.id
                )
            )
        ).scalar_one_or_none()
        if p is None or p.joined_at is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Join the class before participating")
        return "STUDENT"

    @staticmethod
    async def messages(db: AsyncSession, user: User, class_id: uuid.UUID, limit: int = 100) -> list[OnlineMessageRow]:
        oc = await OnlineClassService._get_visible_class(db, user, class_id)
        await OnlineClassService._ensure_room_member(db, user, oc)
        rows = (
            await db.execute(
                select(OnlineClassMessage, User.name)
                .join(User, User.id == OnlineClassMessage.sender_id)
                .where(OnlineClassMessage.class_id == class_id)
                .order_by(OnlineClassMessage.created_at.desc())
                .limit(min(limit, 200))
            )
        ).all()
        return [
            OnlineMessageRow(
                id=m.id, sender_id=m.sender_id, sender_name=name, sender_role=m.sender_role,
                body=m.body, created_at=m.created_at,
            )
            for m, name in reversed(rows)
        ]

    @staticmethod
    async def post_message(db: AsyncSession, user: User, oc: OnlineClass, body: str) -> OnlineMessageRow:
        role = await OnlineClassService._ensure_room_member(db, user, oc)
        m = OnlineClassMessage(
            id=uuid.uuid4(),
            tenant_id=oc.tenant_id,
            class_id=oc.id,
            sender_id=user.id,
            sender_role=role,
            body=body.strip()[:1000],
        )
        db.add(m)
        await db.flush()
        return OnlineMessageRow(
            id=m.id, sender_id=user.id, sender_name=user.name, sender_role=role, body=m.body, created_at=m.created_at
        )

    @staticmethod
    async def files(db: AsyncSession, user: User, class_id: uuid.UUID) -> list[OnlineFileRow]:
        oc = await OnlineClassService._get_visible_class(db, user, class_id)
        await OnlineClassService._ensure_room_member(db, user, oc)
        return await OnlineClassService._file_rows(db, class_id)

    @staticmethod
    async def add_file(
        db: AsyncSession,
        user: User,
        oc: OnlineClass,
        filename: str,
        content: bytes,
        mime_type: str,
        uploads_root: Path,
    ) -> OnlineFileRow:
        if user.id != oc.teacher_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the teacher can share files in class")
        if oc.status not in (OnlineClassStatus.LIVE, OnlineClassStatus.COMPLETED):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Files can be shared once the class has started")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the 25 MB limit")
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:200] or "file"
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        target_dir = uploads_root / "online-classes" / str(oc.id)
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / stored_name).write_bytes(content)
        db.add(
            OnlineClassFile(
                id=uuid.uuid4(),
                tenant_id=oc.tenant_id,
                class_id=oc.id,
                uploader_id=user.id,
                file_name=safe_name,
                file_path=stored_name,
                file_size_bytes=len(content),
                mime_type=(mime_type or "application/octet-stream")[:100],
            )
        )
        await db.flush()
        row = (await OnlineClassService._file_rows(db, oc.id))[-1]
        await live_rooms.broadcast(oc.id, {"type": "file-shared", "file": row.model_dump(mode="json")})
        return row

    @staticmethod
    async def save_recording(
        db: AsyncSession, user: User, oc: OnlineClass, filename: str, content: bytes, mime_type: str, uploads_root: Path
    ) -> OnlineClassRow:
        if user.id != oc.teacher_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the class teacher can save a recording")
        row = await OnlineClassService.add_file(db, user, oc, filename, content, mime_type, uploads_root)
        oc.recording_url = row.url
        await db.flush()
        return await OnlineClassService._to_row(db, oc)

    # ── WebSocket lifecycle hooks ─────────────────────────────────────────────

    @staticmethod
    async def _participant(db: AsyncSession, oc: OnlineClass, student: User) -> OnlineClassParticipant | None:
        return (
            await db.execute(
                select(OnlineClassParticipant).where(
                    OnlineClassParticipant.class_id == oc.id, OnlineClassParticipant.student_id == student.id
                )
            )
        ).scalar_one_or_none()

    @staticmethod
    async def ws_student_joined(db: AsyncSession, oc: OnlineClass, student: User) -> None:
        """Mark an admitted student online when their live socket connects."""
        p = await OnlineClassService._participant(db, oc, student)
        if p is not None and p.joined_at is not None:
            p.is_online = True
            p.waiting_since = datetime.now(timezone.utc)  # current segment start
            await db.flush()

    @staticmethod
    async def ws_student_left(db: AsyncSession, oc: OnlineClass, student: User) -> None:
        p = await OnlineClassService._participant(db, oc, student)
        if p is not None and oc.status == OnlineClassStatus.LIVE:
            OnlineClassService._record_leave(p)
            await db.flush()
