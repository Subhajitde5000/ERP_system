"""Student console workflows (C-ST-01 … C-ST-20).

§4.9 gives a student **own data only**. Every method resolves the caller's
enrolment through ``StudentScopeService`` and filters on it; no endpoint takes
a student id, so there is no parameter to tamper with. Where an id *is* taken —
an exam, an assignment, a result — the row is loaded and then checked against
the caller's class, returning 404 when it belongs to someone else.

The exam engine lives here because it is the one place a student writes to a
graded table. Two rules make it safe:

* the deadline is computed server-side from ``exam_attempts.started_at``, so a
  frozen browser clock cannot buy extra time;
* objective questions are auto-scored on submit from ``question_options``,
  which the attempt screen never receives — the correct answer is not sent to
  the client that is being examined.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import AcademicYear, Department, SchoolClass, Subject
from app.models.billing import TenantSetting
from app.models.enrollment import Enrollment, TeacherSubject
from app.models.hod import (
    Assignment,
    AssignmentStatus,
    AttendanceRecord,
    DiscussionThread,
    MentorAssignment,
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
    NoticeRead,
    NoticeScope,
    ResultPublication,
    StudentResult,
    TimetableSlot,
)
from app.models.teaching import (
    Answer,
    AttendanceLeave,
    ContentItem,
    DiscussionReply,
    DiscussionVote,
    FeeInstallment,
    FeePayment,
    LeaveStatus,
    Milestone,
    Question,
    QuestionOption,
    QuestionType,
    StudentFeeAccount,
    SubmissionFile,
)
from app.models.user import User
from app.schemas.student import (
    StudentAnswerSave,
    StudentAssignmentDetail,
    StudentAssignmentPage,
    StudentAssignmentRow,
    StudentAttemptQuestion,
    StudentAttemptQuestionOption,
    StudentAttemptScreen,
    StudentAttemptSubmit,
    StudentAttendanceDay,
    StudentAttendanceOverview,
    StudentContentPage,
    StudentContentRow,
    StudentDashboard,
    StudentExamPage,
    StudentExamResult,
    StudentExamResultAnswer,
    StudentFeeAccountView,
    StudentInstallmentRow,
    StudentLeaveCreate,
    StudentLeavePage,
    StudentLeaveRow,
    StudentMilestoneRow,
    StudentNoticePage,
    StudentNoticeRow,
    StudentPaymentRow,
    StudentPendingAssignment,
    StudentProfile,
    StudentProfileUpdate,
    StudentReplyCreate,
    StudentReplyRow,
    StudentResultDetail,
    StudentResultList,
    StudentResultRow,
    StudentResultSubject,
    StudentSubjectAttendance,
    StudentSubjectOption,
    StudentSubmissionCreate,
    StudentSubmissionFile,
    StudentSubmissionRow,
    StudentTabSwitch,
    StudentThreadCreate,
    StudentThreadDetail,
    StudentThreadPage,
    StudentThreadRow,
    StudentTimetable,
    StudentTimetableSlot,
    StudentTodayClass,
    StudentUpcomingExam,
    StudentVote,
)
from app.services.principal_service import PrincipalService, _page_bounds, _value
from app.services.teacher_scope_service import StudentScope, StudentScopeService

__all__ = ["StudentService"]

#: Attendance below this is "short" unless the tenant overrides it. Matches the
#: HOD console's at-risk threshold so a learner and their mentor see the same
#: warning on the same day.
DEFAULT_ATTENDANCE_THRESHOLD = 75

#: How far ahead the dashboard lists exams and assignments.
UPCOMING_DAYS = 14

_PRESENT_STATUSES = (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED)
_AUTO_GRADED_TYPES = (QuestionType.MCQ, QuestionType.TRUE_FALSE)
_OPEN_SUBMISSION_STATUSES = (
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.UNDER_REVIEW,
    SubmissionStatus.APPROVED,
)


def _pct(numerator: int | float, denominator: int | float) -> float | None:
    return round(numerator * 100 / denominator, 2) if denominator else None


def _decimal(value: Decimal | float | int | None) -> float | None:
    return round(float(value), 2) if value is not None else None


def _grade_for(percentage: float) -> str:
    for floor, label in ((90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D"), (40, "E")):
        if percentage >= floor:
            return label
    return "F"


class StudentService:
    # ── Scope + shared helpers ──────────────────────────────────────────────

    @staticmethod
    async def scope_for_user(db: AsyncSession, student: User) -> StudentScope:
        return await StudentScopeService.resolve(db, student)

    @staticmethod
    async def _threshold(db: AsyncSession, tenant_id: uuid.UUID) -> int:
        value = (
            await db.execute(
                select(TenantSetting.value).where(
                    TenantSetting.tenant_id == tenant_id,
                    TenantSetting.key == "attendance_threshold",
                )
            )
        ).scalar_one_or_none()
        try:
            threshold = int(value) if value is not None else DEFAULT_ATTENDANCE_THRESHOLD
        except (TypeError, ValueError):
            return DEFAULT_ATTENDANCE_THRESHOLD
        return threshold if 0 <= threshold <= 100 else DEFAULT_ATTENDANCE_THRESHOLD

    @staticmethod
    async def _subject_options(
        db: AsyncSession, scope: StudentScope
    ) -> list[StudentSubjectOption]:
        if not scope.subject_ids:
            return []
        rows = (
            await db.execute(
                select(Subject.id, Subject.code, Subject.name, Subject.subject_type)
                .where(Subject.tenant_id == scope.tenant_id, Subject.id.in_(scope.subject_ids))
                .order_by(Subject.code)
            )
        ).all()
        teachers: dict[uuid.UUID, list[str]] = defaultdict(list)
        for subject_id, name in (
            await db.execute(
                select(TeacherSubject.subject_id, User.name)
                .join(User, User.id == TeacherSubject.teacher_id)
                .where(
                    TeacherSubject.tenant_id == scope.tenant_id,
                    TeacherSubject.subject_id.in_(scope.subject_ids),
                    User.deleted_at.is_(None),
                )
                .order_by(User.name)
            )
        ).all():
            teachers[subject_id].append(name)
        return [
            StudentSubjectOption(
                id=subject_id,
                code=code,
                name=name,
                subject_type=subject_type,
                teacher_names=teachers.get(subject_id, []),
            )
            for subject_id, code, name, subject_type in rows
        ]

    # ── C-ST-01 dashboard ───────────────────────────────────────────────────

    @staticmethod
    async def dashboard(db: AsyncSession, student: User) -> StudentDashboard:
        scope = await StudentService.scope_for_user(db, student)
        today = await PrincipalService._tenant_today(db, student.tenant_id)
        threshold = await StudentService._threshold(db, student.tenant_id)

        totals = (
            await db.execute(
                select(
                    func.count(AttendanceRecord.id),
                    func.sum(case((AttendanceRecord.status.in_(_PRESENT_STATUSES), 1), else_=0)),
                )
                .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
                .where(
                    AttendanceRecord.tenant_id == scope.tenant_id,
                    AttendanceRecord.student_id == scope.student_id,
                    AttendanceSession.class_id == scope.class_id,
                )
            )
        ).one()
        attendance_pct = _pct(int(totals[1] or 0), int(totals[0] or 0))

        weekday = today.isoweekday() % 7
        today_rows = (
            await db.execute(
                select(TimetableSlot, Subject.code, Subject.name, User.name)
                .outerjoin(
                    Subject,
                    and_(
                        Subject.id == TimetableSlot.subject_id,
                        Subject.tenant_id == scope.tenant_id,
                    ),
                )
                .outerjoin(
                    User,
                    and_(User.id == TimetableSlot.teacher_id, User.tenant_id == scope.tenant_id),
                )
                .where(
                    TimetableSlot.tenant_id == scope.tenant_id,
                    TimetableSlot.class_id == scope.class_id,
                    TimetableSlot.day_of_week == weekday,
                    TimetableSlot.effective_from <= today,
                    or_(
                        TimetableSlot.effective_to.is_(None),
                        TimetableSlot.effective_to >= today,
                    ),
                )
                .order_by(TimetableSlot.period_number)
            )
        ).all()

        assignments = await StudentService.assignments(db, student, scope=scope, limit=100)
        pending = [row for row in assignments.items if row.can_submit]

        exams = await StudentService.examinations(db, student, scope=scope, limit=50)
        now = datetime.now(timezone.utc)
        upcoming = [
            exam
            for exam in exams.items
            if exam.scheduled_at >= now and exam.scheduled_at <= now + timedelta(days=UPCOMING_DAYS)
        ]

        notices = await StudentService.notices(db, student, scope=scope, limit=5)

        fee = await StudentService.fees(db, student, scope=scope)

        return StudentDashboard(
            academic_year=scope.academic_year_name,
            class_name=scope.class_name,
            roll_number=scope.roll_number,
            today=today,
            attendance_percentage=attendance_pct,
            attendance_threshold=threshold,
            is_attendance_short=attendance_pct is not None and attendance_pct < threshold,
            today_classes=[
                StudentTodayClass(
                    slot_id=slot.id,
                    subject_id=slot.subject_id,
                    subject_code=code,
                    subject_name=name,
                    teacher_name=teacher_name,
                    period_number=slot.period_number,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    room_no=slot.room_no,
                    slot_type=slot.slot_type,
                )
                for slot, code, name, teacher_name in today_rows
            ],
            pending_assignment_count=assignments.pending_count,
            pending_assignments=[
                StudentPendingAssignment(
                    id=row.id,
                    title=row.title,
                    subject_code=row.subject_code,
                    due_date=row.due_date,
                    is_overdue=row.is_overdue,
                    status=row.my_status,
                )
                for row in pending[:5]
            ],
            upcoming_exam_count=len(upcoming),
            upcoming_exams=upcoming[:5],
            unread_notice_count=notices.unread_count,
            recent_notices=notices.items,
            fee_balance_due=fee.balance_due,
            subjects=await StudentService._subject_options(db, scope),
        )

    # ── C-ST-02 profile ─────────────────────────────────────────────────────

    @staticmethod
    async def profile(db: AsyncSession, student: User) -> StudentProfile:
        scope = await StudentService.scope_for_user(db, student)
        enrolment = (
            await db.execute(
                select(Enrollment.enrollment_date, Enrollment.status, Department.name)
                .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
                .outerjoin(Department, Department.id == SchoolClass.department_id)
                .where(
                    Enrollment.student_id == scope.student_id,
                    Enrollment.tenant_id == scope.tenant_id,
                    Enrollment.class_id == scope.class_id,
                    Enrollment.academic_year_id == scope.academic_year_id,
                )
            )
        ).first()
        mentor_name = (
            await db.execute(
                select(User.name)
                .join(MentorAssignment, MentorAssignment.mentor_id == User.id)
                .where(
                    MentorAssignment.tenant_id == scope.tenant_id,
                    MentorAssignment.student_id == scope.student_id,
                    MentorAssignment.is_active.is_(True),
                )
                .limit(1)
            )
        ).scalar_one_or_none()

        return StudentProfile(
            id=student.id,
            name=student.name,
            email=student.email,
            phone=student.phone,
            avatar_url=student.avatar_url,
            gender=_value(student.gender),
            date_of_birth=student.date_of_birth,
            address=student.address,
            roll_number=scope.roll_number or student.student_roll_no,
            class_id=scope.class_id,
            class_name=scope.class_name,
            department_name=enrolment[2] if enrolment else None,
            academic_year=scope.academic_year_name,
            enrollment_date=enrolment[0] if enrolment else None,
            enrollment_status=enrolment[1] if enrolment else "ACTIVE",
            mentor_name=mentor_name,
        )

    @staticmethod
    async def update_profile(
        db: AsyncSession, student: User, payload: StudentProfileUpdate
    ) -> StudentProfile:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(student, field, value.strip() if isinstance(value, str) else value)
        await db.commit()
        return await StudentService.profile(db, student)

    # ── C-ST-03 / C-ST-04 attendance ────────────────────────────────────────

    @staticmethod
    async def attendance(
        db: AsyncSession,
        student: User,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> StudentAttendanceOverview:
        scope = await StudentService.scope_for_user(db, student)
        today = await PrincipalService._tenant_today(db, student.tenant_id)
        end = to_date or today
        start = from_date or end - timedelta(days=180)
        if start > end:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="from_date must be on or before to_date",
            )
        threshold = await StudentService._threshold(db, student.tenant_id)

        base = [
            AttendanceRecord.tenant_id == scope.tenant_id,
            AttendanceRecord.student_id == scope.student_id,
            AttendanceSession.class_id == scope.class_id,
            AttendanceSession.date >= start,
            AttendanceSession.date <= end,
        ]
        present = case((AttendanceRecord.status.in_(_PRESENT_STATUSES), 1), else_=0)

        subject_rows = (
            await db.execute(
                select(
                    Subject.id,
                    Subject.code,
                    Subject.name,
                    func.count(AttendanceRecord.id),
                    func.sum(case((AttendanceRecord.status == AttendanceStatus.PRESENT, 1), else_=0)),
                    func.sum(case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0)),
                    func.sum(case((AttendanceRecord.status == AttendanceStatus.LATE, 1), else_=0)),
                    func.sum(case((AttendanceRecord.status == AttendanceStatus.EXCUSED, 1), else_=0)),
                    func.sum(present),
                )
                .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
                .join(Subject, Subject.id == AttendanceSession.subject_id)
                .where(*base)
                .group_by(Subject.id, Subject.code, Subject.name)
                .order_by(Subject.code)
            )
        ).all()

        subjects = []
        total_sessions = 0
        total_present = 0
        for subject_id, code, name, count, p, a, late, excused, attended in subject_rows:
            count = int(count or 0)
            attended = int(attended or 0)
            percentage = _pct(attended, count)
            total_sessions += count
            total_present += attended
            subjects.append(
                StudentSubjectAttendance(
                    subject_id=subject_id,
                    subject_code=code,
                    subject_name=name,
                    present_count=int(p or 0),
                    absent_count=int(a or 0),
                    late_count=int(late or 0),
                    excused_count=int(excused or 0),
                    total_sessions=count,
                    attendance_percentage=percentage,
                    is_short=percentage is not None and percentage < threshold,
                )
            )

        day_rows = (
            await db.execute(
                select(
                    AttendanceSession.date,
                    func.sum(present),
                    func.sum(case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0)),
                )
                .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
                .where(*base)
                .group_by(AttendanceSession.date)
                .order_by(AttendanceSession.date)
            )
        ).all()

        overall = _pct(total_present, total_sessions)
        return StudentAttendanceOverview(
            from_date=start,
            to_date=end,
            attendance_percentage=overall,
            attendance_threshold=threshold,
            is_short=overall is not None and overall < threshold,
            total_sessions=total_sessions,
            present_count=total_present,
            absent_count=total_sessions - total_present,
            subjects=subjects,
            days=[
                StudentAttendanceDay(
                    date=day,
                    # The calendar colours a day red the moment one period was
                    # missed; a green day the student actually skipped would be
                    # worse than a pessimistic one.
                    status="ABSENT" if int(absent or 0) else "PRESENT",
                    present_count=int(attended or 0),
                    absent_count=int(absent or 0),
                )
                for day, attended, absent in day_rows
            ],
        )

    # ── C-ST-05 leave ───────────────────────────────────────────────────────

    @staticmethod
    async def leaves(
        db: AsyncSession, student: User, *, limit: int = 50, offset: int = 0
    ) -> StudentLeavePage:
        scope = await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            AttendanceLeave.tenant_id == scope.tenant_id,
            AttendanceLeave.student_id == scope.student_id,
        ]
        total = int(
            (await db.execute(select(func.count(AttendanceLeave.id)).where(*clauses))).scalar() or 0
        )
        rows = (
            await db.execute(
                select(AttendanceLeave, User.name)
                .outerjoin(User, User.id == AttendanceLeave.reviewed_by)
                .where(*clauses)
                .order_by(AttendanceLeave.from_date.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return StudentLeavePage(
            total=total,
            limit=limit,
            offset=offset,
            items=[StudentService._leave_row(leave, name) for leave, name in rows],
        )

    @staticmethod
    async def apply_leave(
        db: AsyncSession, student: User, payload: StudentLeaveCreate
    ) -> StudentLeaveRow:
        scope = await StudentService.scope_for_user(db, student)
        overlapping = (
            await db.execute(
                select(func.count(AttendanceLeave.id)).where(
                    AttendanceLeave.tenant_id == scope.tenant_id,
                    AttendanceLeave.student_id == scope.student_id,
                    AttendanceLeave.status.in_((LeaveStatus.PENDING, LeaveStatus.APPROVED)),
                    AttendanceLeave.from_date <= payload.to_date,
                    AttendanceLeave.to_date >= payload.from_date,
                )
            )
        ).scalar() or 0
        if overlapping:
            # Two live requests for the same day would give a class teacher
            # contradictory instructions.
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="You already have a leave request covering these dates",
            )

        leave = AttendanceLeave(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            student_id=scope.student_id,
            class_id=scope.class_id,
            from_date=payload.from_date,
            to_date=payload.to_date,
            reason=payload.reason.strip(),
            document_url=payload.document_url,
            status=LeaveStatus.PENDING,
        )
        db.add(leave)
        await db.commit()
        return StudentService._leave_row(leave, None)

    @staticmethod
    async def cancel_leave(
        db: AsyncSession, student: User, leave_id: uuid.UUID
    ) -> StudentLeaveRow:
        scope = await StudentService.scope_for_user(db, student)
        leave = (
            await db.execute(
                select(AttendanceLeave).where(
                    AttendanceLeave.id == leave_id,
                    AttendanceLeave.tenant_id == scope.tenant_id,
                    AttendanceLeave.student_id == scope.student_id,
                )
            )
        ).scalar_one_or_none()
        if leave is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Leave request not found")
        if leave.status != LeaveStatus.PENDING:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Only a pending request can be withdrawn",
            )
        leave.status = LeaveStatus.CANCELLED
        await db.commit()
        return StudentService._leave_row(leave, None)

    @staticmethod
    def _leave_row(leave: AttendanceLeave, reviewer_name: str | None) -> StudentLeaveRow:
        return StudentLeaveRow(
            id=leave.id,
            from_date=leave.from_date,
            to_date=leave.to_date,
            total_days=(leave.to_date - leave.from_date).days + 1,
            reason=leave.reason,
            document_url=leave.document_url,
            status=_value(leave.status) or "PENDING",
            reviewed_by_name=reviewer_name,
            reviewed_at=leave.reviewed_at,
            created_at=leave.created_at or datetime.now(timezone.utc),
        )

    # ── C-ST-06 timetable ───────────────────────────────────────────────────

    @staticmethod
    async def timetable(db: AsyncSession, student: User) -> StudentTimetable:
        scope = await StudentService.scope_for_user(db, student)
        today = await PrincipalService._tenant_today(db, student.tenant_id)
        rows = (
            await db.execute(
                select(TimetableSlot, Subject.code, Subject.name, User.name)
                .outerjoin(
                    Subject,
                    and_(
                        Subject.id == TimetableSlot.subject_id,
                        Subject.tenant_id == scope.tenant_id,
                    ),
                )
                .outerjoin(
                    User,
                    and_(User.id == TimetableSlot.teacher_id, User.tenant_id == scope.tenant_id),
                )
                .where(
                    TimetableSlot.tenant_id == scope.tenant_id,
                    TimetableSlot.class_id == scope.class_id,
                    TimetableSlot.effective_from <= today,
                    or_(
                        TimetableSlot.effective_to.is_(None),
                        TimetableSlot.effective_to >= today,
                    ),
                )
                .order_by(TimetableSlot.day_of_week, TimetableSlot.period_number)
            )
        ).all()
        return StudentTimetable(
            class_name=scope.class_name,
            academic_year=scope.academic_year_name,
            slots=[
                StudentTimetableSlot(
                    id=slot.id,
                    day_of_week=slot.day_of_week,
                    period_number=slot.period_number,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    subject_id=slot.subject_id,
                    subject_code=code,
                    subject_name=name,
                    teacher_name=teacher_name,
                    room_no=slot.room_no,
                    slot_type=slot.slot_type,
                )
                for slot, code, name, teacher_name in rows
            ],
        )

    # ── C-ST-07 exam list ───────────────────────────────────────────────────

    @staticmethod
    async def examinations(
        db: AsyncSession,
        student: User,
        *,
        scope: StudentScope | None = None,
        status_filter: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> StudentExamPage:
        scope = scope or await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            Exam.tenant_id == scope.tenant_id,
            Exam.class_id == scope.class_id,
            # A draft paper is the teacher's workspace; students only ever see
            # a published one.
            Exam.status != ExamStatus.DRAFT,
            Exam.status != ExamStatus.CANCELLED,
        ]
        if status_filter:
            normalised = status_filter.strip().upper()
            if normalised not in {item.value for item in ExamStatus}:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown exam status"
                )
            clauses.append(Exam.status == ExamStatus(normalised))

        total = int((await db.execute(select(func.count(Exam.id)).where(*clauses))).scalar() or 0)
        rows = (
            await db.execute(
                select(Exam, Subject.code, Subject.name)
                .join(Subject, Subject.id == Exam.subject_id)
                .where(*clauses)
                .order_by(Exam.scheduled_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        exams = [row[0] for row in rows]
        attempts = {
            attempt.exam_id: attempt
            for attempt in (
                await db.execute(
                    select(ExamAttempt).where(
                        ExamAttempt.tenant_id == scope.tenant_id,
                        ExamAttempt.student_id == scope.student_id,
                        ExamAttempt.exam_id.in_([exam.id for exam in exams] or [uuid.uuid4()]),
                    )
                )
            )
            .scalars()
            .all()
        }
        now = datetime.now(timezone.utc)
        return StudentExamPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[
                StudentService._exam_row(exam, code, name, attempts.get(exam.id), now)
                for exam, code, name in rows
            ],
        )

    @staticmethod
    def _exam_row(
        exam: Exam,
        subject_code: str,
        subject_name: str,
        attempt: ExamAttempt | None,
        now: datetime,
    ) -> StudentUpcomingExam:
        window_end = exam.window_end_at or exam.scheduled_at + timedelta(
            minutes=exam.duration_minutes
        )
        can_attempt = (
            exam.mode == "ONLINE"
            and exam.status in (ExamStatus.PUBLISHED, ExamStatus.ONGOING)
            and exam.scheduled_at <= now <= window_end
            and (attempt is None or attempt.submitted_at is None)
        )
        return StudentUpcomingExam(
            id=exam.id,
            title=exam.title,
            subject_code=subject_code,
            subject_name=subject_name,
            exam_type=exam.exam_type,
            mode=exam.mode,
            scheduled_at=exam.scheduled_at,
            window_end_at=exam.window_end_at,
            duration_minutes=exam.duration_minutes,
            total_marks=exam.total_marks,
            status=_value(exam.status) or "PUBLISHED",
            attempt_status=_value(attempt.status) if attempt else None,
            can_attempt=can_attempt,
        )

    # ── C-ST-08 attempt screen ──────────────────────────────────────────────

    @staticmethod
    async def start_attempt(
        db: AsyncSession, student: User, exam_id: uuid.UUID
    ) -> StudentAttemptScreen:
        """Open (or resume) an attempt. Resuming never restarts the clock."""
        scope = await StudentService.scope_for_user(db, student)
        exam = await StudentService._ensure_exam(db, scope, exam_id)
        now = datetime.now(timezone.utc)

        if exam.mode != "ONLINE":
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This exam is written in the hall, not online"
            )
        if exam.status not in (ExamStatus.PUBLISHED, ExamStatus.ONGOING):
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This exam is not open")
        window_end = exam.window_end_at or exam.scheduled_at + timedelta(
            minutes=exam.duration_minutes
        )
        if now < exam.scheduled_at:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This exam has not started yet")
        if now > window_end:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This exam window has closed")

        attempt = (
            await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.tenant_id == scope.tenant_id,
                    ExamAttempt.exam_id == exam.id,
                    ExamAttempt.student_id == scope.student_id,
                )
            )
        ).scalar_one_or_none()
        if attempt is not None and attempt.submitted_at is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="You have already submitted this exam"
            )
        if attempt is None:
            attempt = ExamAttempt(
                id=uuid.uuid4(),
                tenant_id=scope.tenant_id,
                exam_id=exam.id,
                student_id=scope.student_id,
                started_at=now,
                status=AttemptStatus.IN_PROGRESS,
            )
            db.add(attempt)
            try:
                await db.flush()
            except IntegrityError:
                # Two tabs raced to start. The unique (exam, student) key means
                # exactly one row wins; reload it rather than erroring.
                await db.rollback()
                attempt = (
                    await db.execute(
                        select(ExamAttempt).where(
                            ExamAttempt.tenant_id == scope.tenant_id,
                            ExamAttempt.exam_id == exam.id,
                            ExamAttempt.student_id == scope.student_id,
                        )
                    )
                ).scalar_one()
            else:
                await db.commit()

        return await StudentService._attempt_screen(db, scope, exam, attempt)

    @staticmethod
    async def _attempt_screen(
        db: AsyncSession, scope: StudentScope, exam: Exam, attempt: ExamAttempt
    ) -> StudentAttemptScreen:
        questions = (
            await db.execute(
                select(Question)
                .where(Question.exam_id == exam.id)
                .order_by(Question.sort_order, Question.id)
            )
        ).scalars().all()
        options: dict[uuid.UUID, list[StudentAttemptQuestionOption]] = defaultdict(list)
        if questions:
            for option in (
                await db.execute(
                    # `is_correct` is deliberately not selected: the answer key
                    # must never travel to the machine sitting the exam.
                    select(
                        QuestionOption.id,
                        QuestionOption.question_id,
                        QuestionOption.text,
                        QuestionOption.sort_order,
                    )
                    .where(QuestionOption.question_id.in_([q.id for q in questions]))
                    .order_by(QuestionOption.sort_order, QuestionOption.id)
                )
            ).all():
                options[option[1]].append(
                    StudentAttemptQuestionOption(
                        id=option[0], text=option[2], sort_order=option[3]
                    )
                )

        saved = {
            answer.question_id: answer
            for answer in (
                await db.execute(select(Answer).where(Answer.attempt_id == attempt.id))
            )
            .scalars()
            .all()
        }

        window_end = exam.window_end_at or exam.scheduled_at + timedelta(
            minutes=exam.duration_minutes
        )
        started = attempt.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        subject_code = (
            await db.execute(select(Subject.code).where(Subject.id == exam.subject_id))
        ).scalar_one()

        return StudentAttemptScreen(
            attempt_id=attempt.id,
            exam_id=exam.id,
            title=exam.title,
            subject_code=subject_code,
            instructions=exam.instructions,
            total_marks=exam.total_marks,
            duration_minutes=exam.duration_minutes,
            started_at=started,
            # Whichever comes first: the personal timer or the shared window.
            expires_at=min(started + timedelta(minutes=exam.duration_minutes), window_end),
            server_time=datetime.now(timezone.utc),
            tab_switch_count=attempt.tab_switch_count,
            is_submitted=attempt.submitted_at is not None,
            questions=[
                StudentAttemptQuestion(
                    id=question.id,
                    text=question.text,
                    question_type=_value(question.question_type) or "MCQ",
                    marks=float(question.marks),
                    negative_marks=float(question.negative_marks),
                    image_url=question.image_url,
                    sort_order=question.sort_order,
                    options=options.get(question.id, []),
                    selected_option_id=(
                        saved[question.id].selected_option_id if question.id in saved else None
                    ),
                    text_answer=saved[question.id].text_answer if question.id in saved else None,
                )
                for question in questions
            ],
        )

    @staticmethod
    async def save_answers(
        db: AsyncSession, student: User, attempt_id: uuid.UUID, payload: StudentAnswerSave
    ) -> StudentAttemptScreen:
        """Autosave. Scores are never written here — only on submit."""
        scope = await StudentService.scope_for_user(db, student)
        attempt, exam = await StudentService._ensure_open_attempt(db, scope, attempt_id)
        await StudentService._write_answers(db, attempt, exam, payload.answers)
        await db.commit()
        return await StudentService._attempt_screen(db, scope, exam, attempt)

    @staticmethod
    async def submit_attempt(
        db: AsyncSession,
        student: User,
        attempt_id: uuid.UUID,
        payload: StudentAttemptSubmit,
    ) -> StudentExamResult:
        scope = await StudentService.scope_for_user(db, student)
        attempt, exam = await StudentService._ensure_open_attempt(
            db, scope, attempt_id, allow_expired=True
        )
        now = datetime.now(timezone.utc)
        started = attempt.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        deadline = started + timedelta(minutes=exam.duration_minutes)
        window_end = exam.window_end_at or exam.scheduled_at + timedelta(
            minutes=exam.duration_minutes
        )
        expired = now > min(deadline, window_end)

        if payload.answers and not expired:
            await StudentService._write_answers(db, attempt, exam, payload.answers)
        await db.flush()

        # Auto-score the objective questions from the answer key. Descriptive
        # answers stay ungraded (score IS NULL) until the teacher opens them.
        rows = (
            await db.execute(
                select(Answer, Question)
                .join(Question, Question.id == Answer.question_id)
                .where(Answer.attempt_id == attempt.id)
            )
        ).all()
        correct_options = {
            option_id
            for option_id in (
                await db.execute(
                    select(QuestionOption.id).where(
                        QuestionOption.question_id.in_([question.id for _a, question in rows] or [uuid.uuid4()]),
                        QuestionOption.is_correct.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        }
        awarded = Decimal("0")
        ungraded = 0
        for answer, question in rows:
            if question.question_type in _AUTO_GRADED_TYPES:
                if answer.selected_option_id in correct_options:
                    answer.score = question.marks
                else:
                    # Negative marking only bites on a wrong answer, never a
                    # blank one — skipping must not cost marks.
                    answer.score = (
                        -question.negative_marks
                        if answer.selected_option_id is not None
                        else Decimal("0")
                    )
                answer.is_auto_graded = True
                answer.graded_at = now
                awarded += answer.score
            elif answer.score is not None:
                awarded += answer.score
            else:
                ungraded += 1

        awarded = max(awarded, Decimal("0"))
        attempt.submitted_at = now
        attempt.auto_submitted = expired
        attempt.total_score = awarded
        if exam.total_marks:
            percentage = round(float(awarded) * 100 / exam.total_marks, 2)
            attempt.percentage = Decimal(str(percentage))
            attempt.grade = _grade_for(percentage)
        attempt.status = AttemptStatus.SUBMITTED if ungraded else AttemptStatus.GRADED

        await db.commit()
        return await StudentService.exam_result(db, student, exam.id)

    @staticmethod
    async def record_tab_switch(
        db: AsyncSession, student: User, attempt_id: uuid.UUID, payload: StudentTabSwitch
    ) -> StudentAttemptScreen:
        """Count a focus loss. The Exam Controller's monitor reads this counter."""
        scope = await StudentService.scope_for_user(db, student)
        attempt, exam = await StudentService._ensure_open_attempt(db, scope, attempt_id)
        attempt.tab_switch_count += payload.count
        await db.commit()
        return await StudentService._attempt_screen(db, scope, exam, attempt)

    @staticmethod
    async def _ensure_open_attempt(
        db: AsyncSession,
        scope: StudentScope,
        attempt_id: uuid.UUID,
        *,
        allow_expired: bool = False,
    ) -> tuple[ExamAttempt, Exam]:
        attempt = (
            await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.id == attempt_id,
                    ExamAttempt.tenant_id == scope.tenant_id,
                    # The attempt must belong to the caller — this is the check
                    # that stops one student writing into another's paper.
                    ExamAttempt.student_id == scope.student_id,
                )
            )
        ).scalar_one_or_none()
        if attempt is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        if attempt.submitted_at is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This attempt was already submitted"
            )
        exam = (
            await db.execute(
                select(Exam).where(Exam.id == attempt.exam_id, Exam.tenant_id == scope.tenant_id)
            )
        ).scalar_one()

        if not allow_expired:
            started = attempt.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            deadline = started + timedelta(minutes=exam.duration_minutes)
            if datetime.now(timezone.utc) > deadline:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail="Your time is up; submit the attempt",
                )
        return attempt, exam

    @staticmethod
    async def _write_answers(
        db: AsyncSession, attempt: ExamAttempt, exam: Exam, answers: Sequence
    ) -> None:
        questions = {
            question.id: question
            for question in (
                await db.execute(select(Question).where(Question.exam_id == exam.id))
            )
            .scalars()
            .all()
        }
        existing = {
            answer.question_id: answer
            for answer in (
                await db.execute(select(Answer).where(Answer.attempt_id == attempt.id))
            )
            .scalars()
            .all()
        }
        valid_options = {
            (option.question_id, option.id)
            for option in (
                await db.execute(
                    select(QuestionOption).where(
                        QuestionOption.question_id.in_(questions.keys() or [uuid.uuid4()])
                    )
                )
            )
            .scalars()
            .all()
        }
        now = datetime.now(timezone.utc)
        for item in answers:
            if item.question_id not in questions:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, detail="Question not found on this exam"
                )
            if (
                item.selected_option_id is not None
                and (item.question_id, item.selected_option_id) not in valid_options
            ):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="That option does not belong to the question",
                )
            row = existing.get(item.question_id)
            if row is None:
                db.add(
                    Answer(
                        id=uuid.uuid4(),
                        attempt_id=attempt.id,
                        question_id=item.question_id,
                        selected_option_id=item.selected_option_id,
                        text_answer=item.text_answer,
                        answered_at=now,
                    )
                )
            else:
                row.selected_option_id = item.selected_option_id
                row.text_answer = item.text_answer
                row.answered_at = now

    # ── C-ST-09 exam result ─────────────────────────────────────────────────

    @staticmethod
    async def exam_result(
        db: AsyncSession, student: User, exam_id: uuid.UUID
    ) -> StudentExamResult:
        scope = await StudentService.scope_for_user(db, student)
        exam = await StudentService._ensure_exam(db, scope, exam_id)
        labels = (
            await db.execute(
                select(Subject.code, Subject.name).where(Subject.id == exam.subject_id)
            )
        ).one()
        attempt = (
            await db.execute(
                select(ExamAttempt).where(
                    ExamAttempt.tenant_id == scope.tenant_id,
                    ExamAttempt.exam_id == exam.id,
                    ExamAttempt.student_id == scope.student_id,
                )
            )
        ).scalar_one_or_none()
        if attempt is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="You have not attempted this exam")

        pass_mark = exam.passing_marks
        score = _decimal(attempt.total_score)
        # Per-question review is a teacher-controlled affordance
        # (`exams.allow_review`) and only once results are actually released.
        review = exam.allow_review and exam.status == ExamStatus.RESULTS_RELEASED

        answers: list[StudentExamResultAnswer] = []
        if review:
            correct_text = {
                question_id: text
                for question_id, text in (
                    await db.execute(
                        select(QuestionOption.question_id, QuestionOption.text)
                        .join(Question, Question.id == QuestionOption.question_id)
                        .where(
                            Question.exam_id == exam.id, QuestionOption.is_correct.is_(True)
                        )
                    )
                ).all()
            }
            rows = (
                await db.execute(
                    select(Answer, Question, QuestionOption.text)
                    .join(Question, Question.id == Answer.question_id)
                    .outerjoin(QuestionOption, QuestionOption.id == Answer.selected_option_id)
                    .where(Answer.attempt_id == attempt.id)
                    .order_by(Question.sort_order, Question.id)
                )
            ).all()
            answers = [
                StudentExamResultAnswer(
                    question_id=question.id,
                    question_text=question.text,
                    question_type=_value(question.question_type) or "MCQ",
                    question_marks=float(question.marks),
                    your_answer=chosen or answer.text_answer,
                    correct_answer=correct_text.get(question.id),
                    score=_decimal(answer.score),
                    feedback=answer.feedback,
                    explanation=question.explanation,
                )
                for answer, question, chosen in rows
            ]

        return StudentExamResult(
            exam_id=exam.id,
            title=exam.title,
            subject_code=labels[0],
            subject_name=labels[1],
            total_marks=exam.total_marks,
            passing_marks=pass_mark,
            submitted_at=attempt.submitted_at,
            total_score=score,
            percentage=_decimal(attempt.percentage),
            grade=attempt.grade,
            is_pass=(score >= pass_mark) if score is not None else None,
            status=_value(attempt.status) or "SUBMITTED",
            review_available=review,
            answers=answers,
        )

    @staticmethod
    async def _ensure_exam(db: AsyncSession, scope: StudentScope, exam_id: uuid.UUID) -> Exam:
        exam = (
            await db.execute(
                select(Exam).where(
                    Exam.id == exam_id,
                    Exam.tenant_id == scope.tenant_id,
                    Exam.class_id == scope.class_id,
                    Exam.status != ExamStatus.DRAFT,
                )
            )
        ).scalar_one_or_none()
        if exam is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Exam not found")
        return exam

    # ── C-ST-10 … C-ST-12 assignments ───────────────────────────────────────

    @staticmethod
    async def assignments(
        db: AsyncSession,
        student: User,
        *,
        scope: StudentScope | None = None,
        status_filter: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> StudentAssignmentPage:
        scope = scope or await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            Assignment.tenant_id == scope.tenant_id,
            Assignment.class_id == scope.class_id,
            Assignment.status != AssignmentStatus.DRAFT,
        ]
        total = int(
            (await db.execute(select(func.count(Assignment.id)).where(*clauses))).scalar() or 0
        )
        rows = (
            await db.execute(
                select(Assignment, Subject.code, Subject.name, User.name)
                .join(Subject, Subject.id == Assignment.subject_id)
                .outerjoin(User, User.id == Assignment.teacher_id)
                .where(*clauses)
                .order_by(Assignment.due_date.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        assignments = [row[0] for row in rows]
        latest = await StudentService._latest_submissions(
            db, scope, [assignment.id for assignment in assignments]
        )
        now = datetime.now(timezone.utc)
        items = [
            StudentService._assignment_row(
                assignment, code, name, teacher_name, latest.get(assignment.id), now
            )
            for assignment, code, name, teacher_name in rows
        ]
        if status_filter:
            normalised = status_filter.strip().upper()
            items = [item for item in items if item.my_status == normalised]

        return StudentAssignmentPage(
            total=total,
            limit=limit,
            offset=offset,
            pending_count=sum(1 for item in items if item.can_submit),
            submitted_count=sum(1 for item in items if item.my_status != "PENDING"),
            items=items,
        )

    @staticmethod
    async def _latest_submissions(
        db: AsyncSession, scope: StudentScope, assignment_ids: Sequence[uuid.UUID]
    ) -> dict[uuid.UUID, Submission]:
        """The newest top-level submission per assignment for this student."""
        if not assignment_ids:
            return {}
        rows = (
            await db.execute(
                select(Submission)
                .where(
                    Submission.tenant_id == scope.tenant_id,
                    Submission.student_id == scope.student_id,
                    Submission.assignment_id.in_(assignment_ids),
                    Submission.milestone_id.is_(None),
                )
                .order_by(Submission.assignment_id, Submission.version.desc())
            )
        ).scalars().all()
        latest: dict[uuid.UUID, Submission] = {}
        for row in rows:
            latest.setdefault(row.assignment_id, row)
        return latest

    @staticmethod
    def _assignment_row(
        assignment: Assignment,
        subject_code: str,
        subject_name: str,
        teacher_name: str | None,
        submission: Submission | None,
        now: datetime,
    ) -> StudentAssignmentRow:
        overdue = assignment.due_date < now
        my_status = _value(submission.status) if submission else "PENDING"
        # Resubmission is allowed while the teacher has asked for changes, or
        # while nothing has been sent and the window (plus any late policy) is
        # still open.
        can_submit = (
            assignment.status == AssignmentStatus.PUBLISHED
            and (
                my_status in ("PENDING", "REJECTED", "RESUBMIT_REQUESTED")
            )
            and (not overdue or assignment.allow_late_submission)
        )
        return StudentAssignmentRow(
            id=assignment.id,
            title=assignment.title,
            subject_id=assignment.subject_id,
            subject_code=subject_code,
            subject_name=subject_name,
            teacher_name=teacher_name,
            assignment_type=assignment.assignment_type,
            total_marks=assignment.total_marks,
            passing_marks=assignment.passing_marks,
            due_date=assignment.due_date,
            is_overdue=overdue,
            allow_late_submission=assignment.allow_late_submission,
            late_penalty_percent=assignment.late_penalty_percent,
            my_status=my_status or "PENDING",
            my_score=_decimal(submission.score) if submission else None,
            can_submit=can_submit,
        )

    @staticmethod
    async def assignment_detail(
        db: AsyncSession, student: User, assignment_id: uuid.UUID
    ) -> StudentAssignmentDetail:
        scope = await StudentService.scope_for_user(db, student)
        assignment = await StudentService._ensure_assignment(db, scope, assignment_id)
        labels = (
            await db.execute(
                select(Subject.code, Subject.name, User.name)
                .select_from(Assignment)
                .join(Subject, Subject.id == Assignment.subject_id)
                .outerjoin(User, User.id == Assignment.teacher_id)
                .where(Assignment.id == assignment.id)
            )
        ).one()

        submissions = (
            await db.execute(
                select(Submission)
                .where(
                    Submission.tenant_id == scope.tenant_id,
                    Submission.assignment_id == assignment.id,
                    Submission.student_id == scope.student_id,
                )
                .order_by(Submission.submitted_at.desc())
            )
        ).scalars().all()
        files: dict[uuid.UUID, list[StudentSubmissionFile]] = defaultdict(list)
        if submissions:
            for item in (
                await db.execute(
                    select(SubmissionFile)
                    .where(SubmissionFile.submission_id.in_([s.id for s in submissions]))
                    .order_by(SubmissionFile.uploaded_at)
                )
            ).scalars().all():
                files[item.submission_id].append(
                    StudentSubmissionFile(
                        id=item.id,
                        file_name=item.file_name,
                        file_key=item.file_key,
                        file_size_bytes=item.file_size_bytes,
                        mime_type=item.mime_type,
                        uploaded_at=item.uploaded_at,
                    )
                )

        milestones = (
            await db.execute(
                select(Milestone)
                .where(Milestone.assignment_id == assignment.id)
                .order_by(Milestone.sort_order)
            )
        ).scalars().all()
        by_milestone = {
            submission.milestone_id: submission
            for submission in sorted(submissions, key=lambda s: s.version)
            if submission.milestone_id is not None
        }
        milestone_rows: list[StudentMilestoneRow] = []
        previous_approved = True
        for milestone in milestones:
            submission = by_milestone.get(milestone.id)
            milestone_rows.append(
                StudentMilestoneRow(
                    id=milestone.id,
                    title=milestone.title,
                    description=milestone.description,
                    marks=milestone.marks,
                    due_date=milestone.due_date,
                    sort_order=milestone.sort_order,
                    # Stage N opens only when stage N-1 has been approved —
                    # this is the "unlock status" C-ST-12 renders.
                    is_locked=not previous_approved,
                    submission_id=submission.id if submission else None,
                    submission_status=_value(submission.status) if submission else None,
                    score=_decimal(submission.score) if submission else None,
                    feedback=submission.feedback if submission else None,
                )
            )
            previous_approved = (
                submission is not None and submission.status == SubmissionStatus.APPROVED
            )

        latest = next((s for s in submissions if s.milestone_id is None), None)
        base = StudentService._assignment_row(
            assignment, labels[0], labels[1], labels[2], latest, datetime.now(timezone.utc)
        )
        milestone_titles = {milestone.id: milestone.title for milestone in milestones}
        return StudentAssignmentDetail(
            **base.model_dump(),
            description=assignment.description,
            max_file_size_mb=assignment.max_file_size_mb,
            allowed_file_types=list(assignment.allowed_file_types or []),
            instructions_url=assignment.instructions_url,
            milestones=milestone_rows,
            submissions=[
                StudentSubmissionRow(
                    id=submission.id,
                    milestone_id=submission.milestone_id,
                    milestone_title=milestone_titles.get(submission.milestone_id),
                    text_response=submission.text_response,
                    submitted_at=submission.submitted_at,
                    is_late=submission.is_late,
                    late_by_minutes=submission.late_by_minutes,
                    score=_decimal(submission.score),
                    grade=submission.grade,
                    feedback=submission.feedback,
                    status=_value(submission.status) or "SUBMITTED",
                    version=submission.version,
                    reviewed_at=submission.reviewed_at,
                    files=files.get(submission.id, []),
                )
                for submission in submissions
            ],
        )

    @staticmethod
    async def submit_assignment(
        db: AsyncSession,
        student: User,
        assignment_id: uuid.UUID,
        payload: StudentSubmissionCreate,
    ) -> StudentAssignmentDetail:
        scope = await StudentService.scope_for_user(db, student)
        assignment = await StudentService._ensure_assignment(db, scope, assignment_id)
        now = datetime.now(timezone.utc)

        if assignment.status != AssignmentStatus.PUBLISHED:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This assignment is not accepting submissions"
            )

        due = assignment.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        is_late = now > due
        if is_late and not assignment.allow_late_submission:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="The due date for this assignment has passed"
            )

        milestone = None
        if payload.milestone_id is not None:
            milestone = (
                await db.execute(
                    select(Milestone).where(
                        Milestone.id == payload.milestone_id,
                        Milestone.assignment_id == assignment.id,
                    )
                )
            ).scalar_one_or_none()
            if milestone is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Milestone not found")
            await StudentService._require_milestone_unlocked(db, scope, assignment, milestone)
        elif assignment.assignment_type == "MILESTONE":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choose which milestone you are submitting",
            )

        for item in payload.files:
            extension = item.file_name.rsplit(".", 1)[-1].lower() if "." in item.file_name else ""
            allowed = [value.lower() for value in (assignment.allowed_file_types or [])]
            if allowed and extension not in allowed:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{item.file_name}: only {', '.join(allowed)} files are accepted",
                )
            if item.file_size_bytes > assignment.max_file_size_mb * 1024 * 1024:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{item.file_name} exceeds the {assignment.max_file_size_mb} MB limit",
                )

        previous = (
            await db.execute(
                select(Submission)
                .where(
                    Submission.tenant_id == scope.tenant_id,
                    Submission.assignment_id == assignment.id,
                    Submission.student_id == scope.student_id,
                    (
                        Submission.milestone_id == payload.milestone_id
                        if payload.milestone_id is not None
                        else Submission.milestone_id.is_(None)
                    ),
                )
                .order_by(Submission.version.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if previous is not None and previous.status in (
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.UNDER_REVIEW,
            SubmissionStatus.APPROVED,
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Your last submission is still with the teacher",
            )

        submission = Submission(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            assignment_id=assignment.id,
            milestone_id=payload.milestone_id,
            student_id=scope.student_id,
            text_response=(payload.text_response or "").strip() or None,
            submitted_at=now,
            is_late=is_late,
            late_by_minutes=int((now - due).total_seconds() // 60) if is_late else None,
            status=SubmissionStatus.SUBMITTED,
            # A resubmission is a new version, never an overwrite: the earlier
            # attempt and its feedback stay auditable.
            version=(previous.version + 1) if previous else 1,
        )
        db.add(submission)
        for item in payload.files:
            db.add(
                SubmissionFile(
                    id=uuid.uuid4(),
                    submission_id=submission.id,
                    file_name=item.file_name,
                    file_key=item.file_key,
                    file_size_bytes=item.file_size_bytes,
                    mime_type=item.mime_type,
                )
            )
        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="This submission was already recorded"
            ) from exc
        await db.commit()
        return await StudentService.assignment_detail(db, student, assignment_id)

    @staticmethod
    async def _require_milestone_unlocked(
        db: AsyncSession, scope: StudentScope, assignment: Assignment, milestone: Milestone
    ) -> None:
        if milestone.sort_order <= 1:
            return
        previous = (
            await db.execute(
                select(Milestone)
                .where(
                    Milestone.assignment_id == assignment.id,
                    Milestone.sort_order < milestone.sort_order,
                )
                .order_by(Milestone.sort_order.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if previous is None:
            return
        approved = (
            await db.execute(
                select(func.count(Submission.id)).where(
                    Submission.tenant_id == scope.tenant_id,
                    Submission.assignment_id == assignment.id,
                    Submission.student_id == scope.student_id,
                    Submission.milestone_id == previous.id,
                    Submission.status == SubmissionStatus.APPROVED,
                )
            )
        ).scalar() or 0
        if not approved:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"Finish and get '{previous.title}' approved first",
            )

    @staticmethod
    async def _ensure_assignment(
        db: AsyncSession, scope: StudentScope, assignment_id: uuid.UUID
    ) -> Assignment:
        assignment = (
            await db.execute(
                select(Assignment).where(
                    Assignment.id == assignment_id,
                    Assignment.tenant_id == scope.tenant_id,
                    Assignment.class_id == scope.class_id,
                    Assignment.status != AssignmentStatus.DRAFT,
                )
            )
        ).scalar_one_or_none()
        if assignment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Assignment not found")
        return assignment

    # ── C-ST-13 / C-ST-14 content ───────────────────────────────────────────

    @staticmethod
    async def content(
        db: AsyncSession,
        student: User,
        *,
        subject_id: uuid.UUID | None = None,
        chapter: str | None = None,
        content_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> StudentContentPage:
        scope = await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            ContentItem.tenant_id == scope.tenant_id,
            ContentItem.class_id == scope.class_id,
            ContentItem.deleted_at.is_(None),
            # A teacher staging material keeps it invisible until ready.
            ContentItem.is_visible.is_(True),
        ]
        if subject_id is not None:
            clauses.append(ContentItem.subject_id == scope.require_subject(subject_id))
        if chapter:
            clauses.append(ContentItem.chapter == chapter.strip())
        if content_type:
            clauses.append(ContentItem.content_type == content_type.strip().upper())

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
                        ContentItem.class_id == scope.class_id,
                        ContentItem.deleted_at.is_(None),
                        ContentItem.is_visible.is_(True),
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
                select(ContentItem, Subject.code, Subject.name, User.name)
                .join(Subject, Subject.id == ContentItem.subject_id)
                .outerjoin(User, User.id == ContentItem.uploaded_by)
                .where(*clauses)
                .order_by(ContentItem.chapter, ContentItem.sort_order, ContentItem.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return StudentContentPage(
            total=total,
            limit=limit,
            offset=offset,
            chapters=chapters,
            subjects=await StudentService._subject_options(db, scope),
            items=[
                StudentContentRow(
                    id=item.id,
                    title=item.title,
                    description=item.description,
                    subject_id=item.subject_id,
                    subject_code=code,
                    subject_name=name,
                    content_type=_value(item.content_type) or "PDF",
                    file_key=item.file_key,
                    external_url=item.external_url,
                    file_size_bytes=item.file_size_bytes,
                    duration_seconds=item.duration_seconds,
                    chapter=item.chapter,
                    uploaded_by_name=uploader,
                    created_at=item.created_at,
                )
                for item, code, name, uploader in rows
            ],
        )

    @staticmethod
    async def open_content(
        db: AsyncSession, student: User, content_id: uuid.UUID
    ) -> StudentContentRow:
        """Fetch one resource and count the view (C-ST-14)."""
        scope = await StudentService.scope_for_user(db, student)
        row = (
            await db.execute(
                select(ContentItem, Subject.code, Subject.name, User.name)
                .join(Subject, Subject.id == ContentItem.subject_id)
                .outerjoin(User, User.id == ContentItem.uploaded_by)
                .where(
                    ContentItem.id == content_id,
                    ContentItem.tenant_id == scope.tenant_id,
                    ContentItem.class_id == scope.class_id,
                    ContentItem.deleted_at.is_(None),
                    ContentItem.is_visible.is_(True),
                )
            )
        ).first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Content not found")
        item, code, name, uploader = row
        item.view_count += 1
        await db.commit()
        return StudentContentRow(
            id=item.id,
            title=item.title,
            description=item.description,
            subject_id=item.subject_id,
            subject_code=code,
            subject_name=name,
            content_type=_value(item.content_type) or "PDF",
            file_key=item.file_key,
            external_url=item.external_url,
            file_size_bytes=item.file_size_bytes,
            duration_seconds=item.duration_seconds,
            chapter=item.chapter,
            uploaded_by_name=uploader,
            created_at=item.created_at,
        )

    # ── C-ST-15 … C-ST-17 results ───────────────────────────────────────────

    @staticmethod
    async def results(db: AsyncSession, student: User) -> StudentResultList:
        scope = await StudentService.scope_for_user(db, student)
        rows = (
            await db.execute(
                select(StudentResult, ResultPublication)
                .join(ResultPublication, ResultPublication.id == StudentResult.publication_id)
                .where(
                    StudentResult.tenant_id == scope.tenant_id,
                    StudentResult.student_id == scope.student_id,
                    # Two gates: the Principal approved it *and* the controller
                    # released it to students.
                    ResultPublication.is_visible_to_students.is_(True),
                    ResultPublication.approval_status == "APPROVED",
                )
                .order_by(ResultPublication.published_at.desc())
            )
        ).all()
        return StudentResultList(
            items=[StudentService._result_row(result, publication) for result, publication in rows]
        )

    @staticmethod
    def _result_row(result: StudentResult, publication: ResultPublication) -> StudentResultRow:
        return StudentResultRow(
            id=result.id,
            publication_id=publication.id,
            publication_title=publication.title,
            published_at=publication.published_at,
            total_marks_obtained=float(result.total_marks_obtained),
            total_marks_possible=float(result.total_marks_possible),
            percentage=float(result.percentage),
            grade=result.grade,
            rank=result.rank,
            result=_value(result.result) or "PASS",
        )

    @staticmethod
    async def result_detail(
        db: AsyncSession, student: User, result_id: uuid.UUID
    ) -> StudentResultDetail:
        scope = await StudentService.scope_for_user(db, student)
        row = (
            await db.execute(
                select(StudentResult, ResultPublication, SchoolClass.name)
                .join(ResultPublication, ResultPublication.id == StudentResult.publication_id)
                .join(SchoolClass, SchoolClass.id == StudentResult.class_id)
                .where(
                    StudentResult.id == result_id,
                    StudentResult.tenant_id == scope.tenant_id,
                    StudentResult.student_id == scope.student_id,
                    ResultPublication.is_visible_to_students.is_(True),
                    ResultPublication.approval_status == "APPROVED",
                )
            )
        ).first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Result not found")
        result, publication, class_name = row
        base = StudentService._result_row(result, publication)

        subjects: list[StudentResultSubject] = []
        raw = result.subject_scores
        entries = raw if isinstance(raw, list) else (raw or {}).get("subjects", [])
        for entry in entries if isinstance(entries, list) else []:
            if not isinstance(entry, dict):
                continue
            subjects.append(
                StudentResultSubject(
                    subject_code=entry.get("subject_code") or entry.get("code"),
                    subject_name=entry.get("subject_name") or entry.get("name"),
                    marks_obtained=entry.get("marks_obtained") or entry.get("obtained"),
                    marks_possible=entry.get("marks_possible") or entry.get("possible"),
                    grade=entry.get("grade"),
                )
            )

        return StudentResultDetail(
            **base.model_dump(),
            class_name=class_name,
            remarks=result.remarks,
            subjects=subjects,
        )

    # ── C-ST-18 notices ─────────────────────────────────────────────────────

    @staticmethod
    def _notice_clauses(scope: StudentScope) -> list:
        now = datetime.now(timezone.utc)
        return [
            Notice.tenant_id == scope.tenant_id,
            Notice.deleted_at.is_(None),
            or_(Notice.expires_at.is_(None), Notice.expires_at > now),
            or_(
                Notice.target_scope == NoticeScope.INSTITUTION,
                and_(
                    Notice.target_scope == NoticeScope.DEPARTMENT,
                    Notice.target_id == scope.department_id,
                ),
                and_(
                    Notice.target_scope == NoticeScope.CLASS,
                    Notice.target_id == scope.class_id,
                ),
            ),
        ]

    @staticmethod
    async def notices(
        db: AsyncSession,
        student: User,
        *,
        scope: StudentScope | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> StudentNoticePage:
        scope = scope or await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = StudentService._notice_clauses(scope)
        total = int((await db.execute(select(func.count(Notice.id)).where(*clauses))).scalar() or 0)
        read_ids = {
            notice_id
            for notice_id in (
                await db.execute(
                    select(NoticeRead.notice_id).where(NoticeRead.user_id == scope.student_id)
                )
            )
            .scalars()
            .all()
        }
        rows = (
            await db.execute(
                select(Notice, User.name)
                .outerjoin(
                    User, and_(User.id == Notice.author_id, User.tenant_id == scope.tenant_id)
                )
                .where(*clauses)
                .order_by(Notice.is_pinned.desc(), Notice.published_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return StudentNoticePage(
            total=total,
            limit=limit,
            offset=offset,
            unread_count=max(total - len(read_ids), 0),
            items=[
                StudentNoticeRow(
                    id=notice.id,
                    title=notice.title,
                    body=notice.body,
                    author_name=author,
                    target_scope=_value(notice.target_scope) or "INSTITUTION",
                    priority=_value(notice.priority) or "NORMAL",
                    is_pinned=notice.is_pinned,
                    published_at=notice.published_at,
                    expires_at=notice.expires_at,
                    is_read=notice.id in read_ids,
                )
                for notice, author in rows
            ],
        )

    @staticmethod
    async def mark_notice_read(
        db: AsyncSession, student: User, notice_id: uuid.UUID
    ) -> None:
        scope = await StudentService.scope_for_user(db, student)
        visible = (
            await db.execute(
                select(func.count(Notice.id)).where(
                    Notice.id == notice_id, *StudentService._notice_clauses(scope)
                )
            )
        ).scalar() or 0
        if not visible:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notice not found")
        db.add(NoticeRead(id=uuid.uuid4(), notice_id=notice_id, user_id=scope.student_id))
        try:
            await db.commit()
        except IntegrityError:
            # Already read — the unique key makes this idempotent.
            await db.rollback()

    # ── C-ST-19 discussion ──────────────────────────────────────────────────

    @staticmethod
    def _thread_scope_clause(scope: StudentScope):
        return or_(
            and_(
                DiscussionThread.scope_type == "CLASS",
                DiscussionThread.scope_id == scope.class_id,
            ),
            and_(
                DiscussionThread.scope_type == "SUBJECT",
                DiscussionThread.scope_id.in_(scope.subject_ids or {uuid.uuid4()}),
            ),
        )

    @staticmethod
    async def threads(
        db: AsyncSession,
        student: User,
        *,
        query: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> StudentThreadPage:
        scope = await StudentService.scope_for_user(db, student)
        limit, offset = _page_bounds(limit, offset)
        clauses = [
            DiscussionThread.tenant_id == scope.tenant_id,
            DiscussionThread.deleted_at.is_(None),
            StudentService._thread_scope_clause(scope),
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
        voted = await StudentService._voted_ids(
            db, scope, "THREAD", [thread.id for thread, _ in rows]
        )
        names = await StudentService._scope_names(db, scope, [thread for thread, _ in rows])
        return StudentThreadPage(
            total=total,
            limit=limit,
            offset=offset,
            items=[
                StudentService._thread_row(thread, author, names.get(thread.scope_id), scope, voted)
                for thread, author in rows
            ],
        )

    @staticmethod
    async def _voted_ids(
        db: AsyncSession, scope: StudentScope, target_type: str, ids: Sequence[uuid.UUID]
    ) -> set[uuid.UUID]:
        if not ids:
            return set()
        return {
            target_id
            for target_id in (
                await db.execute(
                    select(DiscussionVote.target_id).where(
                        DiscussionVote.user_id == scope.student_id,
                        DiscussionVote.target_type == target_type,
                        DiscussionVote.target_id.in_(ids),
                    )
                )
            )
            .scalars()
            .all()
        }

    @staticmethod
    async def _scope_names(
        db: AsyncSession, scope: StudentScope, threads: Sequence[DiscussionThread]
    ) -> dict[uuid.UUID, str]:
        names = {scope.class_id: scope.class_name}
        subject_ids = {t.scope_id for t in threads if t.scope_type == "SUBJECT"}
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
        thread: DiscussionThread,
        author_name: str | None,
        scope_name: str | None,
        scope: StudentScope,
        voted: set[uuid.UUID],
    ) -> StudentThreadRow:
        return StudentThreadRow(
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
            has_upvoted=thread.id in voted,
            is_mine=thread.author_id == scope.student_id,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
        )

    @staticmethod
    async def thread_detail(
        db: AsyncSession, student: User, thread_id: uuid.UUID
    ) -> StudentThreadDetail:
        scope = await StudentService.scope_for_user(db, student)
        thread = await StudentService._ensure_thread(db, scope, thread_id)
        thread.view_count += 1
        author = (
            await db.execute(select(User.name).where(User.id == thread.author_id))
        ).scalar_one_or_none()
        replies = (
            await db.execute(
                select(DiscussionReply, User.name)
                .outerjoin(User, User.id == DiscussionReply.author_id)
                .where(
                    DiscussionReply.tenant_id == scope.tenant_id,
                    DiscussionReply.thread_id == thread.id,
                    DiscussionReply.deleted_at.is_(None),
                )
                .order_by(DiscussionReply.is_accepted_answer.desc(), DiscussionReply.created_at)
            )
        ).all()
        thread_voted = await StudentService._voted_ids(db, scope, "THREAD", [thread.id])
        reply_voted = await StudentService._voted_ids(
            db, scope, "REPLY", [reply.id for reply, _ in replies]
        )
        names = await StudentService._scope_names(db, scope, [thread])
        await db.commit()

        base = StudentService._thread_row(
            thread, author, names.get(thread.scope_id), scope, thread_voted
        )
        return StudentThreadDetail(
            **base.model_dump(),
            replies=[
                StudentReplyRow(
                    id=reply.id,
                    author_id=reply.author_id,
                    author_name=reply_author,
                    body=reply.body,
                    is_accepted_answer=reply.is_accepted_answer,
                    upvote_count=reply.upvote_count,
                    has_upvoted=reply.id in reply_voted,
                    is_mine=reply.author_id == scope.student_id,
                    created_at=reply.created_at,
                )
                for reply, reply_author in replies
            ],
        )

    @staticmethod
    async def create_thread(
        db: AsyncSession, student: User, payload: StudentThreadCreate
    ) -> StudentThreadDetail:
        scope = await StudentService.scope_for_user(db, student)
        # A student may only open a thread in their own class or one of its
        # subjects; there is no free-text scope.
        scope_type = "SUBJECT" if payload.subject_id else "CLASS"
        scope_id = (
            scope.require_subject(payload.subject_id) if payload.subject_id else scope.class_id
        )
        thread = DiscussionThread(
            id=uuid.uuid4(),
            tenant_id=scope.tenant_id,
            title=payload.title.strip(),
            body=payload.body.strip(),
            author_id=scope.student_id,
            scope_type=scope_type,
            scope_id=scope_id,
            tags=[tag.strip() for tag in payload.tags if tag.strip()] or None,
        )
        db.add(thread)
        await db.commit()
        return await StudentService.thread_detail(db, student, thread.id)

    @staticmethod
    async def reply_to_thread(
        db: AsyncSession, student: User, thread_id: uuid.UUID, payload: StudentReplyCreate
    ) -> StudentThreadDetail:
        scope = await StudentService.scope_for_user(db, student)
        thread = await StudentService._ensure_thread(db, scope, thread_id)
        if thread.is_locked:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="This thread is locked")
        db.add(
            DiscussionReply(
                id=uuid.uuid4(),
                tenant_id=scope.tenant_id,
                thread_id=thread.id,
                author_id=scope.student_id,
                body=payload.body.strip(),
            )
        )
        thread.reply_count += 1
        await db.commit()
        return await StudentService.thread_detail(db, student, thread_id)

    @staticmethod
    async def vote(
        db: AsyncSession, student: User, payload: StudentVote
    ) -> StudentThreadDetail:
        """Toggle one upvote. The unique key makes double-voting impossible."""
        scope = await StudentService.scope_for_user(db, student)
        if payload.target_type == "THREAD":
            thread = await StudentService._ensure_thread(db, scope, payload.target_id)
            target = thread
            thread_id = thread.id
        else:
            reply = (
                await db.execute(
                    select(DiscussionReply).where(
                        DiscussionReply.id == payload.target_id,
                        DiscussionReply.tenant_id == scope.tenant_id,
                        DiscussionReply.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if reply is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Reply not found")
            await StudentService._ensure_thread(db, scope, reply.thread_id)
            target = reply
            thread_id = reply.thread_id

        existing = (
            await db.execute(
                select(DiscussionVote).where(
                    DiscussionVote.user_id == scope.student_id,
                    DiscussionVote.target_type == payload.target_type,
                    DiscussionVote.target_id == payload.target_id,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            await db.delete(existing)
            target.upvote_count = max(target.upvote_count - 1, 0)
        else:
            db.add(
                DiscussionVote(
                    id=uuid.uuid4(),
                    user_id=scope.student_id,
                    target_type=payload.target_type,
                    target_id=payload.target_id,
                )
            )
            target.upvote_count += 1
        await db.commit()
        return await StudentService.thread_detail(db, student, thread_id)

    @staticmethod
    async def _ensure_thread(
        db: AsyncSession, scope: StudentScope, thread_id: uuid.UUID
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
        in_scope = (thread.scope_type == "CLASS" and thread.scope_id == scope.class_id) or (
            thread.scope_type == "SUBJECT" and thread.scope_id in scope.subject_ids
        )
        if not in_scope:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Thread not found")
        return thread

    # ── C-ST-20 fees ────────────────────────────────────────────────────────

    @staticmethod
    async def fees(
        db: AsyncSession, student: User, *, scope: StudentScope | None = None
    ) -> StudentFeeAccountView:
        scope = scope or await StudentService.scope_for_user(db, student)
        row = (
            await db.execute(
                select(StudentFeeAccount, AcademicYear.name)
                .outerjoin(AcademicYear, AcademicYear.id == StudentFeeAccount.academic_year_id)
                .where(
                    StudentFeeAccount.tenant_id == scope.tenant_id,
                    StudentFeeAccount.student_id == scope.student_id,
                )
                .order_by(StudentFeeAccount.created_at.desc())
                .limit(1)
            )
        ).first()
        if row is None:
            # Finance may simply not be switched on for this tenant. That is a
            # normal state, not an error page.
            return StudentFeeAccountView(has_account=False)
        account, year_name = row

        today = await PrincipalService._tenant_today(db, scope.tenant_id)
        installments = (
            await db.execute(
                select(FeeInstallment)
                .where(
                    FeeInstallment.tenant_id == scope.tenant_id,
                    FeeInstallment.fee_account_id == account.id,
                )
                .order_by(FeeInstallment.installment_number)
            )
        ).scalars().all()
        payments = (
            await db.execute(
                select(FeePayment)
                .where(
                    FeePayment.tenant_id == scope.tenant_id,
                    FeePayment.fee_account_id == account.id,
                )
                .order_by(FeePayment.payment_date.desc())
            )
        ).scalars().all()

        return StudentFeeAccountView(
            has_account=True,
            academic_year=year_name,
            total_fee=_decimal(account.total_fee),
            concession_amount=_decimal(account.concession_amount),
            scholarship_amount=_decimal(account.scholarship_amount),
            net_payable=_decimal(account.net_payable),
            total_paid=_decimal(account.total_paid),
            balance_due=_decimal(account.balance_due),
            status=account.status,
            installments=[
                StudentInstallmentRow(
                    id=item.id,
                    installment_number=item.installment_number,
                    label=item.label,
                    amount=float(item.amount),
                    due_date=item.due_date,
                    paid_amount=float(item.paid_amount),
                    late_fine=float(item.late_fine),
                    status=item.status,
                    is_overdue=item.status != "PAID" and item.due_date < today,
                )
                for item in installments
            ],
            payments=[
                StudentPaymentRow(
                    id=payment.id,
                    amount=float(payment.amount),
                    payment_mode=payment.payment_mode,
                    transaction_reference=payment.transaction_reference,
                    payment_date=payment.payment_date,
                    receipt_number=payment.receipt_number,
                    notes=payment.notes,
                )
                for payment in payments
            ],
        )
