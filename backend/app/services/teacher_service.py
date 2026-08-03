"""Teacher console workflows (C-TC-01 … C-TC-22).

§4.5 scopes a Teacher to *assigned classes and subjects only*. Every public
method here begins by resolving that fence through ``TeacherScopeService`` and
then filters on it; nothing trusts an id from the URL or the body as authority.
Out-of-scope ids return **404**, matching the rule in `ARCHITECTURE.md` §1 —
a 403 would confirm the record exists.

The service writes to the canonical ERP tables, never to a teacher-local
mirror. Attendance marked here is the same ``attendance_records`` the HOD
reports on; an exam created here is the same ``exams`` row the Exam Controller
schedules and the Principal approves. That is what keeps the consoles
consistent without a synchronisation job.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Iterable, Sequence

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import AcademicYear, Department, SchoolClass, Subject
from app.models.coordinator import TimetableSubstitution
from app.models.enrollment import Enrollment, TeacherSubject
from app.models.hod import (
    Assignment,
    AssignmentStatus,
    AttendanceRecord,
    DiscussionThread,
    Submission,
    SubmissionStatus,
)
from app.models.principal import (
    AttendanceSession,
    AttendanceStatus,
    AttemptStatus,
    Exam,
    ExamAttempt,
    ExamStatus,
    Notice,
    NoticePriority,
    NoticeScope,
    TimetableSlot,
)
from app.models.teaching import (
    Answer,
    AttendanceLeave,
    ContentItem,
    ContentType,
    DiscussionReply,
    LeaveStatus,
    Milestone,
    Question,
    QuestionOption,
    QuestionType,
    ReviewDecision,
    SubmissionFile,
    SubmissionReview,
)
from app.models.user import User
from app.schemas.teacher import (
    TeacherAnswerRow,
    TeacherAssignmentCreate,
    TeacherAssignmentDetail,
    TeacherAssignmentPage,
    TeacherAssignmentRow,
    TeacherAssignmentUpdate,
    TeacherAttemptDetail,
    TeacherAttemptRow,
    TeacherClassOption,
    TeacherContentCreate,
    TeacherContentPage,
    TeacherContentRow,
    TeacherContentUpdate,
    TeacherDashboard,
    TeacherExamCreate,
    TeacherExamPage,
    TeacherExamPaper,
    TeacherExamResults,
    TeacherExamRow,
    TeacherExamUpdate,
    TeacherGradeRequest,
    TeacherLeaveDecision,
    TeacherLeavePage,
    TeacherLeaveRow,
    TeacherMarkContext,
    TeacherMilestoneRow,
    TeacherNoticeCreate,
    TeacherNoticePage,
    TeacherNoticeRow,
    TeacherPendingReview,
    TeacherQuestionCreate,
    TeacherQuestionOption,
    TeacherQuestionRow,
    TeacherReplyCreate,
    TeacherReplyRow,
    TeacherRosterStudent,
    TeacherSchedule,
    TeacherScheduleSlot,
    TeacherSessionCreate,
    TeacherSessionDetail,
    TeacherSessionPage,
    TeacherSessionRow,
    TeacherSessionUpdate,
    TeacherSubjectOption,
    TeacherSubmissionBoard,
    TeacherSubmissionDetail,
    TeacherSubmissionFile,
    TeacherSubmissionReview,
    TeacherSubmissionReviewRow,
    TeacherSubmissionRow,
    TeacherThreadCreate,
    TeacherThreadDetail,
    TeacherThreadModeration,
    TeacherThreadPage,
    TeacherThreadRow,
    TeacherTodayClass,
    TeacherUpcomingExam,
)
from app.services.audit_service import AuditService
from app.services.principal_service import PrincipalService, _page_bounds, _value
from app.services.teacher_scope_service import TeacherScope, TeacherScopeService

__all__ = ["TeacherService"]


#: How far ahead the dashboard lists exams. Matches the Exam Controller's
#: monitor window so the two consoles never disagree about "upcoming".
UPCOMING_EXAM_DAYS = 14

#: Statuses that still need a teacher's eyes on the submission review queue.
_PENDING_REVIEW = (
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.UNDER_REVIEW,
    SubmissionStatus.RESUBMIT_REQUESTED,
)

#: Exams a teacher may still edit. Once students are attempting, the paper is
#: frozen — an edit mid-attempt changes the marks under the people sitting it.
_EDITABLE_EXAM_STATUSES = (ExamStatus.DRAFT, ExamStatus.PUBLISHED)

#: Objective types the engine can score without a human.
_AUTO_GRADED_TYPES = (QuestionType.MCQ, QuestionType.TRUE_FALSE)


def _pct(numerator: int, denominator: int) -> float | None:
    return round(numerator * 100 / denominator, 2) if denominator else None


def _decimal(value: Decimal | float | int | None) -> float | None:
    return round(float(value), 2) if value is not None else None


def _grade_for(percentage: float) -> str:
    """The default institution grade band (database_design_complete.md §7.4)."""
    for floor, label in ((90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D"), (40, "E")):
        if percentage >= floor:
            return label
    return "F"


class TeacherService:
    # ── Scope helpers ───────────────────────────────────────────────────────

    @staticmethod
    async def scope_for_user(db: AsyncSession, teacher: User) -> TeacherScope:
        return await TeacherScopeService.resolve(db, teacher)

    @staticmethod
    async def _subject_options(db: AsyncSession, scope: TeacherScope) -> list[TeacherSubjectOption]:
        if not scope.subject_ids:
            return []
        rows = (
            await db.execute(
                select(
                    Subject.id,
                    Subject.code,
                    Subject.name,
                    Subject.subject_type,
                    Subject.class_id,
                    SchoolClass.name,
                    TeacherSubject.role_in_subject,
                )
                .join(SchoolClass, SchoolClass.id == Subject.class_id)
                .join(
                    TeacherSubject,
                    and_(
                        TeacherSubject.subject_id == Subject.id,
                        TeacherSubject.teacher_id == scope.teacher_id,
                    ),
                )
                .where(
                    Subject.tenant_id == scope.tenant_id,
                    Subject.id.in_(scope.subject_ids),
                    SchoolClass.tenant_id == scope.tenant_id,
                )
                .order_by(SchoolClass.name, Subject.code)
            )
        ).all()
        return [
            TeacherSubjectOption(
                id=subject_id,
                code=code,
                name=name,
                class_id=class_id,
                class_name=class_name,
                subject_type=subject_type,
                role_in_subject=role,
            )
            for subject_id, code, name, subject_type, class_id, class_name, role in rows
        ]

    @staticmethod
    async def _class_options(db: AsyncSession, scope: TeacherScope) -> list[TeacherClassOption]:
        if not scope.class_ids:
            return []
        strength = (
            select(Enrollment.class_id, func.count(Enrollment.id).label("student_count"))
            .where(
                Enrollment.tenant_id == scope.tenant_id,
                Enrollment.status == "ACTIVE",
                Enrollment.class_id.in_(scope.class_ids),
            )
            .group_by(Enrollment.class_id)
            .subquery()
        )
        rows = (
            await db.execute(
                select(
                    SchoolClass.id,
                    SchoolClass.name,
                    SchoolClass.code,
                    SchoolClass.department_id,
                    Department.name,
                    func.coalesce(strength.c.student_count, 0),
                )
                .outerjoin(
                    Department,
                    and_(
                        Department.id == SchoolClass.department_id,
                        Department.tenant_id == scope.tenant_id,
                    ),
                )
                .outerjoin(strength, strength.c.class_id == SchoolClass.id)
                .where(
                    SchoolClass.tenant_id == scope.tenant_id,
                    SchoolClass.id.in_(scope.class_ids),
                )
                .order_by(SchoolClass.name)
            )
        ).all()
        return [
            TeacherClassOption(
                id=class_id,
                name=name,
                code=code,
                department_id=department_id,
                department_name=department_name,
                student_count=int(student_count or 0),
                is_class_teacher=class_id in scope.owned_class_ids,
            )
            for class_id, name, code, department_id, department_name, student_count in rows
        ]

    @staticmethod
    async def _roster(
        db: AsyncSession,
        scope: TeacherScope,
        class_id: uuid.UUID,
        *,
        subject_id: uuid.UUID | None = None,
    ) -> list[TeacherRosterStudent]:
        """The ACTIVE roster of a class, with each learner's running percentage.

        The percentage is computed for the given subject when one is supplied,
        so a marking sheet warns about *this* subject's attendance rather than
        an institution-wide average that hides a specific problem.
        """
        rows = (
            await db.execute(
                select(User.id, User.name, Enrollment.roll_number)
                .join(Enrollment, Enrollment.student_id == User.id)
                .where(
                    Enrollment.tenant_id == scope.tenant_id,
                    Enrollment.class_id == class_id,
                    Enrollment.status == "ACTIVE",
                    User.tenant_id == scope.tenant_id,
                    User.deleted_at.is_(None),
                )
                .order_by(Enrollment.roll_number, User.name)
            )
        ).all()
        if not rows:
            return []

        student_ids = [student_id for student_id, _name, _roll in rows]
        clauses = [
            AttendanceRecord.tenant_id == scope.tenant_id,
            AttendanceRecord.student_id.in_(student_ids),
            AttendanceSession.class_id == class_id,
        ]
        if subject_id is not None:
            clauses.append(AttendanceSession.subject_id == subject_id)

        present_case = case(
            (
                AttendanceRecord.status.in_(
                    (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED)
                ),
                1,
            ),
            else_=0,
        )
        stats = (
            await db.execute(
                select(
                    AttendanceRecord.student_id,
                    func.count(AttendanceRecord.id),
                    func.sum(present_case),
                )
                .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
                .where(*clauses)
                .group_by(AttendanceRecord.student_id)
            )
        ).all()
        by_student = {
            student_id: _pct(int(present or 0), int(total or 0))
            for student_id, total, present in stats
        }

        return [
            TeacherRosterStudent(
                student_id=student_id,
                name=name,
                roll_number=roll,
                overall_percentage=by_student.get(student_id),
            )
            for student_id, name, roll in rows
        ]

    # ── C-TC-01 dashboard ───────────────────────────────────────────────────

    @staticmethod
    async def dashboard(db: AsyncSession, teacher: User) -> TeacherDashboard:
        scope = await TeacherService.scope_for_user(db, teacher)
        today = await PrincipalService._tenant_today(db, teacher.tenant_id)
        subjects = await TeacherService._subject_options(db, scope)
        classes = await TeacherService._class_options(db, scope)

        today_classes = await TeacherService._today_classes(db, scope, today)
        student_count = sum(option.student_count for option in classes)

        pending_reviews = await TeacherService._pending_review_rows(db, scope)
        pending_submission_count = sum(row.pending_count for row in pending_reviews)

        pending_leave_count = 0
        if scope.owned_class_ids:
            pending_leave_count = int(
                (
                    await db.execute(
                        select(func.count(AttendanceLeave.id)).where(
                            AttendanceLeave.tenant_id == scope.tenant_id,
                            AttendanceLeave.class_id.in_(scope.owned_class_ids),
                            AttendanceLeave.status == LeaveStatus.PENDING,
                        )
                    )
                ).scalar()
                or 0
            )

        now = datetime.now(timezone.utc)
        horizon = now + timedelta(days=UPCOMING_EXAM_DAYS)
        exam_rows = (
            await db.execute(
                select(Exam, SchoolClass.name, Subject.code)
                .join(SchoolClass, SchoolClass.id == Exam.class_id)
                .join(Subject, Subject.id == Exam.subject_id)
                .where(
                    Exam.tenant_id == scope.tenant_id,
                    Exam.subject_id.in_(scope.subject_ids or {uuid.uuid4()}),
                    Exam.scheduled_at >= now,
                    Exam.scheduled_at <= horizon,
                    Exam.status != ExamStatus.CANCELLED,
                )
                .order_by(Exam.scheduled_at)
                .limit(10)
            )
        ).all()

        notices = await TeacherService._notice_rows(db, scope, limit=5, offset=0)

        unmarked = sum(
            1
            for item in today_classes
            if not item.attendance_marked
            and item.subject_id is not None
            and item.slot_type == "CLASS"
            and item.substituted_to_name is None
        )

        return TeacherDashboard(
            academic_year=scope.academic_year_name,
            subject_count=len(subjects),
            class_count=len(classes),
            student_count=student_count,
            today=today,
            today_classes=today_classes,
            unmarked_session_count=unmarked,
            pending_submission_count=pending_submission_count,
            pending_leave_count=pending_leave_count,
            upcoming_exam_count=len(exam_rows),
            upcoming_exams=[
                TeacherUpcomingExam(
                    id=exam.id,
                    title=exam.title,
                    class_name=class_name,
                    subject_code=subject_code,
                    scheduled_at=exam.scheduled_at,
                    status=_value(exam.status) or "DRAFT",
                    mode=exam.mode,
                )
                for exam, class_name, subject_code in exam_rows
            ],
            pending_reviews=pending_reviews[:5],
            recent_notices=notices,
            subjects=subjects,
            classes=classes,
        )

    @staticmethod
    async def _today_classes(
        db: AsyncSession, scope: TeacherScope, today: date
    ) -> list[TeacherTodayClass]:
        """Today's periods for this teacher, including substitutions both ways.

        A slot the coordinator handed to someone else still appears, flagged,
        because a teacher who walks into a room that is no longer theirs is a
        worse failure than a slightly busier list.
        """
        weekday = today.isoweekday() % 7  # DB stores 0=Sunday … 6=Saturday
        rows = (
            await db.execute(
                select(
                    TimetableSlot,
                    SchoolClass.name,
                    Subject.code,
                    Subject.name,
                )
                .join(SchoolClass, SchoolClass.id == TimetableSlot.class_id)
                .outerjoin(
                    Subject,
                    and_(
                        Subject.id == TimetableSlot.subject_id,
                        Subject.tenant_id == scope.tenant_id,
                    ),
                )
                .where(
                    TimetableSlot.tenant_id == scope.tenant_id,
                    TimetableSlot.teacher_id == scope.teacher_id,
                    TimetableSlot.day_of_week == weekday,
                    TimetableSlot.effective_from <= today,
                    or_(
                        TimetableSlot.effective_to.is_(None),
                        TimetableSlot.effective_to >= today,
                    ),
                    SchoolClass.tenant_id == scope.tenant_id,
                )
                .order_by(TimetableSlot.period_number)
            )
        ).all()
        if not rows:
            return []

        slot_ids = [slot.id for slot, *_ in rows]
        substitutions = {
            slot_id: name
            for slot_id, name in (
                await db.execute(
                    select(TimetableSubstitution.slot_id, User.name)
                    .outerjoin(User, User.id == TimetableSubstitution.substitute_teacher_id)
                    .where(
                        TimetableSubstitution.tenant_id == scope.tenant_id,
                        TimetableSubstitution.slot_id.in_(slot_ids),
                        TimetableSubstitution.date == today,
                        TimetableSubstitution.original_teacher_id == scope.teacher_id,
                    )
                )
            ).all()
        }

        marked = {
            (class_id, subject_id)
            for class_id, subject_id in (
                await db.execute(
                    select(AttendanceSession.class_id, AttendanceSession.subject_id).where(
                        AttendanceSession.tenant_id == scope.tenant_id,
                        AttendanceSession.teacher_id == scope.teacher_id,
                        AttendanceSession.date == today,
                    )
                )
            ).all()
        }

        return [
            TeacherTodayClass(
                slot_id=slot.id,
                class_id=slot.class_id,
                class_name=class_name,
                subject_id=slot.subject_id,
                subject_code=subject_code,
                subject_name=subject_name,
                period_number=slot.period_number,
                start_time=slot.start_time,
                end_time=slot.end_time,
                room_no=slot.room_no,
                slot_type=slot.slot_type,
                attendance_marked=(slot.class_id, slot.subject_id) in marked,
                substituted_to_name=substitutions.get(slot.id),
            )
            for slot, class_name, subject_code, subject_name in rows
        ]

    @staticmethod
    async def _pending_review_rows(
        db: AsyncSession, scope: TeacherScope
    ) -> list[TeacherPendingReview]:
        rows = (
            await db.execute(
                select(
                    Assignment.id,
                    Assignment.title,
                    Assignment.due_date,
                    SchoolClass.name,
                    Subject.code,
                    func.count(Submission.id),
                )
                .join(SchoolClass, SchoolClass.id == Assignment.class_id)
                .join(Subject, Subject.id == Assignment.subject_id)
                .join(
                    Submission,
                    and_(
                        Submission.assignment_id == Assignment.id,
                        Submission.status.in_(_PENDING_REVIEW),
                    ),
                )
                .where(
                    Assignment.tenant_id == scope.tenant_id,
                    Assignment.teacher_id == scope.teacher_id,
                )
                .group_by(
                    Assignment.id,
                    Assignment.title,
                    Assignment.due_date,
                    SchoolClass.name,
                    Subject.code,
                )
                .order_by(Assignment.due_date)
            )
        ).all()
        return [
            TeacherPendingReview(
                assignment_id=assignment_id,
                assignment_title=title,
                class_name=class_name,
                subject_code=subject_code,
                due_date=due_date,
                pending_count=int(pending or 0),
            )
            for assignment_id, title, due_date, class_name, subject_code, pending in rows
        ]

    # ── C-TC-02 schedule ────────────────────────────────────────────────────

    @staticmethod
    async def schedule(db: AsyncSession, teacher: User) -> TeacherSchedule:
        scope = await TeacherService.scope_for_user(db, teacher)
        today = await PrincipalService._tenant_today(db, teacher.tenant_id)
        rows = (
            await db.execute(
                select(TimetableSlot, SchoolClass.name, Subject.code, Subject.name)
                .join(SchoolClass, SchoolClass.id == TimetableSlot.class_id)
                .outerjoin(
                    Subject,
                    and_(
                        Subject.id == TimetableSlot.subject_id,
                        Subject.tenant_id == scope.tenant_id,
                    ),
                )
                .where(
                    TimetableSlot.tenant_id == scope.tenant_id,
                    TimetableSlot.teacher_id == scope.teacher_id,
                    TimetableSlot.effective_from <= today,
                    or_(
                        TimetableSlot.effective_to.is_(None),
                        TimetableSlot.effective_to >= today,
                    ),
                )
                .order_by(TimetableSlot.day_of_week, TimetableSlot.period_number)
            )
        ).all()
        return TeacherSchedule(
            academic_year=scope.academic_year_name,
            slots=[
                TeacherScheduleSlot(
                    id=slot.id,
                    class_id=slot.class_id,
                    class_name=class_name,
                    subject_id=slot.subject_id,
                    subject_code=subject_code,
                    subject_name=subject_name,
                    day_of_week=slot.day_of_week,
                    period_number=slot.period_number,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    room_no=slot.room_no,
                    slot_type=slot.slot_type,
                )
                for slot, class_name, subject_code, subject_name in rows
            ],
        )

    # ── C-TC-03 mark attendance ─────────────────────────────────────────────

    @staticmethod
    async def mark_context(
        db: AsyncSession,
        teacher: User,
        *,
        subject_id: uuid.UUID | None = None,
        class_id: uuid.UUID | None = None,
        on_date: date | None = None,
    ) -> TeacherMarkContext:
        scope = await TeacherService.scope_for_user(db, teacher)
        today = await PrincipalService._tenant_today(db, teacher.tenant_id)
        target_date = on_date or today
        if target_date > today:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attendance cannot be marked for a future date",
            )

        context = TeacherMarkContext(
            date=target_date,
            subjects=await TeacherService._subject_options(db, scope),
            classes=await TeacherService._class_options(db, scope),
        )
        if subject_id is None or class_id is None:
            return context

        subject = await TeacherService._ensure_subject(db, scope, subject_id)
        if subject.class_id != class_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        scope.require_class(class_id)

        roster = await TeacherService._roster(db, scope, class_id, subject_id=subject_id)

        session = (
            await db.execute(
                select(AttendanceSession).where(
                    AttendanceSession.tenant_id == scope.tenant_id,
                    AttendanceSession.subject_id == subject_id,
                    AttendanceSession.class_id == class_id,
                    AttendanceSession.date == target_date,
                )
            )
        ).scalars().first()

        if session is not None:
            existing = {
                record.student_id: record
                for record in (
                    await db.execute(
                        select(AttendanceRecord).where(
                            AttendanceRecord.tenant_id == scope.tenant_id,
                            AttendanceRecord.session_id == session.id,
                        )
                    )
                )
                .scalars()
                .all()
            }
            for student in roster:
                record = existing.get(student.student_id)
                if record is not None:
                    student.status = _value(record.status) or "PRESENT"
                    student.late_by_minutes = record.late_by_minutes
                    student.remarks = record.remarks
            context.existing_session_id = session.id
            context.is_locked = session.is_locked
            context.period_label = session.period_label

        context.roster = roster
        return context

    @staticmethod
    async def create_session(
        db: AsyncSession, teacher: User, payload: TeacherSessionCreate
    ) -> TeacherSessionDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        subject = await TeacherService._ensure_subject(db, scope, payload.subject_id)
        if subject.class_id != payload.class_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        scope.require_class(payload.class_id)

        today = await PrincipalService._tenant_today(db, teacher.tenant_id)
        if payload.date > today:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attendance cannot be marked for a future date",
            )

        year_id = scope.academic_year_id
        if year_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="No current academic year is set for this institution",
            )

        roster = {
            student.student_id
            for student in await TeacherService._roster(db, scope, payload.class_id)
        }
        submitted = {record.student_id for record in payload.records}
        # A record for someone who is not on the roster would create an
        # attendance row for a student in another class.
        if not submitted <= roster:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="One or more students are not enrolled in this class",
            )

        counts = TeacherService._count_statuses(payload.records)
        session = AttendanceSession(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            subject_id=payload.subject_id,
            class_id=payload.class_id,
            teacher_id=scope.teacher_id,
            academic_year_id=year_id,
            date=payload.date,
            period_label=payload.period_label.strip(),
            start_time=payload.start_time,
            end_time=payload.end_time,
            total_present=counts["present"],
            total_absent=counts["absent"],
            notes=payload.notes,
            is_locked=False,
        )
        db.add(session)
        for record in payload.records:
            db.add(
                AttendanceRecord(
                    id=uuid.uuid4(),
                    tenant_id=scope.tenant_id,
                    session_id=session.id,
                    student_id=record.student_id,
                    status=AttendanceStatus(record.status),
                    late_by_minutes=record.late_by_minutes,
                    remarks=record.remarks,
                    updated_by=scope.teacher_id,
                )
            )

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="ATTENDANCE_SESSION_CREATED",
            entity="attendance_sessions",
            entity_id=session.id,
            tenant_id=scope.tenant_id,
            new_value={
                "class_id": str(payload.class_id),
                "subject_id": str(payload.subject_id),
                "date": payload.date.isoformat(),
                "period": session.period_label,
                "marked": len(payload.records),
            },
        )

        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            # The (tenant, subject, class, date, period) unique key is what
            # stops a double-submit from creating two conflicting registers.
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Attendance for this class, subject, date and period is already recorded",
            ) from exc

        await db.commit()
        return await TeacherService.session_detail(db, teacher, session.id, scope=scope)

    @staticmethod
    async def update_session(
        db: AsyncSession,
        teacher: User,
        session_id: uuid.UUID,
        payload: TeacherSessionUpdate,
    ) -> TeacherSessionDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        session = await TeacherService._ensure_session(db, scope, session_id)
        if session.is_locked:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="This session is locked; ask your HOD to reopen it",
            )

        existing = {
            record.student_id: record
            for record in (
                await db.execute(
                    select(AttendanceRecord).where(
                        AttendanceRecord.tenant_id == scope.tenant_id,
                        AttendanceRecord.session_id == session.id,
                    )
                )
            )
            .scalars()
            .all()
        }
        roster = {
            student.student_id
            for student in await TeacherService._roster(db, scope, session.class_id)
        }
        for record in payload.records:
            if record.student_id not in roster:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="One or more students are not enrolled in this class",
                )
            row = existing.get(record.student_id)
            if row is None:
                db.add(
                    AttendanceRecord(
                        id=uuid.uuid4(),
                        tenant_id=scope.tenant_id,
                        session_id=session.id,
                        student_id=record.student_id,
                        status=AttendanceStatus(record.status),
                        late_by_minutes=record.late_by_minutes,
                        remarks=record.remarks,
                        updated_by=scope.teacher_id,
                    )
                )
            else:
                row.status = AttendanceStatus(record.status)
                row.late_by_minutes = record.late_by_minutes
                row.remarks = record.remarks
                row.updated_by = scope.teacher_id

        # Recount from the full register, not just the edited rows, so the
        # totals on the session stay in step with its records.
        await db.flush()
        totals = (
            await db.execute(
                select(
                    func.count(AttendanceRecord.id),
                    func.sum(
                        case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0)
                    ),
                ).where(
                    AttendanceRecord.tenant_id == scope.tenant_id,
                    AttendanceRecord.session_id == session.id,
                )
            )
        ).one()
        total_marked, total_absent = int(totals[0] or 0), int(totals[1] or 0)
        session.total_absent = total_absent
        session.total_present = total_marked - total_absent
        if payload.notes is not None:
            session.notes = payload.notes

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="ATTENDANCE_SESSION_UPDATED",
            entity="attendance_sessions",
            entity_id=session.id,
            tenant_id=scope.tenant_id,
            new_value={"updated": len(payload.records)},
        )
        await db.commit()
        return await TeacherService.session_detail(db, teacher, session.id, scope=scope)

    @staticmethod
    async def lock_session(
        db: AsyncSession, teacher: User, session_id: uuid.UUID
    ) -> TeacherSessionDetail:
        """Freeze a register. Locking is one-way for a teacher by design."""
        scope = await TeacherService.scope_for_user(db, teacher)
        session = await TeacherService._ensure_session(db, scope, session_id)
        if session.is_locked:
            return await TeacherService.session_detail(db, teacher, session_id, scope=scope)
        session.is_locked = True
        session.locked_at = datetime.now(timezone.utc)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="ATTENDANCE_SESSION_LOCKED",
            entity="attendance_sessions",
            entity_id=session.id,
            tenant_id=scope.tenant_id,
        )
        await db.commit()
        return await TeacherService.session_detail(db, teacher, session_id, scope=scope)

    @staticmethod
    async def sessions(
        db: AsyncSession,
        teacher: User,
        *,
        class_id: uuid.UUID | None = None,
        subject_id: uuid.UUID | None = None,
        from_date: date | None = None,
        to_date: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherSessionPage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            AttendanceSession.tenant_id == scope.tenant_id,
            AttendanceSession.teacher_id == scope.teacher_id,
        ]
        if class_id is not None:
            clauses.append(AttendanceSession.class_id == scope.require_class(class_id))
        if subject_id is not None:
            clauses.append(AttendanceSession.subject_id == scope.require_subject(subject_id))
        if from_date is not None:
            clauses.append(AttendanceSession.date >= from_date)
        if to_date is not None:
            clauses.append(AttendanceSession.date <= to_date)
        if from_date and to_date and from_date > to_date:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="from_date must be on or before to_date",
            )

        total = int(
            (await db.execute(select(func.count(AttendanceSession.id)).where(*clauses))).scalar() or 0
        )
        rows = (
            await db.execute(
                select(AttendanceSession, SchoolClass.name, Subject.code, Subject.name)
                .join(SchoolClass, SchoolClass.id == AttendanceSession.class_id)
                .join(Subject, Subject.id == AttendanceSession.subject_id)
                .where(*clauses)
                .order_by(AttendanceSession.date.desc(), AttendanceSession.period_label)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return TeacherSessionPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[
                TeacherService._session_row(session, class_name, subject_code, subject_name)
                for session, class_name, subject_code, subject_name in rows
            ],
        )

    @staticmethod
    async def session_detail(
        db: AsyncSession,
        teacher: User,
        session_id: uuid.UUID,
        *,
        scope: TeacherScope | None = None,
    ) -> TeacherSessionDetail:
        scope = scope or await TeacherService.scope_for_user(db, teacher)
        session = await TeacherService._ensure_session(db, scope, session_id)
        labels = (
            await db.execute(
                select(SchoolClass.name, Subject.code, Subject.name)
                .select_from(AttendanceSession)
                .join(SchoolClass, SchoolClass.id == AttendanceSession.class_id)
                .join(Subject, Subject.id == AttendanceSession.subject_id)
                .where(AttendanceSession.id == session.id)
            )
        ).one()
        rows = (
            await db.execute(
                select(
                    AttendanceRecord,
                    User.name,
                    Enrollment.roll_number,
                )
                .join(User, User.id == AttendanceRecord.student_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == AttendanceRecord.student_id,
                        Enrollment.class_id == session.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .where(
                    AttendanceRecord.tenant_id == scope.tenant_id,
                    AttendanceRecord.session_id == session.id,
                )
                .order_by(Enrollment.roll_number, User.name)
            )
        ).all()

        base = TeacherService._session_row(session, labels[0], labels[1], labels[2])
        return TeacherSessionDetail(
            **base.model_dump(),
            notes=session.notes,
            records=[
                TeacherRosterStudent(
                    student_id=record.student_id,
                    name=name,
                    roll_number=roll,
                    status=_value(record.status) or "PRESENT",
                    late_by_minutes=record.late_by_minutes,
                    remarks=record.remarks,
                )
                for record, name, roll in rows
            ],
        )

    @staticmethod
    def _session_row(
        session: AttendanceSession, class_name: str, subject_code: str, subject_name: str
    ) -> TeacherSessionRow:
        marked = session.total_present + session.total_absent
        return TeacherSessionRow(
            id=session.id,
            class_id=session.class_id,
            class_name=class_name,
            subject_id=session.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            date=session.date,
            period_label=session.period_label,
            start_time=session.start_time,
            end_time=session.end_time,
            total_present=session.total_present,
            total_absent=session.total_absent,
            total_marked=marked,
            attendance_percentage=_pct(session.total_present, marked),
            is_locked=session.is_locked,
            locked_at=session.locked_at,
            created_at=session.created_at,
        )

    @staticmethod
    def _count_statuses(records: Sequence) -> dict[str, int]:
        absent = sum(1 for record in records if record.status == "ABSENT")
        return {"present": len(records) - absent, "absent": absent}

    # ── C-TC-06 student leave ───────────────────────────────────────────────

    @staticmethod
    async def leaves(
        db: AsyncSession,
        teacher: User,
        *,
        status_filter: str | None = None,
        class_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherLeavePage:
        """Leave applications for the classes this teacher owns.

        Reviewing leave is a class-teacher duty, not a subject one: a subject
        teacher sees a learner for one period and has no standing to excuse
        them from the rest of the timetable.
        """
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        if not scope.owned_class_ids:
            return TeacherLeavePage(total=0, limit=limit, offset=offset, pending_count=0, items=[])

        clauses = [
            AttendanceLeave.tenant_id == scope.tenant_id,
            AttendanceLeave.class_id.in_(scope.owned_class_ids),
        ]
        if status_filter:
            normalised = status_filter.strip().upper()
            if normalised not in {item.value for item in LeaveStatus}:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown leave status"
                )
            clauses.append(AttendanceLeave.status == LeaveStatus(normalised))
        if class_id is not None:
            if class_id not in scope.owned_class_ids:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Class not found")
            clauses.append(AttendanceLeave.class_id == class_id)

        total = int(
            (await db.execute(select(func.count(AttendanceLeave.id)).where(*clauses))).scalar() or 0
        )
        pending = int(
            (
                await db.execute(
                    select(func.count(AttendanceLeave.id)).where(
                        AttendanceLeave.tenant_id == scope.tenant_id,
                        AttendanceLeave.class_id.in_(scope.owned_class_ids),
                        AttendanceLeave.status == LeaveStatus.PENDING,
                    )
                )
            ).scalar()
            or 0
        )
        reviewer = User.__table__.alias("reviewer")
        rows = (
            await db.execute(
                select(
                    AttendanceLeave,
                    User.name,
                    Enrollment.roll_number,
                    SchoolClass.name,
                    reviewer.c.name,
                )
                .join(User, User.id == AttendanceLeave.student_id)
                .join(SchoolClass, SchoolClass.id == AttendanceLeave.class_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == AttendanceLeave.student_id,
                        Enrollment.class_id == AttendanceLeave.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .outerjoin(reviewer, reviewer.c.id == AttendanceLeave.reviewed_by)
                .where(*clauses)
                .order_by(
                    case((AttendanceLeave.status == LeaveStatus.PENDING, 0), else_=1),
                    AttendanceLeave.from_date.desc(),
                )
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return TeacherLeavePage(
            total=total,
            limit=limit,
            offset=offset,
            pending_count=pending,
            items=[
                TeacherService._leave_row(leave, name, roll, class_name, reviewer_name)
                for leave, name, roll, class_name, reviewer_name in rows
            ],
        )

    @staticmethod
    async def decide_leave(
        db: AsyncSession,
        teacher: User,
        leave_id: uuid.UUID,
        payload: TeacherLeaveDecision,
    ) -> TeacherLeaveRow:
        scope = await TeacherService.scope_for_user(db, teacher)
        leave = (
            await db.execute(
                select(AttendanceLeave).where(
                    AttendanceLeave.id == leave_id,
                    AttendanceLeave.tenant_id == scope.tenant_id,
                )
            )
        ).scalar_one_or_none()
        if leave is None or leave.class_id not in scope.owned_class_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Leave request not found")
        if leave.status != LeaveStatus.PENDING:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"This request was already {_value(leave.status).lower()}",
            )

        leave.status = (
            LeaveStatus.APPROVED if payload.action == "APPROVE" else LeaveStatus.REJECTED
        )
        leave.reviewed_by = scope.teacher_id
        leave.reviewed_at = datetime.now(timezone.utc)

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action=f"STUDENT_LEAVE_{payload.action}D",
            entity="attendance_leaves",
            entity_id=leave.id,
            tenant_id=scope.tenant_id,
            new_value={"status": leave.status.value, "note": payload.note},
        )
        await db.commit()

        row = (
            await db.execute(
                select(User.name, Enrollment.roll_number, SchoolClass.name)
                .select_from(AttendanceLeave)
                .join(User, User.id == AttendanceLeave.student_id)
                .join(SchoolClass, SchoolClass.id == AttendanceLeave.class_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == AttendanceLeave.student_id,
                        Enrollment.class_id == AttendanceLeave.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .where(AttendanceLeave.id == leave.id)
            )
        ).one()
        return TeacherService._leave_row(leave, row[0], row[1], row[2], teacher.name)

    @staticmethod
    def _leave_row(
        leave: AttendanceLeave,
        student_name: str,
        roll: str | None,
        class_name: str,
        reviewer_name: str | None,
    ) -> TeacherLeaveRow:
        return TeacherLeaveRow(
            id=leave.id,
            student_id=leave.student_id,
            student_name=student_name,
            roll_number=roll,
            class_id=leave.class_id,
            class_name=class_name,
            from_date=leave.from_date,
            to_date=leave.to_date,
            total_days=(leave.to_date - leave.from_date).days + 1,
            reason=leave.reason,
            document_url=leave.document_url,
            status=_value(leave.status) or "PENDING",
            reviewed_by_name=reviewer_name,
            reviewed_at=leave.reviewed_at,
            created_at=leave.created_at,
        )

    # ── Scoped entity loaders ───────────────────────────────────────────────

    @staticmethod
    async def _ensure_subject(
        db: AsyncSession, scope: TeacherScope, subject_id: uuid.UUID
    ) -> Subject:
        scope.require_subject(subject_id)
        subject = (
            await db.execute(
                select(Subject).where(
                    Subject.id == subject_id, Subject.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one_or_none()
        if subject is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return subject

    @staticmethod
    async def _ensure_session(
        db: AsyncSession, scope: TeacherScope, session_id: uuid.UUID
    ) -> AttendanceSession:
        session = (
            await db.execute(
                select(AttendanceSession).where(
                    AttendanceSession.id == session_id,
                    AttendanceSession.tenant_id == scope.tenant_id,
                    AttendanceSession.teacher_id == scope.teacher_id,
                )
            )
        ).scalar_one_or_none()
        if session is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attendance session not found")
        return session

    @staticmethod
    async def _ensure_exam(db: AsyncSession, scope: TeacherScope, exam_id: uuid.UUID) -> Exam:
        exam = (
            await db.execute(
                select(Exam).where(Exam.id == exam_id, Exam.tenant_id == scope.tenant_id)
            )
        ).scalar_one_or_none()
        # The subject fence, not the creator, is the boundary: a co-teacher on
        # the same subject must be able to grade when a colleague is away.
        if exam is None or exam.subject_id not in scope.subject_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Exam not found")
        return exam

    @staticmethod
    async def _ensure_assignment(
        db: AsyncSession, scope: TeacherScope, assignment_id: uuid.UUID
    ) -> Assignment:
        assignment = (
            await db.execute(
                select(Assignment).where(
                    Assignment.id == assignment_id, Assignment.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one_or_none()
        if assignment is None or assignment.subject_id not in scope.subject_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment not found")
        return assignment

    # ── C-TC-07 … C-TC-09 exams ─────────────────────────────────────────────

    @staticmethod
    async def exams(
        db: AsyncSession,
        teacher: User,
        *,
        status_filter: str | None = None,
        subject_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherExamPage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            Exam.tenant_id == scope.tenant_id,
            Exam.subject_id.in_(scope.subject_ids or {uuid.uuid4()}),
        ]
        if status_filter:
            normalised = status_filter.strip().upper()
            if normalised not in {item.value for item in ExamStatus}:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown exam status"
                )
            clauses.append(Exam.status == ExamStatus(normalised))
        if subject_id is not None:
            clauses.append(Exam.subject_id == scope.require_subject(subject_id))

        total = int((await db.execute(select(func.count(Exam.id)).where(*clauses))).scalar() or 0)
        rows = (
            await db.execute(
                select(Exam, SchoolClass.name, Subject.code, Subject.name)
                .join(SchoolClass, SchoolClass.id == Exam.class_id)
                .join(Subject, Subject.id == Exam.subject_id)
                .where(*clauses)
                .order_by(Exam.scheduled_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        exams = [exam for exam, *_ in rows]
        stats = await TeacherService._exam_stats(db, scope, [exam.id for exam in exams])
        return TeacherExamPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[
                TeacherService._exam_row(exam, class_name, code, name, stats.get(exam.id, {}))
                for exam, class_name, code, name in rows
            ],
        )

    @staticmethod
    async def _exam_stats(
        db: AsyncSession, scope: TeacherScope, exam_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, dict[str, float]]:
        if not exam_ids:
            return {}
        question_rows = (
            await db.execute(
                select(Question.exam_id, func.count(Question.id), func.coalesce(func.sum(Question.marks), 0))
                .where(Question.exam_id.in_(exam_ids))
                .group_by(Question.exam_id)
            )
        ).all()
        attempt_rows = (
            await db.execute(
                select(
                    ExamAttempt.exam_id,
                    func.count(ExamAttempt.id),
                    func.sum(case((ExamAttempt.submitted_at.isnot(None), 1), else_=0)),
                    func.sum(case((ExamAttempt.status == AttemptStatus.GRADED, 1), else_=0)),
                )
                .where(
                    ExamAttempt.tenant_id == scope.tenant_id,
                    ExamAttempt.exam_id.in_(exam_ids),
                )
                .group_by(ExamAttempt.exam_id)
            )
        ).all()
        ungraded_rows = (
            await db.execute(
                select(ExamAttempt.exam_id, func.count(func.distinct(ExamAttempt.id)))
                .join(Answer, Answer.attempt_id == ExamAttempt.id)
                .where(
                    ExamAttempt.tenant_id == scope.tenant_id,
                    ExamAttempt.exam_id.in_(exam_ids),
                    ExamAttempt.submitted_at.isnot(None),
                    Answer.score.is_(None),
                )
                .group_by(ExamAttempt.exam_id)
            )
        ).all()

        stats: dict[uuid.UUID, dict[str, float]] = defaultdict(dict)
        for exam_id, count, marks in question_rows:
            stats[exam_id]["question_count"] = int(count or 0)
            stats[exam_id]["total_question_marks"] = float(marks or 0)
        for exam_id, attempts, submitted, graded in attempt_rows:
            stats[exam_id]["attempt_count"] = int(attempts or 0)
            stats[exam_id]["submitted_count"] = int(submitted or 0)
            stats[exam_id]["graded_count"] = int(graded or 0)
        for exam_id, pending in ungraded_rows:
            stats[exam_id]["pending_grading_count"] = int(pending or 0)
        return stats

    @staticmethod
    def _exam_row(
        exam: Exam,
        class_name: str,
        subject_code: str,
        subject_name: str,
        stats: dict[str, float],
    ) -> TeacherExamRow:
        return TeacherExamRow(
            id=exam.id,
            title=exam.title,
            class_id=exam.class_id,
            class_name=class_name,
            subject_id=exam.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            exam_type=exam.exam_type,
            mode=exam.mode,
            total_marks=exam.total_marks,
            passing_marks=exam.passing_marks,
            duration_minutes=exam.duration_minutes,
            scheduled_at=exam.scheduled_at,
            window_end_at=exam.window_end_at,
            status=_value(exam.status) or "DRAFT",
            schedule_approval_status=exam.schedule_approval_status or "PENDING",
            allow_review=exam.allow_review,
            shuffle_questions=exam.shuffle_questions,
            show_score_immediately=exam.show_score_immediately,
            instructions=exam.instructions,
            question_count=int(stats.get("question_count", 0)),
            total_question_marks=float(stats.get("total_question_marks", 0)),
            attempt_count=int(stats.get("attempt_count", 0)),
            submitted_count=int(stats.get("submitted_count", 0)),
            graded_count=int(stats.get("graded_count", 0)),
            pending_grading_count=int(stats.get("pending_grading_count", 0)),
        )

    @staticmethod
    async def create_exam(
        db: AsyncSession, teacher: User, payload: TeacherExamCreate
    ) -> TeacherExamRow:
        scope = await TeacherService.scope_for_user(db, teacher)
        subject = await TeacherService._ensure_subject(db, scope, payload.subject_id)
        if scope.academic_year_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="No current academic year is set for this institution",
            )

        exam = Exam(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            subject_id=subject.id,
            class_id=subject.class_id,
            academic_year_id=scope.academic_year_id,
            exam_type=payload.exam_type,
            mode=payload.mode,
            total_marks=payload.total_marks,
            passing_marks=payload.passing_marks,
            duration_minutes=payload.duration_minutes,
            instructions=payload.instructions,
            scheduled_at=payload.scheduled_at,
            window_end_at=payload.window_end_at,
            status=ExamStatus.DRAFT,
            allow_review=payload.allow_review,
            shuffle_questions=payload.shuffle_questions,
            show_score_immediately=payload.show_score_immediately,
            created_by=scope.teacher_id,
            # A teacher creates the paper; the Principal approves the slot
            # (C-PR-03). Starting anywhere but PENDING would let a teacher
            # self-approve their own schedule.
            schedule_approval_status="PENDING",
        )
        db.add(exam)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="EXAM_CREATED",
            entity="exams",
            entity_id=exam.id,
            tenant_id=scope.tenant_id,
            new_value={"title": exam.title, "subject_id": str(subject.id)},
        )
        await db.commit()
        return await TeacherService.exam_detail(db, teacher, exam.id, scope=scope)

    @staticmethod
    async def update_exam(
        db: AsyncSession, teacher: User, exam_id: uuid.UUID, payload: TeacherExamUpdate
    ) -> TeacherExamRow:
        scope = await TeacherService.scope_for_user(db, teacher)
        exam = await TeacherService._ensure_exam(db, scope, exam_id)
        if exam.status not in _EDITABLE_EXAM_STATUSES:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"A {_value(exam.status).lower().replace('_', ' ')} exam can no longer be edited",
            )

        data = payload.model_dump(exclude_unset=True)
        new_status = data.pop("status", None)
        for field, value in data.items():
            setattr(exam, field, value.strip() if isinstance(value, str) else value)

        if exam.passing_marks > exam.total_marks:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="passing_marks cannot exceed total_marks",
            )
        if exam.window_end_at and exam.window_end_at <= exam.scheduled_at:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="window_end_at must be after scheduled_at",
            )

        if new_status is not None:
            await TeacherService._apply_exam_status(db, scope, exam, new_status)

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="EXAM_UPDATED",
            entity="exams",
            entity_id=exam.id,
            tenant_id=scope.tenant_id,
            new_value={**data, **({"status": new_status} if new_status else {})},
        )
        await db.commit()
        return await TeacherService.exam_detail(db, teacher, exam.id, scope=scope)

    @staticmethod
    async def _apply_exam_status(
        db: AsyncSession, scope: TeacherScope, exam: Exam, new_status: str
    ) -> None:
        """Guard the two transitions a teacher may make, and only those."""
        if new_status == "PUBLISHED":
            if exam.schedule_approval_status != "APPROVED":
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="The Principal has not approved this exam schedule yet",
                )
            marks = (
                await db.execute(
                    select(func.coalesce(func.sum(Question.marks), 0)).where(
                        Question.exam_id == exam.id
                    )
                )
            ).scalar() or 0
            if exam.mode == "ONLINE" and float(marks) <= 0:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="Add at least one question before publishing an online exam",
                )
            if exam.mode == "ONLINE" and float(marks) != float(exam.total_marks):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=(
                        f"Question marks total {float(marks):g} but the exam is out of "
                        f"{exam.total_marks}"
                    ),
                )
        elif new_status == "CANCELLED":
            attempts = (
                await db.execute(
                    select(func.count(ExamAttempt.id)).where(
                        ExamAttempt.tenant_id == scope.tenant_id, ExamAttempt.exam_id == exam.id
                    )
                )
            ).scalar() or 0
            if attempts:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="Students have already attempted this exam; ask the Exam Controller",
                )
        elif new_status == "DRAFT" and exam.status is ExamStatus.PUBLISHED:
            attempts = (
                await db.execute(
                    select(func.count(ExamAttempt.id)).where(
                        ExamAttempt.tenant_id == scope.tenant_id, ExamAttempt.exam_id == exam.id
                    )
                )
            ).scalar() or 0
            if attempts:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="This exam has attempts and cannot return to draft",
                )
        exam.status = ExamStatus(new_status)

    @staticmethod
    async def exam_detail(
        db: AsyncSession,
        teacher: User,
        exam_id: uuid.UUID,
        *,
        scope: TeacherScope | None = None,
    ) -> TeacherExamRow:
        scope = scope or await TeacherService.scope_for_user(db, teacher)
        exam = await TeacherService._ensure_exam(db, scope, exam_id)
        labels = (
            await db.execute(
                select(SchoolClass.name, Subject.code, Subject.name)
                .select_from(Exam)
                .join(SchoolClass, SchoolClass.id == Exam.class_id)
                .join(Subject, Subject.id == Exam.subject_id)
                .where(Exam.id == exam.id)
            )
        ).one()
        stats = await TeacherService._exam_stats(db, scope, [exam.id])
        return TeacherService._exam_row(exam, labels[0], labels[1], labels[2], stats.get(exam.id, {}))

    # ── C-TC-10 questions ───────────────────────────────────────────────────

    @staticmethod
    async def exam_paper(
        db: AsyncSession, teacher: User, exam_id: uuid.UUID
    ) -> TeacherExamPaper:
        scope = await TeacherService.scope_for_user(db, teacher)
        exam_row = await TeacherService.exam_detail(db, teacher, exam_id, scope=scope)
        questions = (
            await db.execute(
                select(Question)
                .where(Question.exam_id == exam_id)
                .order_by(Question.sort_order, Question.id)
            )
        ).scalars().all()
        options_by_question: dict[uuid.UUID, list[TeacherQuestionOption]] = defaultdict(list)
        if questions:
            option_rows = (
                await db.execute(
                    select(QuestionOption)
                    .where(QuestionOption.question_id.in_([q.id for q in questions]))
                    .order_by(QuestionOption.sort_order, QuestionOption.id)
                )
            ).scalars().all()
            for option in option_rows:
                options_by_question[option.question_id].append(
                    TeacherQuestionOption(
                        id=option.id,
                        text=option.text,
                        is_correct=option.is_correct,
                        sort_order=option.sort_order,
                    )
                )
        return TeacherExamPaper(
            exam=exam_row,
            questions=[
                TeacherQuestionRow(
                    id=question.id,
                    text=question.text,
                    question_type=_value(question.question_type) or "MCQ",
                    marks=float(question.marks),
                    negative_marks=float(question.negative_marks),
                    explanation=question.explanation,
                    difficulty=question.difficulty,
                    sort_order=question.sort_order,
                    options=options_by_question.get(question.id, []),
                )
                for question in questions
            ],
        )

    @staticmethod
    async def add_question(
        db: AsyncSession, teacher: User, exam_id: uuid.UUID, payload: TeacherQuestionCreate
    ) -> TeacherExamPaper:
        scope = await TeacherService.scope_for_user(db, teacher)
        exam = await TeacherService._ensure_exam(db, scope, exam_id)
        if exam.status not in _EDITABLE_EXAM_STATUSES:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This exam's paper is closed for editing"
            )
        attempts = (
            await db.execute(
                select(func.count(ExamAttempt.id)).where(
                    ExamAttempt.tenant_id == scope.tenant_id, ExamAttempt.exam_id == exam.id
                )
            )
        ).scalar() or 0
        if attempts:
            # Adding a question mid-exam silently rescales everyone already
            # sitting it.
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Students have started this exam; the paper can no longer change",
            )

        question = Question(
            id=uuid.uuid4(),
            exam_id=exam.id,
            text=payload.text.strip(),
            question_type=QuestionType(payload.question_type),
            marks=Decimal(str(payload.marks)),
            negative_marks=Decimal(str(payload.negative_marks)),
            explanation=payload.explanation,
            difficulty=payload.difficulty,
            sort_order=payload.sort_order,
        )
        db.add(question)
        for index, option in enumerate(payload.options):
            db.add(
                QuestionOption(
                    id=uuid.uuid4(),
                    question_id=question.id,
                    text=option.text.strip(),
                    is_correct=option.is_correct,
                    sort_order=option.sort_order or index,
                )
            )
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="EXAM_QUESTION_ADDED",
            entity="questions",
            entity_id=question.id,
            tenant_id=scope.tenant_id,
            new_value={"exam_id": str(exam.id), "type": payload.question_type},
        )
        await db.commit()
        return await TeacherService.exam_paper(db, teacher, exam_id)

    @staticmethod
    async def delete_question(
        db: AsyncSession, teacher: User, exam_id: uuid.UUID, question_id: uuid.UUID
    ) -> TeacherExamPaper:
        scope = await TeacherService.scope_for_user(db, teacher)
        exam = await TeacherService._ensure_exam(db, scope, exam_id)
        question = (
            await db.execute(
                select(Question).where(Question.id == question_id, Question.exam_id == exam.id)
            )
        ).scalar_one_or_none()
        if question is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Question not found")
        answered = (
            await db.execute(
                select(func.count(Answer.id)).where(Answer.question_id == question.id)
            )
        ).scalar() or 0
        if answered:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="This question has been answered and cannot be removed",
            )
        await db.delete(question)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="EXAM_QUESTION_REMOVED",
            entity="questions",
            entity_id=question.id,
            tenant_id=scope.tenant_id,
            old_value={"exam_id": str(exam.id)},
        )
        await db.commit()
        return await TeacherService.exam_paper(db, teacher, exam_id)

    # ── C-TC-11 exam results / grading ──────────────────────────────────────

    @staticmethod
    async def exam_results(
        db: AsyncSession, teacher: User, exam_id: uuid.UUID
    ) -> TeacherExamResults:
        scope = await TeacherService.scope_for_user(db, teacher)
        exam = await TeacherService._ensure_exam(db, scope, exam_id)
        exam_row = await TeacherService.exam_detail(db, teacher, exam_id, scope=scope)

        ungraded = {
            attempt_id: int(count or 0)
            for attempt_id, count in (
                await db.execute(
                    select(Answer.attempt_id, func.count(Answer.id))
                    .join(ExamAttempt, ExamAttempt.id == Answer.attempt_id)
                    .where(
                        ExamAttempt.tenant_id == scope.tenant_id,
                        ExamAttempt.exam_id == exam.id,
                        Answer.score.is_(None),
                    )
                    .group_by(Answer.attempt_id)
                )
            ).all()
        }
        rows = (
            await db.execute(
                select(ExamAttempt, User.name, Enrollment.roll_number)
                .join(User, User.id == ExamAttempt.student_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == ExamAttempt.student_id,
                        Enrollment.class_id == exam.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .where(
                    ExamAttempt.tenant_id == scope.tenant_id, ExamAttempt.exam_id == exam.id
                )
                .order_by(Enrollment.roll_number, User.name)
            )
        ).all()

        attempts = [
            TeacherAttemptRow(
                id=attempt.id,
                student_id=attempt.student_id,
                student_name=name,
                roll_number=roll,
                started_at=attempt.started_at,
                submitted_at=attempt.submitted_at,
                auto_submitted=attempt.auto_submitted,
                total_score=_decimal(attempt.total_score),
                percentage=_decimal(attempt.percentage),
                grade=attempt.grade,
                status=_value(attempt.status) or "IN_PROGRESS",
                tab_switch_count=attempt.tab_switch_count,
                ungraded_count=ungraded.get(attempt.id, 0),
            )
            for attempt, name, roll in rows
        ]

        attempted_ids = {attempt.student_id for attempt in attempts}
        roster = await TeacherService._roster(db, scope, exam.class_id)
        scored = [attempt.percentage for attempt in attempts if attempt.percentage is not None]
        pass_mark = _pct(exam.passing_marks, exam.total_marks) or 0

        return TeacherExamResults(
            exam=exam_row,
            attempts=attempts,
            not_attempted=[s for s in roster if s.student_id not in attempted_ids],
            average_percentage=round(sum(scored) / len(scored), 2) if scored else None,
            pass_count=sum(1 for value in scored if value >= pass_mark),
            fail_count=sum(1 for value in scored if value < pass_mark),
        )

    @staticmethod
    async def attempt_detail(
        db: AsyncSession, teacher: User, attempt_id: uuid.UUID
    ) -> TeacherAttemptDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        attempt = (
            await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.id == attempt_id, ExamAttempt.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one_or_none()
        if attempt is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        exam_row = await TeacherService.exam_detail(db, teacher, attempt.exam_id, scope=scope)

        student = (
            await db.execute(
                select(User.name, Enrollment.roll_number)
                .select_from(User)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == User.id,
                        Enrollment.class_id == exam_row.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .where(User.id == attempt.student_id)
            )
        ).first()

        answer_rows = (
            await db.execute(
                select(Answer, Question, QuestionOption.text)
                .join(Question, Question.id == Answer.question_id)
                .outerjoin(QuestionOption, QuestionOption.id == Answer.selected_option_id)
                .where(Answer.attempt_id == attempt.id)
                .order_by(Question.sort_order, Question.id)
            )
        ).all()

        answers = [
            TeacherAnswerRow(
                id=answer.id,
                question_id=question.id,
                question_text=question.text,
                question_type=_value(question.question_type) or "MCQ",
                question_marks=float(question.marks),
                selected_option_id=answer.selected_option_id,
                selected_option_text=option_text,
                text_answer=answer.text_answer,
                score=_decimal(answer.score),
                is_auto_graded=answer.is_auto_graded,
                feedback=answer.feedback,
                needs_grading=answer.score is None,
            )
            for answer, question, option_text in answer_rows
        ]
        ungraded = sum(1 for answer in answers if answer.needs_grading)

        return TeacherAttemptDetail(
            attempt=TeacherAttemptRow(
                id=attempt.id,
                student_id=attempt.student_id,
                student_name=student[0] if student else "Unknown",
                roll_number=student[1] if student else None,
                started_at=attempt.started_at,
                submitted_at=attempt.submitted_at,
                auto_submitted=attempt.auto_submitted,
                total_score=_decimal(attempt.total_score),
                percentage=_decimal(attempt.percentage),
                grade=attempt.grade,
                status=_value(attempt.status) or "IN_PROGRESS",
                tab_switch_count=attempt.tab_switch_count,
                ungraded_count=ungraded,
            ),
            exam=exam_row,
            answers=answers,
        )

    @staticmethod
    async def grade_attempt(
        db: AsyncSession, teacher: User, attempt_id: uuid.UUID, payload: TeacherGradeRequest
    ) -> TeacherAttemptDetail:
        """Score descriptive answers, then recompute the attempt total.

        The total is always re-derived from the answers rather than accepted
        from the client, so a mis-sent payload cannot invent a score that the
        per-question marks do not support.
        """
        scope = await TeacherService.scope_for_user(db, teacher)
        attempt = (
            await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.id == attempt_id, ExamAttempt.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one_or_none()
        if attempt is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        exam = await TeacherService._ensure_exam(db, scope, attempt.exam_id)
        if attempt.submitted_at is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This attempt has not been submitted yet"
            )

        answers = {
            answer.id: (answer, question)
            for answer, question in (
                await db.execute(
                    select(Answer, Question)
                    .join(Question, Question.id == Answer.question_id)
                    .where(Answer.attempt_id == attempt.id)
                )
            ).all()
        }
        now = datetime.now(timezone.utc)
        for grade in payload.grades:
            entry = answers.get(grade.answer_id)
            if entry is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Answer not found")
            answer, question = entry
            if grade.score > float(question.marks):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Score cannot exceed the question's {float(question.marks):g} marks",
                )
            answer.score = Decimal(str(grade.score))
            answer.feedback = grade.feedback
            answer.graded_by = scope.teacher_id
            answer.graded_at = now

        await db.flush()
        total = (
            await db.execute(
                select(
                    func.coalesce(func.sum(Answer.score), 0),
                    func.sum(case((Answer.score.is_(None), 1), else_=0)),
                ).where(Answer.attempt_id == attempt.id)
            )
        ).one()
        awarded, remaining = float(total[0] or 0), int(total[1] or 0)
        attempt.total_score = Decimal(str(round(awarded, 2)))
        percentage = _pct(0, 0)
        if exam.total_marks:
            percentage = round(awarded * 100 / exam.total_marks, 2)
            attempt.percentage = Decimal(str(percentage))
            attempt.grade = _grade_for(percentage)
        if remaining == 0:
            attempt.status = AttemptStatus.GRADED

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="EXAM_ATTEMPT_GRADED",
            entity="exam_attempts",
            entity_id=attempt.id,
            tenant_id=scope.tenant_id,
            new_value={"score": awarded, "remaining_ungraded": remaining},
        )
        await db.commit()
        return await TeacherService.attempt_detail(db, teacher, attempt_id)

    # ── C-TC-12 … C-TC-14 assignments ───────────────────────────────────────

    @staticmethod
    async def assignments(
        db: AsyncSession,
        teacher: User,
        *,
        status_filter: str | None = None,
        subject_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherAssignmentPage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            Assignment.tenant_id == scope.tenant_id,
            Assignment.teacher_id == scope.teacher_id,
        ]
        if status_filter:
            normalised = status_filter.strip().upper()
            if normalised not in {item.value for item in AssignmentStatus}:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown assignment status"
                )
            clauses.append(Assignment.status == AssignmentStatus(normalised))
        if subject_id is not None:
            clauses.append(Assignment.subject_id == scope.require_subject(subject_id))

        total = int(
            (await db.execute(select(func.count(Assignment.id)).where(*clauses))).scalar() or 0
        )
        rows = (
            await db.execute(
                select(Assignment, SchoolClass.name, Subject.code, Subject.name)
                .join(SchoolClass, SchoolClass.id == Assignment.class_id)
                .join(Subject, Subject.id == Assignment.subject_id)
                .where(*clauses)
                .order_by(Assignment.due_date.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()

        assignments = [row[0] for row in rows]
        stats = await TeacherService._assignment_stats(db, scope, [a.id for a in assignments])
        strengths = await TeacherService._class_strengths(
            db, scope, {a.class_id for a in assignments}
        )
        now = datetime.now(timezone.utc)
        items = [
            TeacherService._assignment_row(
                assignment,
                class_name,
                code,
                name,
                stats.get(assignment.id, {}),
                strengths.get(assignment.class_id, 0),
                now,
            )
            for assignment, class_name, code, name in rows
        ]

        # Counters describe the whole board, not just the current page — a
        # teacher on page 2 still needs to know how much is outstanding.
        totals = (
            await db.execute(
                select(
                    func.sum(case((Assignment.status == AssignmentStatus.PUBLISHED, 1), else_=0)),
                    func.sum(
                        case(
                            (
                                and_(
                                    Assignment.status == AssignmentStatus.PUBLISHED,
                                    Assignment.due_date < now,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                ).where(
                    Assignment.tenant_id == scope.tenant_id,
                    Assignment.teacher_id == scope.teacher_id,
                )
            )
        ).one()
        pending_total = int(
            (
                await db.execute(
                    select(func.count(Submission.id))
                    .join(Assignment, Assignment.id == Submission.assignment_id)
                    .where(
                        Assignment.tenant_id == scope.tenant_id,
                        Assignment.teacher_id == scope.teacher_id,
                        Submission.status.in_(_PENDING_REVIEW),
                    )
                )
            ).scalar()
            or 0
        )

        return TeacherAssignmentPage(
            total=total,
            limit=limit,
            offset=offset,
            active_count=int(totals[0] or 0),
            overdue_count=int(totals[1] or 0),
            pending_review_count=pending_total,
            items=items,
        )

    @staticmethod
    async def _class_strengths(
        db: AsyncSession, scope: TeacherScope, class_ids: set[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not class_ids:
            return {}
        rows = (
            await db.execute(
                select(Enrollment.class_id, func.count(Enrollment.id))
                .where(
                    Enrollment.tenant_id == scope.tenant_id,
                    Enrollment.class_id.in_(class_ids),
                    Enrollment.status == "ACTIVE",
                )
                .group_by(Enrollment.class_id)
            )
        ).all()
        return {class_id: int(count or 0) for class_id, count in rows}

    @staticmethod
    async def _assignment_stats(
        db: AsyncSession, scope: TeacherScope, assignment_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, dict[str, int]]:
        if not assignment_ids:
            return {}
        rows = (
            await db.execute(
                select(
                    Submission.assignment_id,
                    func.count(func.distinct(Submission.student_id)),
                    func.sum(case((Submission.status.in_(_PENDING_REVIEW), 1), else_=0)),
                    func.sum(case((Submission.status == SubmissionStatus.APPROVED, 1), else_=0)),
                )
                .where(
                    Submission.tenant_id == scope.tenant_id,
                    Submission.assignment_id.in_(assignment_ids),
                )
                .group_by(Submission.assignment_id)
            )
        ).all()
        return {
            assignment_id: {
                "submission_count": int(submissions or 0),
                "pending_review_count": int(pending or 0),
                "approved_count": int(approved or 0),
            }
            for assignment_id, submissions, pending, approved in rows
        }

    @staticmethod
    def _assignment_row(
        assignment: Assignment,
        class_name: str,
        subject_code: str,
        subject_name: str,
        stats: dict[str, int],
        class_strength: int,
        now: datetime,
    ) -> TeacherAssignmentRow:
        return TeacherAssignmentRow(
            id=assignment.id,
            title=assignment.title,
            description=assignment.description,
            class_id=assignment.class_id,
            class_name=class_name,
            subject_id=assignment.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            assignment_type=assignment.assignment_type,
            total_marks=assignment.total_marks,
            passing_marks=assignment.passing_marks,
            due_date=assignment.due_date,
            status=_value(assignment.status) or "DRAFT",
            allow_late_submission=assignment.allow_late_submission,
            late_penalty_percent=assignment.late_penalty_percent,
            is_overdue=assignment.status == AssignmentStatus.PUBLISHED
            and assignment.due_date < now,
            class_strength=class_strength,
            submission_count=stats.get("submission_count", 0),
            pending_review_count=stats.get("pending_review_count", 0),
            approved_count=stats.get("approved_count", 0),
            created_at=assignment.created_at,
        )

    @staticmethod
    async def create_assignment(
        db: AsyncSession, teacher: User, payload: TeacherAssignmentCreate
    ) -> TeacherAssignmentDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        subject = await TeacherService._ensure_subject(db, scope, payload.subject_id)
        if scope.academic_year_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="No current academic year is set for this institution",
            )

        assignment = Assignment(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            description=payload.description.strip(),
            subject_id=subject.id,
            class_id=subject.class_id,
            academic_year_id=scope.academic_year_id,
            teacher_id=scope.teacher_id,
            assignment_type=payload.assignment_type,
            total_marks=payload.total_marks,
            passing_marks=payload.passing_marks,
            due_date=payload.due_date,
            allow_late_submission=payload.allow_late_submission,
            late_penalty_percent=payload.late_penalty_percent,
            max_file_size_mb=payload.max_file_size_mb,
            allowed_file_types=payload.allowed_file_types,
            status=AssignmentStatus.PUBLISHED if payload.publish else AssignmentStatus.DRAFT,
        )
        db.add(assignment)
        for index, milestone in enumerate(payload.milestones):
            db.add(
                Milestone(
                    id=uuid.uuid4(),
                    assignment_id=assignment.id,
                    title=milestone.title.strip(),
                    description=milestone.description,
                    sort_order=index + 1,
                    marks=milestone.marks,
                    due_date=milestone.due_date,
                )
            )
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="ASSIGNMENT_CREATED",
            entity="assignments",
            entity_id=assignment.id,
            tenant_id=scope.tenant_id,
            new_value={"title": assignment.title, "status": assignment.status.value},
        )
        await db.commit()
        return await TeacherService.assignment_detail(db, teacher, assignment.id, scope=scope)

    @staticmethod
    async def update_assignment(
        db: AsyncSession,
        teacher: User,
        assignment_id: uuid.UUID,
        payload: TeacherAssignmentUpdate,
    ) -> TeacherAssignmentDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        assignment = await TeacherService._ensure_assignment(db, scope, assignment_id)
        if assignment.teacher_id != scope.teacher_id:
            # Reading a colleague's assignment is fine (same subject); editing
            # it is not.
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="Only the author can edit this assignment"
            )

        data = payload.model_dump(exclude_unset=True)
        new_status = data.pop("status", None)
        for field, value in data.items():
            setattr(assignment, field, value.strip() if isinstance(value, str) else value)
        if assignment.passing_marks > assignment.total_marks:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="passing_marks cannot exceed total_marks",
            )
        if new_status is not None:
            if new_status == "DRAFT" and assignment.status != AssignmentStatus.DRAFT:
                submitted = (
                    await db.execute(
                        select(func.count(Submission.id)).where(
                            Submission.tenant_id == scope.tenant_id,
                            Submission.assignment_id == assignment.id,
                        )
                    )
                ).scalar() or 0
                if submitted:
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        detail="Students have already submitted; this assignment cannot return to draft",
                    )
            assignment.status = AssignmentStatus(new_status)

        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="ASSIGNMENT_UPDATED",
            entity="assignments",
            entity_id=assignment.id,
            tenant_id=scope.tenant_id,
            new_value={**data, **({"status": new_status} if new_status else {})},
        )
        await db.commit()
        return await TeacherService.assignment_detail(db, teacher, assignment.id, scope=scope)

    @staticmethod
    async def assignment_detail(
        db: AsyncSession,
        teacher: User,
        assignment_id: uuid.UUID,
        *,
        scope: TeacherScope | None = None,
    ) -> TeacherAssignmentDetail:
        scope = scope or await TeacherService.scope_for_user(db, teacher)
        assignment = await TeacherService._ensure_assignment(db, scope, assignment_id)
        labels = (
            await db.execute(
                select(SchoolClass.name, Subject.code, Subject.name)
                .select_from(Assignment)
                .join(SchoolClass, SchoolClass.id == Assignment.class_id)
                .join(Subject, Subject.id == Assignment.subject_id)
                .where(Assignment.id == assignment.id)
            )
        ).one()
        stats = await TeacherService._assignment_stats(db, scope, [assignment.id])
        strengths = await TeacherService._class_strengths(db, scope, {assignment.class_id})
        base = TeacherService._assignment_row(
            assignment,
            labels[0],
            labels[1],
            labels[2],
            stats.get(assignment.id, {}),
            strengths.get(assignment.class_id, 0),
            datetime.now(timezone.utc),
        )

        milestones = (
            await db.execute(
                select(Milestone)
                .where(Milestone.assignment_id == assignment.id)
                .order_by(Milestone.sort_order)
            )
        ).scalars().all()
        milestone_stats: dict[uuid.UUID, tuple[int, int]] = {}
        if milestones:
            rows = (
                await db.execute(
                    select(
                        Submission.milestone_id,
                        func.count(func.distinct(Submission.student_id)),
                        func.sum(
                            case((Submission.status == SubmissionStatus.APPROVED, 1), else_=0)
                        ),
                    )
                    .where(
                        Submission.tenant_id == scope.tenant_id,
                        Submission.assignment_id == assignment.id,
                        Submission.milestone_id.isnot(None),
                    )
                    .group_by(Submission.milestone_id)
                )
            ).all()
            milestone_stats = {
                milestone_id: (int(submitted or 0), int(approved or 0))
                for milestone_id, submitted, approved in rows
            }

        return TeacherAssignmentDetail(
            **base.model_dump(),
            max_file_size_mb=assignment.max_file_size_mb,
            allowed_file_types=list(assignment.allowed_file_types or []),
            milestones=[
                TeacherMilestoneRow(
                    id=milestone.id,
                    title=milestone.title,
                    description=milestone.description,
                    marks=milestone.marks,
                    due_date=milestone.due_date,
                    sort_order=milestone.sort_order,
                    submitted_count=milestone_stats.get(milestone.id, (0, 0))[0],
                    approved_count=milestone_stats.get(milestone.id, (0, 0))[1],
                )
                for milestone in milestones
            ],
        )

    # ── C-TC-15 / C-TC-16 submissions ───────────────────────────────────────

    @staticmethod
    async def submissions(
        db: AsyncSession, teacher: User, assignment_id: uuid.UUID
    ) -> TeacherSubmissionBoard:
        scope = await TeacherService.scope_for_user(db, teacher)
        assignment = await TeacherService._ensure_assignment(db, scope, assignment_id)
        detail = await TeacherService.assignment_detail(db, teacher, assignment_id, scope=scope)
        rows = await TeacherService._submission_rows(
            db, scope, Submission.assignment_id == assignment.id
        )
        submitted_ids = {row.student_id for row in rows}
        roster = await TeacherService._roster(db, scope, assignment.class_id)
        return TeacherSubmissionBoard(
            assignment=detail,
            submissions=rows,
            not_submitted=[s for s in roster if s.student_id not in submitted_ids],
        )

    @staticmethod
    async def _submission_rows(
        db: AsyncSession, scope: TeacherScope, *clauses
    ) -> list[TeacherSubmissionRow]:
        reviewer = User.__table__.alias("reviewer")
        file_counts = (
            select(SubmissionFile.submission_id, func.count(SubmissionFile.id).label("file_count"))
            .group_by(SubmissionFile.submission_id)
            .subquery()
        )
        rows = (
            await db.execute(
                select(
                    Submission,
                    Assignment.title,
                    Milestone.title,
                    User.name,
                    Enrollment.roll_number,
                    SchoolClass.name,
                    reviewer.c.name,
                    func.coalesce(file_counts.c.file_count, 0),
                )
                .join(Assignment, Assignment.id == Submission.assignment_id)
                .join(SchoolClass, SchoolClass.id == Assignment.class_id)
                .join(User, User.id == Submission.student_id)
                .outerjoin(Milestone, Milestone.id == Submission.milestone_id)
                .outerjoin(
                    Enrollment,
                    and_(
                        Enrollment.student_id == Submission.student_id,
                        Enrollment.class_id == Assignment.class_id,
                        Enrollment.status == "ACTIVE",
                    ),
                )
                .outerjoin(reviewer, reviewer.c.id == Submission.reviewed_by)
                .outerjoin(file_counts, file_counts.c.submission_id == Submission.id)
                .where(Submission.tenant_id == scope.tenant_id, *clauses)
                .order_by(Enrollment.roll_number, User.name, Submission.version.desc())
            )
        ).all()
        return [
            TeacherSubmissionRow(
                id=submission.id,
                assignment_id=submission.assignment_id,
                assignment_title=assignment_title,
                milestone_id=submission.milestone_id,
                milestone_title=milestone_title,
                student_id=submission.student_id,
                student_name=student_name,
                roll_number=roll,
                class_name=class_name,
                submitted_at=submission.submitted_at,
                is_late=submission.is_late,
                late_by_minutes=submission.late_by_minutes,
                score=_decimal(submission.score),
                grade=submission.grade,
                feedback=submission.feedback,
                status=_value(submission.status) or "SUBMITTED",
                version=submission.version,
                reviewed_at=submission.reviewed_at,
                reviewed_by_name=reviewer_name,
                file_count=int(file_count or 0),
            )
            for (
                submission,
                assignment_title,
                milestone_title,
                student_name,
                roll,
                class_name,
                reviewer_name,
                file_count,
            ) in rows
        ]

    @staticmethod
    async def submission_detail(
        db: AsyncSession, teacher: User, submission_id: uuid.UUID
    ) -> TeacherSubmissionDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        submission = await TeacherService._ensure_submission(db, scope, submission_id)
        assignment = await TeacherService._ensure_assignment(db, scope, submission.assignment_id)
        rows = await TeacherService._submission_rows(db, scope, Submission.id == submission.id)
        if not rows:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")

        files = (
            await db.execute(
                select(SubmissionFile)
                .where(SubmissionFile.submission_id == submission.id)
                .order_by(SubmissionFile.uploaded_at)
            )
        ).scalars().all()
        reviews = (
            await db.execute(
                select(SubmissionReview, User.name)
                .outerjoin(User, User.id == SubmissionReview.reviewer_id)
                .where(
                    SubmissionReview.tenant_id == scope.tenant_id,
                    SubmissionReview.submission_id == submission.id,
                )
                .order_by(SubmissionReview.attempt_number)
            )
        ).all()

        return TeacherSubmissionDetail(
            **rows[0].model_dump(),
            text_response=submission.text_response,
            total_marks=assignment.total_marks,
            files=[
                TeacherSubmissionFile(
                    id=item.id,
                    file_name=item.file_name,
                    file_key=item.file_key,
                    file_size_bytes=item.file_size_bytes,
                    mime_type=item.mime_type,
                    uploaded_at=item.uploaded_at,
                )
                for item in files
            ],
            reviews=[
                TeacherSubmissionReviewRow(
                    id=review.id,
                    reviewer_name=reviewer_name,
                    decision=_value(review.decision) or "APPROVED",
                    marks_awarded=_decimal(review.marks_awarded),
                    feedback=review.feedback,
                    attempt_number=review.attempt_number,
                    reviewed_at=review.reviewed_at,
                )
                for review, reviewer_name in reviews
            ],
        )

    @staticmethod
    async def review_submission(
        db: AsyncSession,
        teacher: User,
        submission_id: uuid.UUID,
        payload: TeacherSubmissionReview,
    ) -> TeacherSubmissionDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        submission = await TeacherService._ensure_submission(db, scope, submission_id)
        assignment = await TeacherService._ensure_assignment(db, scope, submission.assignment_id)

        ceiling = float(assignment.total_marks)
        if submission.milestone_id is not None:
            milestone_marks = (
                await db.execute(
                    select(Milestone.marks).where(Milestone.id == submission.milestone_id)
                )
            ).scalar_one_or_none()
            if milestone_marks is not None:
                ceiling = float(milestone_marks)
        if payload.score is not None and payload.score > ceiling:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Score cannot exceed {ceiling:g} marks",
            )

        attempt_number = int(
            (
                await db.execute(
                    select(func.count(SubmissionReview.id)).where(
                        SubmissionReview.tenant_id == scope.tenant_id,
                        SubmissionReview.submission_id == submission.id,
                    )
                )
            ).scalar()
            or 0
        ) + 1

        status_map = {
            "APPROVED": SubmissionStatus.APPROVED,
            "REJECTED": SubmissionStatus.REJECTED,
            "CHANGES_REQUESTED": SubmissionStatus.RESUBMIT_REQUESTED,
        }
        submission.status = status_map[payload.decision]
        submission.reviewed_by = scope.teacher_id
        submission.reviewed_at = datetime.now(timezone.utc)
        submission.feedback = payload.feedback
        if payload.score is not None:
            score = payload.score
            # A late submission is accepted but discounted by the policy the
            # teacher set on the assignment, rather than silently full-marked.
            if submission.is_late and assignment.late_penalty_percent:
                score = round(score * (100 - assignment.late_penalty_percent) / 100, 2)
            submission.score = Decimal(str(score))
            submission.grade = _grade_for(round(score * 100 / ceiling, 2) if ceiling else 0)

        db.add(
            SubmissionReview(
                id=uuid.uuid4(),
                tenant_id=scope.tenant_id,
                submission_id=submission.id,
                reviewer_id=scope.teacher_id,
                decision=ReviewDecision(payload.decision),
                marks_awarded=submission.score,
                feedback=payload.feedback,
                attempt_number=attempt_number,
            )
        )
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="SUBMISSION_REVIEWED",
            entity="submissions",
            entity_id=submission.id,
            tenant_id=scope.tenant_id,
            new_value={"decision": payload.decision, "score": _decimal(submission.score)},
        )
        await db.commit()
        return await TeacherService.submission_detail(db, teacher, submission_id)

    @staticmethod
    async def _ensure_submission(
        db: AsyncSession, scope: TeacherScope, submission_id: uuid.UUID
    ) -> Submission:
        submission = (
            await db.execute(
                select(Submission).where(
                    Submission.id == submission_id, Submission.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one_or_none()
        if submission is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Submission not found")
        return submission

    # ── C-TC-17 / C-TC-18 content ───────────────────────────────────────────

    @staticmethod
    async def content(
        db: AsyncSession,
        teacher: User,
        *,
        subject_id: uuid.UUID | None = None,
        chapter: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherContentPage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            ContentItem.tenant_id == scope.tenant_id,
            ContentItem.deleted_at.is_(None),
            ContentItem.subject_id.in_(scope.subject_ids or {uuid.uuid4()}),
        ]
        if subject_id is not None:
            clauses.append(ContentItem.subject_id == scope.require_subject(subject_id))
        if chapter:
            clauses.append(ContentItem.chapter == chapter.strip())

        total = int(
            (await db.execute(select(func.count(ContentItem.id)).where(*clauses))).scalar() or 0
        )
        chapters = [
            value
            for value in (
                await db.execute(
                    select(ContentItem.chapter)
                    .where(
                        ContentItem.tenant_id == scope.tenant_id,
                        ContentItem.deleted_at.is_(None),
                        ContentItem.subject_id.in_(scope.subject_ids or {uuid.uuid4()}),
                        ContentItem.chapter.isnot(None),
                    )
                    .distinct()
                    .order_by(ContentItem.chapter)
                )
            )
            .scalars()
            .all()
        ]
        rows = (
            await db.execute(
                select(ContentItem, Subject.code, Subject.name, SchoolClass.name)
                .join(Subject, Subject.id == ContentItem.subject_id)
                .join(SchoolClass, SchoolClass.id == ContentItem.class_id)
                .where(*clauses)
                .order_by(ContentItem.chapter, ContentItem.sort_order, ContentItem.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return TeacherContentPage(
            total=total,
            limit=limit,
            offset=offset,
            chapters=chapters,
            items=[
                TeacherService._content_row(item, code, name, class_name)
                for item, code, name, class_name in rows
            ],
        )

    @staticmethod
    def _content_row(
        item: ContentItem, subject_code: str, subject_name: str, class_name: str
    ) -> TeacherContentRow:
        return TeacherContentRow(
            id=item.id,
            title=item.title,
            description=item.description,
            subject_id=item.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            class_id=item.class_id,
            class_name=class_name,
            content_type=_value(item.content_type) or "PDF",
            file_key=item.file_key,
            external_url=item.external_url,
            file_size_bytes=item.file_size_bytes,
            duration_seconds=item.duration_seconds,
            chapter=item.chapter,
            sort_order=item.sort_order,
            is_visible=item.is_visible,
            view_count=item.view_count,
            download_count=item.download_count,
            created_at=item.created_at,
        )

    @staticmethod
    async def create_content(
        db: AsyncSession, teacher: User, payload: TeacherContentCreate
    ) -> TeacherContentRow:
        scope = await TeacherService.scope_for_user(db, teacher)
        subject = await TeacherService._ensure_subject(db, scope, payload.subject_id)
        item = ContentItem(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            description=payload.description,
            subject_id=subject.id,
            class_id=subject.class_id,
            uploaded_by=scope.teacher_id,
            content_type=ContentType(payload.content_type),
            file_key=payload.file_key,
            external_url=payload.external_url,
            file_size_bytes=payload.file_size_bytes,
            duration_seconds=payload.duration_seconds,
            chapter=(payload.chapter or "").strip() or None,
            sort_order=payload.sort_order,
            is_visible=payload.is_visible,
        )
        db.add(item)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="CONTENT_UPLOADED",
            entity="content_items",
            entity_id=item.id,
            tenant_id=scope.tenant_id,
            new_value={"title": item.title, "type": payload.content_type},
        )
        await db.commit()
        return TeacherService._content_row(
            item,
            subject.code,
            subject.name,
            (
                await db.execute(
                    select(SchoolClass.name).where(SchoolClass.id == subject.class_id)
                )
            ).scalar_one(),
        )

    @staticmethod
    async def update_content(
        db: AsyncSession, teacher: User, content_id: uuid.UUID, payload: TeacherContentUpdate
    ) -> TeacherContentRow:
        scope = await TeacherService.scope_for_user(db, teacher)
        item = await TeacherService._ensure_content(db, scope, content_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, field, value.strip() if isinstance(value, str) else value)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="CONTENT_UPDATED",
            entity="content_items",
            entity_id=item.id,
            tenant_id=scope.tenant_id,
        )
        await db.commit()
        labels = (
            await db.execute(
                select(Subject.code, Subject.name, SchoolClass.name)
                .select_from(ContentItem)
                .join(Subject, Subject.id == ContentItem.subject_id)
                .join(SchoolClass, SchoolClass.id == ContentItem.class_id)
                .where(ContentItem.id == item.id)
            )
        ).one()
        return TeacherService._content_row(item, labels[0], labels[1], labels[2])

    @staticmethod
    async def delete_content(
        db: AsyncSession, teacher: User, content_id: uuid.UUID
    ) -> None:
        """Soft delete — students who already opened it keep a valid access log."""
        scope = await TeacherService.scope_for_user(db, teacher)
        item = await TeacherService._ensure_content(db, scope, content_id)
        item.deleted_at = datetime.now(timezone.utc)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="CONTENT_DELETED",
            entity="content_items",
            entity_id=item.id,
            tenant_id=scope.tenant_id,
            old_value={"title": item.title},
        )
        await db.commit()

    @staticmethod
    async def _ensure_content(
        db: AsyncSession, scope: TeacherScope, content_id: uuid.UUID
    ) -> ContentItem:
        item = (
            await db.execute(
                select(ContentItem).where(
                    ContentItem.id == content_id,
                    ContentItem.tenant_id == scope.tenant_id,
                    ContentItem.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if item is None or item.subject_id not in scope.subject_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Content not found")
        if item.uploaded_by != scope.teacher_id:
            # §4.5: "Cannot edit other teachers' content."
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="Only the uploader can change this resource"
            )
        return item

    # ── C-TC-19 / C-TC-20 notices ───────────────────────────────────────────

    @staticmethod
    async def notices(
        db: AsyncSession, teacher: User, *, limit: int = 50, offset: int = 0
    ) -> TeacherNoticePage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = TeacherService._notice_clauses(scope)
        total = int((await db.execute(select(func.count(Notice.id)).where(*clauses))).scalar() or 0)
        items = await TeacherService._notice_rows(db, scope, limit=limit, offset=offset)
        return TeacherNoticePage(total=total, limit=limit, offset=offset, items=items)

    @staticmethod
    def _notice_clauses(scope: TeacherScope) -> list:
        now = datetime.now(timezone.utc)
        # Institution-wide notices, plus the department and class ones that
        # actually reach this teacher's rooms.
        department_ids = select(SchoolClass.department_id).where(
            SchoolClass.tenant_id == scope.tenant_id,
            SchoolClass.id.in_(scope.class_ids or {uuid.uuid4()}),
        )
        return [
            Notice.tenant_id == scope.tenant_id,
            Notice.deleted_at.is_(None),
            or_(Notice.expires_at.is_(None), Notice.expires_at > now),
            or_(
                Notice.target_scope == NoticeScope.INSTITUTION,
                and_(
                    Notice.target_scope == NoticeScope.DEPARTMENT,
                    Notice.target_id.in_(department_ids),
                ),
                and_(
                    Notice.target_scope == NoticeScope.CLASS,
                    Notice.target_id.in_(scope.class_ids or {uuid.uuid4()}),
                ),
            ),
        ]

    @staticmethod
    async def _notice_rows(
        db: AsyncSession, scope: TeacherScope, *, limit: int, offset: int
    ) -> list[TeacherNoticeRow]:
        rows = (
            await db.execute(
                select(Notice, User.name)
                .outerjoin(
                    User, and_(User.id == Notice.author_id, User.tenant_id == scope.tenant_id)
                )
                .where(*TeacherService._notice_clauses(scope))
                .order_by(Notice.is_pinned.desc(), Notice.published_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return [
            TeacherNoticeRow(
                id=notice.id,
                title=notice.title,
                body=notice.body,
                author_name=author_name,
                target_scope=_value(notice.target_scope) or "INSTITUTION",
                target_id=notice.target_id,
                priority=_value(notice.priority) or "NORMAL",
                is_pinned=notice.is_pinned,
                published_at=notice.published_at,
                expires_at=notice.expires_at,
            )
            for notice, author_name in rows
        ]

    @staticmethod
    async def create_notice(
        db: AsyncSession, teacher: User, payload: TeacherNoticeCreate
    ) -> TeacherNoticeRow:
        """§4.5 allows a teacher to post to their own classes — and only those."""
        scope = await TeacherService.scope_for_user(db, teacher)
        class_id = scope.require_class(payload.class_id)
        class_name = (
            await db.execute(
                select(SchoolClass.name).where(
                    SchoolClass.id == class_id, SchoolClass.tenant_id == scope.tenant_id
                )
            )
        ).scalar_one()

        notice = Notice(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            body=payload.body.strip(),
            author_id=scope.teacher_id,
            target_scope=NoticeScope.CLASS,
            target_id=class_id,
            priority=NoticePriority(payload.priority),
            # Pinning is a leadership affordance (see VicePrincipalService);
            # a teacher cannot pin a class notice above the Principal's.
            is_pinned=False,
            expires_at=payload.expires_at,
        )
        db.add(notice)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="NOTICE_CREATED",
            entity="notices",
            entity_id=notice.id,
            tenant_id=scope.tenant_id,
            new_value={"title": notice.title, "class_id": str(class_id)},
        )
        await db.commit()
        return TeacherNoticeRow(
            id=notice.id,
            title=notice.title,
            body=notice.body,
            author_name=teacher.name,
            target_scope="CLASS",
            target_id=class_id,
            target_name=class_name,
            priority=payload.priority,
            is_pinned=False,
            published_at=notice.published_at or datetime.now(timezone.utc),
            expires_at=notice.expires_at,
        )

    # ── C-TC-21 / C-TC-22 discussion ────────────────────────────────────────

    @staticmethod
    def _thread_scope_clause(scope: TeacherScope):
        return or_(
            and_(
                DiscussionThread.scope_type == "CLASS",
                DiscussionThread.scope_id.in_(scope.class_ids or {uuid.uuid4()}),
            ),
            and_(
                DiscussionThread.scope_type == "SUBJECT",
                DiscussionThread.scope_id.in_(scope.subject_ids or {uuid.uuid4()}),
            ),
        )

    @staticmethod
    async def threads(
        db: AsyncSession,
        teacher: User,
        *,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TeacherThreadPage:
        scope = await TeacherService.scope_for_user(db, teacher)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            DiscussionThread.tenant_id == scope.tenant_id,
            DiscussionThread.deleted_at.is_(None),
            TeacherService._thread_scope_clause(scope),
        ]
        if query and query.strip():
            needle = f"%{query.strip().lower()}%"
            clauses.append(
                or_(
                    func.lower(DiscussionThread.title).like(needle),
                    func.lower(DiscussionThread.body).like(needle),
                )
            )
        total = int(
            (await db.execute(select(func.count(DiscussionThread.id)).where(*clauses))).scalar() or 0
        )
        rows = (
            await db.execute(
                select(DiscussionThread, User.name)
                .outerjoin(User, User.id == DiscussionThread.author_id)
                .where(*clauses)
                .order_by(DiscussionThread.is_pinned.desc(), DiscussionThread.updated_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        names = await TeacherService._thread_scope_names(
            db, scope, [thread for thread, _ in rows]
        )
        return TeacherThreadPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[
                TeacherService._thread_row(thread, author, names.get(thread.scope_id))
                for thread, author in rows
            ],
        )

    @staticmethod
    async def _thread_scope_names(
        db: AsyncSession, scope: TeacherScope, threads: Sequence[DiscussionThread]
    ) -> dict[uuid.UUID, str]:
        class_ids = {t.scope_id for t in threads if t.scope_type == "CLASS"}
        subject_ids = {t.scope_id for t in threads if t.scope_type == "SUBJECT"}
        names: dict[uuid.UUID, str] = {}
        if class_ids:
            names.update(
                {
                    class_id: name
                    for class_id, name in (
                        await db.execute(
                            select(SchoolClass.id, SchoolClass.name).where(
                                SchoolClass.tenant_id == scope.tenant_id,
                                SchoolClass.id.in_(class_ids),
                            )
                        )
                    ).all()
                }
            )
        if subject_ids:
            names.update(
                {
                    subject_id: f"{code} · {name}"
                    for subject_id, code, name in (
                        await db.execute(
                            select(Subject.id, Subject.code, Subject.name).where(
                                Subject.tenant_id == scope.tenant_id,
                                Subject.id.in_(subject_ids),
                            )
                        )
                    ).all()
                }
            )
        return names

    @staticmethod
    def _thread_row(
        thread: DiscussionThread, author_name: str | None, scope_name: str | None
    ) -> TeacherThreadRow:
        return TeacherThreadRow(
            id=thread.id,
            title=thread.title,
            body=thread.body,
            author_id=thread.author_id,
            author_name=author_name,
            scope_type=thread.scope_type,
            scope_id=thread.scope_id,
            scope_name=scope_name,
            tags=list(thread.tags or []),
            is_pinned=thread.is_pinned,
            is_locked=thread.is_locked,
            is_resolved=thread.is_resolved,
            reply_count=thread.reply_count,
            upvote_count=thread.upvote_count,
            view_count=thread.view_count,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
        )

    @staticmethod
    async def thread_detail(
        db: AsyncSession, teacher: User, thread_id: uuid.UUID
    ) -> TeacherThreadDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        thread = await TeacherService._ensure_thread(db, scope, thread_id)
        author = (
            await db.execute(select(User.name).where(User.id == thread.author_id))
        ).scalar_one_or_none()
        names = await TeacherService._thread_scope_names(db, scope, [thread])
        replies = (
            await db.execute(
                select(DiscussionReply, User.name)
                .outerjoin(User, User.id == DiscussionReply.author_id)
                .where(
                    DiscussionReply.tenant_id == scope.tenant_id,
                    DiscussionReply.thread_id == thread.id,
                    DiscussionReply.deleted_at.is_(None),
                )
                .order_by(DiscussionReply.created_at)
            )
        ).all()
        base = TeacherService._thread_row(thread, author, names.get(thread.scope_id))
        return TeacherThreadDetail(
            **base.model_dump(),
            replies=[
                TeacherReplyRow(
                    id=reply.id,
                    author_id=reply.author_id,
                    author_name=reply_author,
                    body=reply.body,
                    is_accepted_answer=reply.is_accepted_answer,
                    upvote_count=reply.upvote_count,
                    created_at=reply.created_at,
                )
                for reply, reply_author in replies
            ],
        )

    @staticmethod
    async def create_thread(
        db: AsyncSession, teacher: User, payload: TeacherThreadCreate
    ) -> TeacherThreadDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        if payload.scope_type == "CLASS":
            scope.require_class(payload.scope_id)
        else:
            scope.require_subject(payload.scope_id)

        thread = DiscussionThread(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            body=payload.body.strip(),
            author_id=scope.teacher_id,
            scope_type=payload.scope_type,
            scope_id=payload.scope_id,
            tags=[tag.strip() for tag in payload.tags if tag.strip()] or None,
        )
        db.add(thread)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action="DISCUSSION_THREAD_CREATED",
            entity="discussion_threads",
            entity_id=thread.id,
            tenant_id=scope.tenant_id,
            new_value={"title": thread.title, "scope": payload.scope_type},
        )
        await db.commit()
        return await TeacherService.thread_detail(db, teacher, thread.id)

    @staticmethod
    async def reply_to_thread(
        db: AsyncSession, teacher: User, thread_id: uuid.UUID, payload: TeacherReplyCreate
    ) -> TeacherThreadDetail:
        scope = await TeacherService.scope_for_user(db, teacher)
        thread = await TeacherService._ensure_thread(db, scope, thread_id)
        if thread.is_locked:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This thread is locked")
        db.add(
            DiscussionReply(
                id=uuid.uuid4(),
                tenant_id=scope.tenant_id,
                thread_id=thread.id,
                author_id=scope.teacher_id,
                body=payload.body.strip(),
            )
        )
        thread.reply_count += 1
        await db.commit()
        return await TeacherService.thread_detail(db, teacher, thread_id)

    @staticmethod
    async def accept_answer(
        db: AsyncSession, teacher: User, thread_id: uuid.UUID, reply_id: uuid.UUID
    ) -> TeacherThreadDetail:
        """Mark one reply as the accepted answer; exactly one may hold the flag."""
        scope = await TeacherService.scope_for_user(db, teacher)
        thread = await TeacherService._ensure_thread(db, scope, thread_id)
        replies = (
            await db.execute(
                select(DiscussionReply).where(
                    DiscussionReply.tenant_id == scope.tenant_id,
                    DiscussionReply.thread_id == thread.id,
                    DiscussionReply.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        if reply_id not in {reply.id for reply in replies}:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reply not found")
        for reply in replies:
            reply.is_accepted_answer = reply.id == reply_id
        thread.is_resolved = True
        thread.resolved_by = scope.teacher_id
        await db.commit()
        return await TeacherService.thread_detail(db, teacher, thread_id)

    @staticmethod
    async def moderate_thread(
        db: AsyncSession,
        teacher: User,
        thread_id: uuid.UUID,
        payload: TeacherThreadModeration,
    ) -> TeacherThreadDetail:
        """§4.5 lets a teacher moderate *their own* threads, not a colleague's."""
        scope = await TeacherService.scope_for_user(db, teacher)
        thread = await TeacherService._ensure_thread(db, scope, thread_id)
        if thread.author_id != scope.teacher_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Only the thread author or an HOD can moderate this thread",
            )
        actions = {
            "PIN": ("is_pinned", True),
            "UNPIN": ("is_pinned", False),
            "LOCK": ("is_locked", True),
            "UNLOCK": ("is_locked", False),
            "RESOLVE": ("is_resolved", True),
            "REOPEN": ("is_resolved", False),
        }
        field, value = actions[payload.action]
        setattr(thread, field, value)
        AuditService.record(
            db,
            actor=teacher,
            actor_role="TEACHER",
            action=f"DISCUSSION_THREAD_{payload.action}",
            entity="discussion_threads",
            entity_id=thread.id,
            tenant_id=scope.tenant_id,
        )
        await db.commit()
        return await TeacherService.thread_detail(db, teacher, thread_id)

    @staticmethod
    async def _ensure_thread(
        db: AsyncSession, scope: TeacherScope, thread_id: uuid.UUID
    ) -> DiscussionThread:
        thread = (
            await db.execute(
                select(DiscussionThread).where(
                    DiscussionThread.id == thread_id,
                    DiscussionThread.tenant_id == scope.tenant_id,
                    DiscussionThread.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if thread is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Thread not found")
        in_scope = (thread.scope_type == "CLASS" and thread.scope_id in scope.class_ids) or (
            thread.scope_type == "SUBJECT" and thread.scope_id in scope.subject_ids
        )
        if not in_scope:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Thread not found")
        return thread
