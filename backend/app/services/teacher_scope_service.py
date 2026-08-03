"""Row-level scope resolvers for the Teacher and Student consoles.

`ARCHITECTURE.md` §1 splits authorization into three questions and warns that
they are routinely conflated:

    RolesGuard   — may a TEACHER call this endpoint at all?     → 403
    ModuleGuard  — is this module switched on for the tenant?   → 403
    ScopeGuard   — is class c-42 one of *this* teacher's?       → 404

The role dependencies in ``app.dependencies.auth`` answer the first question.
This module answers the third, and it answers it with **404, not 403**: a 403
on ``/teacher/assignments/{id}`` confirms that the assignment exists, which is
enough to enumerate another department's coursework. For a resource keyed to a
person, an out-of-scope read must be indistinguishable from a missing one.

Two scopes live here because they are two sides of the same fence:

* ``TeacherScope``  — the subjects in ``teacher_subjects`` plus the classes
  those subjects belong to, and the classes the teacher owns outright via
  ``classes.class_teacher_id``.
* ``StudentScope``  — the caller's own ACTIVE enrolment: one class, one
  academic year, and the subjects taught to it.

Neither is ever derived from a JWT claim or a query parameter. A token says
who you are; the database says what you may touch.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import AcademicYear, SchoolClass, Subject
from app.models.enrollment import Enrollment, TeacherSubject
from app.models.user import User

__all__ = [
    "StudentScope",
    "StudentScopeService",
    "TeacherScope",
    "TeacherScopeService",
]


# A teacher with no `teacher_subjects` row and no class of their own has an
# empty scope. That is a configuration problem an HOD fixes on /hod/teachers,
# and the console says so instead of showing an empty dashboard that looks
# like a bug.
_NO_TEACHING_SCOPE = (
    "No subjects or classes are assigned to this teacher. "
    "Ask your HOD to assign you to a subject on the department teachers page."
)

_NO_ENROLMENT = (
    "No active enrolment was found for this student in the current academic year. "
    "Ask the institution admin to enrol you in a class."
)


@dataclass(frozen=True)
class TeacherScope:
    """Everything a teacher may reach, resolved once per request."""

    teacher_id: uuid.UUID
    tenant_id: uuid.UUID
    subject_ids: frozenset[uuid.UUID]
    class_ids: frozenset[uuid.UUID]
    #: Classes where this teacher is the class teacher (`classes.class_teacher_id`).
    #: A wider grant than a subject link: it is what lets them review student
    #: leave for the whole class (C-TC-06), not just their own periods.
    owned_class_ids: frozenset[uuid.UUID]
    academic_year_id: uuid.UUID | None
    academic_year_name: str | None

    def owns_subject(self, subject_id: uuid.UUID | None) -> bool:
        return subject_id is not None and subject_id in self.subject_ids

    def owns_class(self, class_id: uuid.UUID | None) -> bool:
        return class_id is not None and class_id in self.class_ids

    def is_class_teacher_of(self, class_id: uuid.UUID | None) -> bool:
        return class_id is not None and class_id in self.owned_class_ids

    def require_subject(self, subject_id: uuid.UUID | None) -> uuid.UUID:
        if not self.owns_subject(subject_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        assert subject_id is not None  # narrowed by owns_subject
        return subject_id

    def require_class(self, class_id: uuid.UUID | None) -> uuid.UUID:
        if not self.owns_class(class_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Class not found")
        assert class_id is not None
        return class_id


@dataclass(frozen=True)
class StudentScope:
    """The single class a student is actively enrolled in, and its subjects."""

    student_id: uuid.UUID
    tenant_id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    department_id: uuid.UUID
    academic_year_id: uuid.UUID
    academic_year_name: str | None
    roll_number: str | None
    subject_ids: frozenset[uuid.UUID]

    def require_subject(self, subject_id: uuid.UUID | None) -> uuid.UUID:
        if subject_id is None or subject_id not in self.subject_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        return subject_id


class TeacherScopeService:
    @staticmethod
    async def resolve(db: AsyncSession, teacher: User) -> TeacherScope:
        """Load the teacher's subject and class reach from the database.

        One round trip per axis, all three filtered on ``tenant_id`` so a
        ``teacher_subjects`` row that survived a tenant migration cannot pull
        another institution's subject into scope.
        """
        year_row = (
            await db.execute(
                select(AcademicYear.id, AcademicYear.name)
                .where(
                    AcademicYear.tenant_id == teacher.tenant_id,
                    AcademicYear.is_current.is_(True),
                )
                .limit(1)
            )
        ).first()

        # Subject links, joined through subjects so the class comes along and a
        # dangling link to a deleted subject simply drops out.
        subject_rows = (
            await db.execute(
                select(Subject.id, Subject.class_id)
                .join(TeacherSubject, TeacherSubject.subject_id == Subject.id)
                .where(
                    TeacherSubject.teacher_id == teacher.id,
                    TeacherSubject.tenant_id == teacher.tenant_id,
                    Subject.tenant_id == teacher.tenant_id,
                    Subject.is_active.is_(True),
                )
            )
        ).all()

        owned_rows = (
            await db.execute(
                select(SchoolClass.id).where(
                    SchoolClass.tenant_id == teacher.tenant_id,
                    SchoolClass.class_teacher_id == teacher.id,
                    SchoolClass.is_active.is_(True),
                )
            )
        ).scalars().all()

        subject_ids = {subject_id for subject_id, _class_id in subject_rows}
        owned_class_ids = set(owned_rows)
        class_ids = {class_id for _subject_id, class_id in subject_rows} | owned_class_ids

        if not subject_ids and not owned_class_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_NO_TEACHING_SCOPE)

        return TeacherScope(
            teacher_id=teacher.id,
            tenant_id=teacher.tenant_id,
            subject_ids=frozenset(subject_ids),
            class_ids=frozenset(class_ids),
            owned_class_ids=frozenset(owned_class_ids),
            academic_year_id=year_row[0] if year_row else None,
            academic_year_name=year_row[1] if year_row else None,
        )


class StudentScopeService:
    @staticmethod
    async def resolve(db: AsyncSession, student: User) -> StudentScope:
        """Resolve the caller's own ACTIVE enrolment; never accept one by id.

        Preference goes to the enrolment in the tenant's current academic year.
        A student who has rolled over but whose new enrolment is not yet in
        place still sees their most recent class rather than an error page.
        """
        rows = (
            await db.execute(
                select(
                    Enrollment.class_id,
                    Enrollment.academic_year_id,
                    Enrollment.roll_number,
                    SchoolClass.name,
                    SchoolClass.department_id,
                    AcademicYear.name,
                    AcademicYear.is_current,
                )
                .join(SchoolClass, SchoolClass.id == Enrollment.class_id)
                .join(AcademicYear, AcademicYear.id == Enrollment.academic_year_id)
                .where(
                    Enrollment.student_id == student.id,
                    Enrollment.tenant_id == student.tenant_id,
                    Enrollment.status == "ACTIVE",
                    SchoolClass.tenant_id == student.tenant_id,
                )
                .order_by(AcademicYear.is_current.desc(), AcademicYear.start_date.desc())
                .limit(1)
            )
        ).first()

        if rows is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=_NO_ENROLMENT)

        class_id, year_id, roll_number, class_name, department_id, year_name, _current = rows

        subject_ids = (
            await db.execute(
                select(Subject.id).where(
                    Subject.tenant_id == student.tenant_id,
                    Subject.class_id == class_id,
                    Subject.is_active.is_(True),
                )
            )
        ).scalars().all()

        return StudentScope(
            student_id=student.id,
            tenant_id=student.tenant_id,
            class_id=class_id,
            class_name=class_name,
            department_id=department_id,
            academic_year_id=year_id,
            academic_year_name=year_name,
            roll_number=roll_number,
            subject_ids=frozenset(subject_ids),
        )
