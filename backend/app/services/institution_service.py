"""
Services — Institution Admin management

The day-to-day API behind the institution admin role: dashboard counts,
academic structure (years, departments, classes, subjects), people
(staff/users, students, enrollments), modules, settings and the institution
profile. Everything is scoped to the admin's tenant and reads RBAC from
`role_assignments`.

Staff/student invites use the existing reset-token flow (SYSTEM-FLOW §4.1):
the new user is created with no password and a one-time reset token, and a
"set your password" email is queued in the outbox. The platform never knows
anyone's password.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings as get_app_settings
from app.models.academic import AcademicYear, Department, SchoolClass, Subject
from app.models.billing import Subscription, TenantModule, TenantSetting
from app.models.catalog import Module, Plan
from app.models.enrollment import Enrollment, TeacherSubject
from app.models.role import Role, RoleAssignment
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.institution import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
    ClassCreate,
    ClassOut,
    ClassUpdate,
    DashboardSummary,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    EnrollmentCreate,
    EnrollmentOut,
    InstitutionProfileOut,
    InstitutionProfileUpdate,
    ModuleOut,
    SettingsOut,
    SettingsUpdate,
    StaffInvite,
    StaffOut,
    StudentCreate,
    StudentOut,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
)
from app.services.audit_service import AuditService
from app.services.mailer import queue_email
from app.utils.security import generate_secure_token, hash_password, hash_token

ONBOARDING_KEY = "onboarding"
ONBOARDING_DONE_KEY = "onboarding.completed"


class InstitutionService:
    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    async def _tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
        res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = res.scalar_one_or_none()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        return tenant

    @staticmethod
    async def _flush_unique(db: AsyncSession, message: str) -> None:
        """Flush, translating a unique-constraint violation into a 409 Conflict
        so duplicates return a clean error instead of a 500."""
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, detail=message)

    @staticmethod
    async def _current_year(db: AsyncSession, tenant_id: uuid.UUID) -> AcademicYear | None:
        res = await db.execute(
            select(AcademicYear)
            .where(AcademicYear.tenant_id == tenant_id)
            .order_by(AcademicYear.is_current.desc(), AcademicYear.start_date.desc())
            .limit(1)
        )
        return res.scalar_one_or_none()

    @staticmethod
    async def _enabled_modules(db: AsyncSession, tenant_id: uuid.UUID) -> list[str]:
        """Enabled module keys. Core modules are always on even when no
        tenant_modules row exists yet (consistent with list_modules)."""
        cat_res = await db.execute(select(Module.key, Module.is_core))
        catalog = {row[0]: row[1] for row in cat_res.all()}
        res = await db.execute(
            select(TenantModule.module_key, TenantModule.is_enabled).where(
                TenantModule.tenant_id == tenant_id
            )
        )
        tm = {row[0]: row[1] for row in res.all()}
        return [key for key, is_core in catalog.items() if tm.get(key, is_core)]

    @staticmethod
    async def _counts(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, int]:
        async def count(stmt) -> int:
            res = await db.execute(stmt)
            return res.scalar() or 0

        return {
            "academic_years": await count(select(func.count(AcademicYear.id)).where(AcademicYear.tenant_id == tenant_id)),
            "departments": await count(select(func.count(Department.id)).where(Department.tenant_id == tenant_id, Department.is_active == True)),  # noqa: E712
            "classes": await count(select(func.count(SchoolClass.id)).where(SchoolClass.tenant_id == tenant_id, SchoolClass.is_active == True)),  # noqa: E712
            "subjects": await count(select(func.count(Subject.id)).where(Subject.tenant_id == tenant_id, Subject.is_active == True)),  # noqa: E712
            "staff": await count(
                select(func.count(User.id.distinct()))
                .select_from(User)
                .join(RoleAssignment, RoleAssignment.user_id == User.id)
                .join(Role, Role.id == RoleAssignment.role_id)
                .where(User.tenant_id == tenant_id, User.deleted_at == None, Role.name != "STUDENT")  # noqa: E712
            ),
            "students": await count(
                select(func.count(User.id.distinct()))
                .select_from(User)
                .join(RoleAssignment, RoleAssignment.user_id == User.id)
                .join(Role, Role.id == RoleAssignment.role_id)
                .where(User.tenant_id == tenant_id, User.deleted_at == None, Role.name == "STUDENT")  # noqa: E712
            ),
        }

    # ── Dashboard ────────────────────────────────────────────────────────────

    @staticmethod
    async def dashboard(db: AsyncSession, tenant_id: uuid.UUID) -> DashboardSummary:
        tenant = await InstitutionService._tenant(db, tenant_id)
        year = await InstitutionService._current_year(db, tenant_id)
        modules = await InstitutionService._enabled_modules(db, tenant_id)
        done = await InstitutionService._is_onboarded(db, tenant_id)
        return DashboardSummary(
            tenant_id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            type=tenant.type.value,
            academic_year=year.name if year else None,
            counts=await InstitutionService._counts(db, tenant_id),
            enabled_modules=modules,
            onboarding_complete=done,
        )

    @staticmethod
    async def _is_onboarded(db: AsyncSession, tenant_id: uuid.UUID) -> bool:
        res = await db.execute(
            select(TenantSetting.value).where(
                TenantSetting.tenant_id == tenant_id,
                TenantSetting.key == ONBOARDING_DONE_KEY,
            )
        )
        return (res.scalar() or "").lower() == "true"

    # ── Academic years ───────────────────────────────────────────────────────

    @staticmethod
    async def list_years(db: AsyncSession, tenant_id: uuid.UUID) -> list[AcademicYearOut]:
        res = await db.execute(
            select(AcademicYear)
            .where(AcademicYear.tenant_id == tenant_id)
            .order_by(AcademicYear.start_date.desc())
        )
        return [_year_out(y) for y in res.scalars().all()]

    @staticmethod
    async def create_year(db: AsyncSession, tenant_id: uuid.UUID, payload: AcademicYearCreate) -> AcademicYearOut:
        if payload.start_date >= payload.end_date:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="start_date must be before end_date")
        # Exactly one current year per tenant.
        if payload.is_current:
            await InstitutionService._unset_current_year(db, tenant_id)
        year = AcademicYear(
            id=uuid.uuid4(), tenant_id=tenant_id, name=payload.name,
            start_date=payload.start_date, end_date=payload.end_date, is_current=payload.is_current,
        )
        db.add(year)
        await InstitutionService._flush_unique(db, "An academic year with this name already exists")
        return _year_out(year)

    @staticmethod
    async def update_year(db: AsyncSession, tenant_id: uuid.UUID, year_id: uuid.UUID, payload: AcademicYearUpdate) -> AcademicYearOut:
        year = await InstitutionService._load_year(db, tenant_id, year_id)
        if payload.start_date and payload.end_date and payload.start_date >= payload.end_date:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="start_date must be before end_date")
        for f in ("name", "start_date", "end_date"):
            v = getattr(payload, f)
            if v is not None:
                setattr(year, f, v)
        if payload.is_current:
            await InstitutionService._unset_current_year(db, tenant_id, except_id=year.id)
            year.is_current = True
        elif payload.is_current is False:
            year.is_current = False
        await db.flush()
        return _year_out(year)

    @staticmethod
    async def delete_year(db: AsyncSession, tenant_id: uuid.UUID, year_id: uuid.UUID) -> None:
        year = await InstitutionService._load_year(db, tenant_id, year_id)
        if year.is_current:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Cannot delete the current academic year")
        await db.delete(year)

    @staticmethod
    async def _load_year(db, tenant_id, year_id) -> AcademicYear:
        res = await db.execute(select(AcademicYear).where(AcademicYear.id == year_id, AcademicYear.tenant_id == tenant_id))
        year = res.scalar_one_or_none()
        if year is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Academic year not found")
        return year

    @staticmethod
    async def _unset_current_year(db, tenant_id, except_id=None) -> None:
        res = await db.execute(select(AcademicYear).where(AcademicYear.tenant_id == tenant_id, AcademicYear.is_current == True))  # noqa: E712
        for y in res.scalars().all():
            if except_id and y.id == except_id:
                continue
            y.is_current = False

    # ── Departments ──────────────────────────────────────────────────────────

    @staticmethod
    async def list_departments(db: AsyncSession, tenant_id: uuid.UUID) -> list[DepartmentOut]:
        res = await db.execute(
            select(Department).where(Department.tenant_id == tenant_id).order_by(Department.name)
        )
        departments = list(res.scalars().all())
        names = await InstitutionService._user_names(db, [d.hod_id for d in departments if d.hod_id])
        class_counts = await InstitutionService._count_classes_by_dept(db, tenant_id)
        staff_counts = await InstitutionService._count_staff_by_dept(db, tenant_id)
        return [
            DepartmentOut(
                id=d.id, name=d.name, code=d.code, description=d.description,
                hod_id=d.hod_id, hod_name=names.get(d.hod_id), is_active=d.is_active,
                class_count=class_counts.get(d.id, 0), staff_count=staff_counts.get(d.id, 0),
            )
            for d in departments
        ]

    @staticmethod
    async def create_department(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        payload: DepartmentCreate,
        *,
        actor: User | None = None,
    ) -> DepartmentOut:
        if payload.hod_id is not None:
            await InstitutionService._assert_user_in_tenant(db, tenant_id, payload.hod_id)
        dept = Department(
            id=uuid.uuid4(), tenant_id=tenant_id, name=payload.name, code=payload.code.upper(),
            description=payload.description, hod_id=payload.hod_id, is_active=True,
        )
        db.add(dept)
        await InstitutionService._flush_unique(db, "A department with this code already exists")
        if dept.hod_id is not None:
            await InstitutionService._ensure_hod_department_scope(
                db, tenant_id, dept.hod_id, dept.id, actor=actor
            )
        return (await InstitutionService.list_departments(db, tenant_id))[0]

    @staticmethod
    async def update_department(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        dept_id: uuid.UUID,
        payload: DepartmentUpdate,
        *,
        actor: User | None = None,
    ) -> DepartmentOut:
        res = await db.execute(select(Department).where(Department.id == dept_id, Department.tenant_id == tenant_id))
        dept = res.scalar_one_or_none()
        if dept is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department not found")
        previous_hod_id = dept.hod_id
        if "hod_id" in payload.model_fields_set:
            if payload.hod_id is not None:
                await InstitutionService._assert_user_in_tenant(db, tenant_id, payload.hod_id)
            dept.hod_id = payload.hod_id
        for f in ("name", "description", "is_active"):
            v = getattr(payload, f)
            if v is not None:
                setattr(dept, f, v)
        await db.flush()
        if previous_hod_id is not None and previous_hod_id != dept.hod_id:
            await InstitutionService._deactivate_hod_department_scope(
                db, tenant_id, previous_hod_id, dept.id, actor=actor
            )
        if dept.hod_id is not None:
            await InstitutionService._ensure_hod_department_scope(
                db, tenant_id, dept.hod_id, dept.id, actor=actor
            )
        rows = await InstitutionService.list_departments(db, tenant_id)
        return next((r for r in rows if r.id == dept_id), rows[0])

    @staticmethod
    async def delete_department(db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID) -> None:
        res = await db.execute(select(Department).where(Department.id == dept_id, Department.tenant_id == tenant_id))
        dept = res.scalar_one_or_none()
        if dept is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department not found")
        cls = await db.execute(select(SchoolClass.id).where(SchoolClass.department_id == dept_id).limit(1))
        if cls.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Department still has classes; remove them first")
        await db.delete(dept)

    # ── Classes ──────────────────────────────────────────────────────────────

    @staticmethod
    async def list_classes(db: AsyncSession, tenant_id: uuid.UUID) -> list[ClassOut]:
        res = await db.execute(
            select(SchoolClass).where(SchoolClass.tenant_id == tenant_id).order_by(SchoolClass.name)
        )
        classes = list(res.scalars().all())
        dept_names = await InstitutionService._entity_names(db, Department, [c.department_id for c in classes])
        year_names = await InstitutionService._entity_names(db, AcademicYear, [c.academic_year_id for c in classes])
        teacher_names = await InstitutionService._user_names(db, [c.class_teacher_id for c in classes if c.class_teacher_id])
        enrolled = await InstitutionService._count_enrolled_by_class(db, tenant_id)
        subject_counts = await InstitutionService._count_subjects_by_class(db, tenant_id)
        return [
            ClassOut(
                id=c.id, name=c.name, code=c.code, department_id=c.department_id,
                department_name=dept_names.get(c.department_id), academic_year_id=c.academic_year_id,
                academic_year_name=year_names.get(c.academic_year_id), max_strength=c.max_strength,
                room_no=c.room_no, class_teacher_id=c.class_teacher_id,
                class_teacher_name=teacher_names.get(c.class_teacher_id), is_active=c.is_active,
                enrolled_count=enrolled.get(c.id, 0), subject_count=subject_counts.get(c.id, 0),
            )
            for c in classes
        ]

    @staticmethod
    async def create_class(db: AsyncSession, tenant_id: uuid.UUID, payload: ClassCreate) -> ClassOut:
        await InstitutionService._assert_dept(db, tenant_id, payload.department_id)
        await InstitutionService._assert_year(db, tenant_id, payload.academic_year_id)
        if payload.class_teacher_id is not None:
            await InstitutionService._assert_user_in_tenant(db, tenant_id, payload.class_teacher_id)
        cls = SchoolClass(
            id=uuid.uuid4(), tenant_id=tenant_id, name=payload.name, code=payload.code.upper(),
            department_id=payload.department_id, academic_year_id=payload.academic_year_id,
            max_strength=payload.max_strength, room_no=payload.room_no, class_teacher_id=payload.class_teacher_id,
            is_active=True,
        )
        db.add(cls)
        await InstitutionService._flush_unique(db, "A class with this code already exists")
        rows = await InstitutionService.list_classes(db, tenant_id)
        return next((r for r in rows if r.name == payload.name and r.code == payload.code.upper()), rows[0])

    @staticmethod
    async def update_class(db: AsyncSession, tenant_id: uuid.UUID, class_id: uuid.UUID, payload: ClassUpdate) -> ClassOut:
        res = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id, SchoolClass.tenant_id == tenant_id))
        cls = res.scalar_one_or_none()
        if cls is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Class not found")
        if payload.class_teacher_id is not None:
            await InstitutionService._assert_user_in_tenant(db, tenant_id, payload.class_teacher_id)
            cls.class_teacher_id = payload.class_teacher_id
        for f in ("name", "max_strength", "room_no", "is_active"):
            v = getattr(payload, f)
            if v is not None:
                setattr(cls, f, v)
        await db.flush()
        rows = await InstitutionService.list_classes(db, tenant_id)
        return next((r for r in rows if r.id == class_id), rows[0])

    @staticmethod
    async def delete_class(db: AsyncSession, tenant_id: uuid.UUID, class_id: uuid.UUID) -> None:
        res = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id, SchoolClass.tenant_id == tenant_id))
        cls = res.scalar_one_or_none()
        if cls is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Class not found")
        await db.delete(cls)

    # ── Subjects ─────────────────────────────────────────────────────────────

    @staticmethod
    async def list_subjects(db: AsyncSession, tenant_id: uuid.UUID) -> list[SubjectOut]:
        res = await db.execute(
            select(Subject).where(Subject.tenant_id == tenant_id).order_by(Subject.name)
        )
        subjects = list(res.scalars().all())
        class_names = await InstitutionService._entity_names(db, SchoolClass, [s.class_id for s in subjects])
        teachers = await InstitutionService._subject_teachers(db, tenant_id)
        return [
            SubjectOut(
                id=s.id, name=s.name, code=s.code, class_id=s.class_id,
                class_name=class_names.get(s.class_id), subject_type=s.subject_type,
                credits=s.credits, max_marks=s.max_marks, passing_marks=s.passing_marks,
                is_active=s.is_active, teachers=teachers.get(s.id, []),
            )
            for s in subjects
        ]

    @staticmethod
    async def create_subject(db: AsyncSession, tenant_id: uuid.UUID, payload: SubjectCreate) -> SubjectOut:
        await InstitutionService._assert_class(db, tenant_id, payload.class_id)
        subj = Subject(
            id=uuid.uuid4(), tenant_id=tenant_id, name=payload.name, code=payload.code.upper(),
            class_id=payload.class_id, subject_type=payload.subject_type, credits=payload.credits,
            max_marks=payload.max_marks, passing_marks=payload.passing_marks, is_active=True,
        )
        db.add(subj)
        await InstitutionService._flush_unique(db, "A subject with this code already exists")
        rows = await InstitutionService.list_subjects(db, tenant_id)
        return next((r for r in rows if r.code == payload.code.upper()), rows[0])

    @staticmethod
    async def update_subject(db: AsyncSession, tenant_id: uuid.UUID, subject_id: uuid.UUID, payload: SubjectUpdate) -> SubjectOut:
        res = await db.execute(select(Subject).where(Subject.id == subject_id, Subject.tenant_id == tenant_id))
        subj = res.scalar_one_or_none()
        if subj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        for f in ("name", "subject_type", "credits", "max_marks", "passing_marks", "is_active"):
            v = getattr(payload, f)
            if v is not None:
                setattr(subj, f, v)
        await db.flush()
        rows = await InstitutionService.list_subjects(db, tenant_id)
        return next((r for r in rows if r.id == subject_id), rows[0])

    @staticmethod
    async def delete_subject(db: AsyncSession, tenant_id: uuid.UUID, subject_id: uuid.UUID) -> None:
        res = await db.execute(select(Subject).where(Subject.id == subject_id, Subject.tenant_id == tenant_id))
        subj = res.scalar_one_or_none()
        if subj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Subject not found")
        await db.delete(subj)

    # ── People: staff ────────────────────────────────────────────────────────

    @staticmethod
    async def list_staff(db: AsyncSession, tenant_id: uuid.UUID) -> list[StaffOut]:
        res = await db.execute(
            select(User)
            .join(RoleAssignment, RoleAssignment.user_id == User.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(User.tenant_id == tenant_id, User.deleted_at == None, Role.name != "STUDENT")  # noqa: E712
            .order_by(User.name)
        )
        users = list({u.id: u for u in res.scalars().all()}.values())
        return [await InstitutionService._staff_out(db, tenant_id, u) for u in users]

    @staticmethod
    async def invite_staff(
        db: AsyncSession,
        tenant: Tenant,
        payload: StaffInvite,
        *,
        actor: User | None = None,
    ) -> StaffOut:
        email = str(payload.email).lower()
        existing = await db.execute(select(User).where(User.tenant_id == tenant.id, User.email == email))
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with this email already exists")
        role = await InstitutionService._role_by_name(db, payload.role)
        if role is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown role '{payload.role}'")
        if payload.department_id is not None:
            await InstitutionService._assert_dept(db, tenant.id, payload.department_id)
        if role.name == "VICE_PRINCIPAL" and payload.department_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A Vice Principal must be assigned at least one delegated department",
            )

        raw_token = generate_secure_token(32)
        user = User(
            id=uuid.uuid4(), tenant_id=tenant.id, name=payload.name, email=email, phone=payload.phone,
            password_hash=None, is_active=True,
            password_reset_token=hash_token(raw_token),
            password_reset_expires=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(user)
        await db.flush()
        assignment = RoleAssignment(
            id=uuid.uuid4(), user_id=user.id, role_id=role.id, tenant_id=tenant.id,
            scope_id=payload.department_id, scope_type="DEPARTMENT" if payload.department_id else None,
            assigned_by=actor.id if actor else None,
            assigned_at=datetime.now(timezone.utc), is_active=True,
        )
        db.add(assignment)
        await InstitutionService._queue_invite_email(db, tenant, user, raw_token)
        await db.flush()
        if actor is not None:
            AuditService.record(
                db,
                actor=actor,
                actor_role="INSTITUTION_ADMIN",
                action="INVITE_STAFF",
                entity="User",
                entity_id=user.id,
                tenant_id=tenant.id,
                new_value={
                    "name": user.name,
                    "email": user.email,
                    "role_name": role.name,
                    "department_id": str(payload.department_id) if payload.department_id else None,
                },
            )
        return await InstitutionService._staff_out(db, tenant.id, user)

    @staticmethod
    async def assign_role(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        role_name: str,
        by: User,
        *,
        department_id: uuid.UUID | None = None,
    ) -> StaffOut:
        user = await InstitutionService._load_user(db, tenant_id, user_id)
        role = await InstitutionService._role_by_name(db, role_name)
        if role is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Unknown role '{role_name}'")
        if department_id is not None:
            await InstitutionService._assert_dept(db, tenant_id, department_id)
        if role.name == "VICE_PRINCIPAL" and department_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A Vice Principal must be assigned at least one delegated department",
            )

        scope_filter = (
            RoleAssignment.scope_id == department_id
            if department_id is not None
            else RoleAssignment.scope_id.is_(None)
        )
        exists = (
            await db.execute(
                select(RoleAssignment).where(
                    RoleAssignment.user_id == user_id,
                    RoleAssignment.role_id == role.id,
                    RoleAssignment.tenant_id == tenant_id,
                    scope_filter,
                )
            )
        ).scalar_one_or_none()
        if exists is None:
            assignment = RoleAssignment(
                id=uuid.uuid4(),
                user_id=user_id,
                role_id=role.id,
                tenant_id=tenant_id,
                scope_id=department_id,
                scope_type="DEPARTMENT" if department_id is not None else None,
                assigned_by=by.id,
                assigned_at=datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(assignment)
            await db.flush()
            AuditService.record(
                db,
                actor=by,
                actor_role="INSTITUTION_ADMIN",
                action="ASSIGN_ROLE",
                entity="RoleAssignment",
                entity_id=assignment.id,
                tenant_id=tenant_id,
                new_value={
                    "user_id": str(user_id),
                    "role_name": role.name,
                    "department_id": str(department_id) if department_id else None,
                },
            )
        elif not exists.is_active:
            exists.is_active = True
            exists.assigned_by = by.id
            exists.assigned_at = datetime.now(timezone.utc)
            await db.flush()
            AuditService.record(
                db,
                actor=by,
                actor_role="INSTITUTION_ADMIN",
                action="ASSIGN_ROLE",
                entity="RoleAssignment",
                entity_id=exists.id,
                tenant_id=tenant_id,
                new_value={
                    "user_id": str(user_id),
                    "role_name": role.name,
                    "department_id": str(department_id) if department_id else None,
                },
            )
        return await InstitutionService._staff_out(db, tenant_id, user)

    @staticmethod
    async def revoke_role(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        role_name: str,
        actor: User,
        *,
        department_id: uuid.UUID | None = None,
    ) -> StaffOut:
        """Deactivate one role grant without deleting its audit history.

        Vice Principal grants are department-scoped; revoking one department
        must not accidentally remove a separate delegated department.
        """
        user = await InstitutionService._load_user(db, tenant_id, user_id)
        role = await InstitutionService._role_by_name(db, role_name)
        if role is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role not found")
        if role.name == "VICE_PRINCIPAL" and department_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A delegated department is required to revoke a Vice Principal scope",
            )
        if department_id is not None:
            await InstitutionService._assert_dept(db, tenant_id, department_id)
        scope_filter = (
            RoleAssignment.scope_id == department_id
            if department_id is not None
            else RoleAssignment.scope_id.is_(None)
        )
        assignment = (
            await db.execute(
                select(RoleAssignment).where(
                    RoleAssignment.user_id == user_id,
                    RoleAssignment.role_id == role.id,
                    RoleAssignment.tenant_id == tenant_id,
                    RoleAssignment.is_active.is_(True),
                    scope_filter,
                )
            )
        ).scalar_one_or_none()
        if assignment is None:
            # 404 keeps other scope identifiers indistinguishable from absent.
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Active role assignment not found")
        assignment.is_active = False
        await db.flush()
        AuditService.record(
            db,
            actor=actor,
            actor_role="INSTITUTION_ADMIN",
            action="REVOKE_ROLE",
            entity="RoleAssignment",
            entity_id=assignment.id,
            tenant_id=tenant_id,
            old_value={
                "user_id": str(user_id),
                "role_name": role.name,
                "department_id": str(department_id) if department_id else None,
            },
        )
        return await InstitutionService._staff_out(db, tenant_id, user)


    @staticmethod
    async def set_user_active(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, active: bool) -> StaffOut:
        user = await InstitutionService._load_user(db, tenant_id, user_id)
        user.is_active = active
        await db.flush()
        return await InstitutionService._staff_out(db, tenant_id, user)

    # ── People: students ─────────────────────────────────────────────────────

    @staticmethod
    async def list_students(db: AsyncSession, tenant_id: uuid.UUID) -> list[StudentOut]:
        res = await db.execute(
            select(User)
            .join(RoleAssignment, RoleAssignment.user_id == User.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(User.tenant_id == tenant_id, User.deleted_at == None, Role.name == "STUDENT")  # noqa: E712
            .order_by(User.name)
        )
        students = list({u.id: u for u in res.scalars().all()}.values())
        enrollments = await InstitutionService._active_enrollments(db, tenant_id, [s.id for s in students])
        return [
            StudentOut(
                id=s.id, name=s.name, email=s.email, roll_no=s.student_roll_no,
                gender=s.gender.value if s.gender else None, is_active=s.is_active,
                enrollment=enrollments.get(s.id),
            )
            for s in students
        ]

    @staticmethod
    async def create_student(db: AsyncSession, tenant: Tenant, payload: StudentCreate) -> StudentOut:
        existing = await db.execute(
            select(User).where(User.tenant_id == tenant.id, User.student_roll_no == payload.roll_no)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="A student with this roll number already exists")
        role = await InstitutionService._role_by_name(db, "STUDENT")

        from app.models.user import Gender
        user = User(
            id=uuid.uuid4(), tenant_id=tenant.id, name=payload.name,
            email=str(payload.email).lower() if payload.email else None,
            student_roll_no=payload.roll_no, gender=Gender(payload.gender) if payload.gender else None,
            date_of_birth=payload.date_of_birth, password_hash=None, is_active=True,
        )
        db.add(user)
        await db.flush()
        if role is not None:
            db.add(RoleAssignment(
                id=uuid.uuid4(), user_id=user.id, role_id=role.id, tenant_id=tenant.id,
                assigned_at=datetime.now(timezone.utc), is_active=True,
            ))

        enrollment = None
        if payload.class_id is not None:
            await InstitutionService._assert_class(db, tenant.id, payload.class_id)
            year = await InstitutionService._current_year(db, tenant.id)
            if year is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Create an academic year before enrolling students")
            enrollment = await InstitutionService._enroll(db, tenant.id, user.id, payload.class_id, year.id, payload.roll_no)
        await db.flush()
        return StudentOut(
            id=user.id, name=user.name, email=user.email, roll_no=user.student_roll_no,
            gender=user.gender.value if user.gender else None, is_active=user.is_active, enrollment=enrollment,
        )

    # ── Enrollments ──────────────────────────────────────────────────────────

    @staticmethod
    async def list_enrollments(db: AsyncSession, tenant_id: uuid.UUID) -> list[EnrollmentOut]:
        res = await db.execute(
            select(Enrollment).where(Enrollment.tenant_id == tenant_id).order_by(Enrollment.enrollment_date.desc())
        )
        rows = list(res.scalars().all())
        student_names = await InstitutionService._user_names(db, [r.student_id for r in rows])
        class_names = await InstitutionService._entity_names(db, SchoolClass, [r.class_id for r in rows])
        year_names = await InstitutionService._entity_names(db, AcademicYear, [r.academic_year_id for r in rows])
        return [
            EnrollmentOut(
                id=r.id, student_id=r.student_id, student_name=student_names.get(r.student_id, "—"),
                class_id=r.class_id, class_name=class_names.get(r.class_id, "—"),
                academic_year_id=r.academic_year_id, academic_year_name=year_names.get(r.academic_year_id, "—"),
                roll_number=r.roll_number, status=r.status, enrollment_date=r.enrollment_date,
            )
            for r in rows
        ]

    @staticmethod
    async def create_enrollment(db: AsyncSession, tenant_id: uuid.UUID, payload: EnrollmentCreate) -> EnrollmentOut:
        await InstitutionService._assert_user_in_tenant(db, tenant_id, payload.student_id)
        await InstitutionService._assert_class(db, tenant_id, payload.class_id)
        year_id = payload.academic_year_id
        if year_id is None:
            year = await InstitutionService._current_year(db, tenant_id)
            if year is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No current academic year")
            year_id = year.id
        else:
            await InstitutionService._assert_year(db, tenant_id, year_id)
        enr = await InstitutionService._enroll(db, tenant_id, payload.student_id, payload.class_id, year_id, payload.roll_number)
        await db.flush()
        rows = await InstitutionService.list_enrollments(db, tenant_id)
        return next((r for r in rows if r.student_id == payload.student_id and r.class_id == payload.class_id), rows[0])

    @staticmethod
    async def _enroll(db, tenant_id, student_id, class_id, year_id, roll_number) -> dict:
        existing = await db.execute(
            select(Enrollment).where(
                Enrollment.student_id == student_id, Enrollment.class_id == class_id,
                Enrollment.academic_year_id == year_id,
            )
        )
        row = existing.scalar_one_or_none()
        if row is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Student is already enrolled in this class for the year")
        enr = Enrollment(
            id=uuid.uuid4(), tenant_id=tenant_id, student_id=student_id, class_id=class_id,
            academic_year_id=year_id, roll_number=roll_number, status="ACTIVE",
        )
        db.add(enr)
        await db.flush()
        cls_res = await db.execute(select(SchoolClass.name).where(SchoolClass.id == class_id))
        class_name = cls_res.scalar_one_or_none() or "—"
        return {
            "id": str(enr.id), "class_id": str(class_id), "class_name": class_name,
            "roll_number": roll_number, "status": enr.status,
        }

    # ── Modules ──────────────────────────────────────────────────────────────

    @staticmethod
    async def list_modules(db: AsyncSession, tenant_id: uuid.UUID) -> list[ModuleOut]:
        tenant = await InstitutionService._tenant(db, tenant_id)
        catalog = await db.execute(select(Module).order_by(Module.sort_order))
        catalog_rows = list(catalog.scalars().all())
        enabled = await db.execute(select(TenantModule).where(TenantModule.tenant_id == tenant_id))
        enabled_map = {tm.module_key: tm.is_enabled for tm in enabled.scalars().all()}
        return [
            ModuleOut(
                key=m.key, name=m.name, is_core=m.is_core,
                is_enabled=enabled_map.get(m.key, m.is_core),
                price_monthly=float(m.price_monthly or 0),
            )
            for m in catalog_rows
        ]

    @staticmethod
    async def toggle_module(db: AsyncSession, tenant: Tenant, module_key: str, enabled: bool) -> ModuleOut:
        """Plan-gated: a non-core module cannot be enabled beyond the plan."""
        mod_res = await db.execute(select(Module).where(Module.key == module_key))
        module = mod_res.scalar_one_or_none()
        if module is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Module not found")
        if module.is_core and not enabled:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Core modules cannot be disabled")

        if enabled and not module.is_core:
            plan_res = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
            plan = plan_res.scalar_one_or_none()
            allowed = set(plan.allowed_modules or []) if plan else set()
            if module.key not in allowed:
                raise HTTPException(
                    status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"{module.name} is not included in your plan. Upgrade to enable it.",
                )

        res = await db.execute(select(TenantModule).where(TenantModule.tenant_id == tenant.id, TenantModule.module_key == module_key))
        row = res.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if row is None:
            row = TenantModule(tenant_id=tenant.id, module_key=module_key, is_enabled=enabled, enabled_at=now)
            db.add(row)
        else:
            row.is_enabled = enabled
            if enabled:
                row.enabled_at = now
            else:
                row.disabled_at = now
        await db.flush()
        return ModuleOut(key=module.key, name=module.name, is_core=module.is_core, is_enabled=enabled, price_monthly=float(module.price_monthly or 0))

    # ── Settings + profile ───────────────────────────────────────────────────

    @staticmethod
    async def get_settings(db: AsyncSession, tenant_id: uuid.UUID) -> SettingsOut:
        res = await db.execute(select(TenantSetting).where(TenantSetting.tenant_id == tenant_id, TenantSetting.key.in_(["timezone", "currency"])))
        rows = {r.key: r.value for r in res.scalars().all()}
        return SettingsOut(
            timezone=rows.get("timezone", "Asia/Kolkata"),
            currency=rows.get("currency", "INR"),
            onboarding_complete=await InstitutionService._is_onboarded(db, tenant_id),
        )

    @staticmethod
    async def update_settings(db: AsyncSession, tenant_id: uuid.UUID, payload: SettingsUpdate) -> SettingsOut:
        for key, value in (("timezone", payload.timezone), ("currency", payload.currency)):
            if value is None:
                continue
            res = await db.execute(select(TenantSetting).where(TenantSetting.tenant_id == tenant_id, TenantSetting.key == key))
            row = res.scalar_one_or_none()
            if row is None:
                db.add(TenantSetting(tenant_id=tenant_id, key=key, value=value))
            else:
                row.value = value
        await db.flush()
        return await InstitutionService.get_settings(db, tenant_id)

    @staticmethod
    async def get_profile(db: AsyncSession, tenant_id: uuid.UUID) -> InstitutionProfileOut:
        tenant = await InstitutionService._tenant(db, tenant_id)
        plan_name = await InstitutionService._plan_name(db, tenant)
        sub_status = await InstitutionService._subscription_status(db, tenant_id)
        return InstitutionProfileOut(
            id=tenant.id, name=tenant.name, slug=tenant.slug, type=tenant.type.value,
            email=tenant.email, phone=tenant.phone, address=tenant.address, city=tenant.city,
            state=tenant.state, country=tenant.country, pincode=tenant.pincode, website=tenant.website,
            logo_url=tenant.logo_url, timezone=tenant.timezone, plan_name=plan_name, subscription_status=sub_status,
        )

    @staticmethod
    async def update_profile(db: AsyncSession, tenant_id: uuid.UUID, payload: InstitutionProfileUpdate) -> InstitutionProfileOut:
        tenant = await InstitutionService._tenant(db, tenant_id)
        for f in ("name", "email", "phone", "address", "city", "state", "pincode", "website", "logo_url"):
            v = getattr(payload, f)
            if v is not None:
                setattr(tenant, f, v)
        await db.flush()
        return await InstitutionService.get_profile(db, tenant_id)

    # ── small lookup helpers ─────────────────────────────────────────────────

    @staticmethod
    async def _user_names(db, ids: list[uuid.UUID]) -> dict:
        ids = [i for i in ids if i]
        if not ids:
            return {}
        res = await db.execute(select(User.id, User.name).where(User.id.in_(ids)))
        return {uid: name for uid, name in res.all()}

    @staticmethod
    async def _entity_names(db, model, ids: list[uuid.UUID]) -> dict:
        ids = [i for i in ids if i]
        if not ids:
            return {}
        res = await db.execute(select(model.id, model.name).where(model.id.in_(ids)))
        return {row[0]: row[1] for row in res.all()}

    @staticmethod
    async def _count_classes_by_dept(db, tenant_id) -> dict:
        res = await db.execute(select(SchoolClass.department_id, func.count(SchoolClass.id)).where(SchoolClass.tenant_id == tenant_id).group_by(SchoolClass.department_id))
        return {row[0]: row[1] for row in res.all()}

    @staticmethod
    async def _count_staff_by_dept(db, tenant_id) -> dict:
        res = await db.execute(
            select(RoleAssignment.scope_id, func.count(RoleAssignment.user_id.distinct()))
            .where(RoleAssignment.tenant_id == tenant_id, RoleAssignment.scope_type == "DEPARTMENT", RoleAssignment.is_active == True)  # noqa: E712
            .group_by(RoleAssignment.scope_id)
        )
        return {row[0]: row[1] for row in res.all()}

    @staticmethod
    async def _count_enrolled_by_class(db, tenant_id) -> dict:
        res = await db.execute(
            select(Enrollment.class_id, func.count(Enrollment.id))
            .where(Enrollment.tenant_id == tenant_id, Enrollment.status == "ACTIVE")
            .group_by(Enrollment.class_id)
        )
        return {row[0]: row[1] for row in res.all()}

    @staticmethod
    async def _count_subjects_by_class(db, tenant_id) -> dict:
        res = await db.execute(
            select(Subject.class_id, func.count(Subject.id))
            .where(Subject.tenant_id == tenant_id, Subject.is_active == True)  # noqa: E712
            .group_by(Subject.class_id)
        )
        return {row[0]: row[1] for row in res.all()}

    @staticmethod
    async def _subject_teachers(db, tenant_id) -> dict:
        res = await db.execute(
            select(TeacherSubject, User)
            .join(User, User.id == TeacherSubject.teacher_id)
            .where(TeacherSubject.tenant_id == tenant_id)
        )
        out: dict = {}
        for ts, teacher in res.all():
            out.setdefault(ts.subject_id, []).append(
                {"teacher_id": str(teacher.id), "teacher_name": teacher.name, "role": ts.role_in_subject}
            )
        return out

    @staticmethod
    async def _active_enrollments(db, tenant_id, student_ids) -> dict:
        if not student_ids:
            return {}
        res = await db.execute(
            select(Enrollment, SchoolClass).join(SchoolClass, SchoolClass.id == Enrollment.class_id)
            .where(Enrollment.tenant_id == tenant_id, Enrollment.student_id.in_(student_ids), Enrollment.status == "ACTIVE")
        )
        out: dict = {}
        for enr, cls in res.all():
            out[enr.student_id] = {"id": str(enr.id), "class_id": str(cls.id), "class_name": cls.name, "roll_number": enr.roll_number}
        return out

    @staticmethod
    async def _deactivate_hod_department_scope(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        hod_id: uuid.UUID,
        department_id: uuid.UUID,
        *,
        actor: User | None = None,
    ) -> None:
        role = await InstitutionService._role_by_name(db, "HOD")
        if role is None:
            return
        assignments = (
            await db.execute(
                select(RoleAssignment).where(
                    RoleAssignment.user_id == hod_id,
                    RoleAssignment.role_id == role.id,
                    RoleAssignment.tenant_id == tenant_id,
                    RoleAssignment.scope_id == department_id,
                    RoleAssignment.is_active.is_(True),
                )
            )
        ).scalars().all()
        for assignment in assignments:
            assignment.is_active = False
            if actor is not None:
                AuditService.record(
                    db,
                    actor=actor,
                    actor_role="INSTITUTION_ADMIN",
                    action="REVOKE_HOD_SCOPE",
                    entity="RoleAssignment",
                    entity_id=assignment.id,
                    tenant_id=tenant_id,
                    old_value={"hod_id": str(hod_id), "department_id": str(department_id)},
                )
        if assignments:
            await db.flush()

    @staticmethod
    async def _ensure_hod_department_scope(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        hod_id: uuid.UUID,
        department_id: uuid.UUID,
        *,
        actor: User | None = None,
    ) -> None:
        """Keep department.hod_id and the HOD role scope consistent."""
        role = await InstitutionService._role_by_name(db, "HOD")
        if role is None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="HOD role is not configured")
        existing = (
            await db.execute(
                select(RoleAssignment).where(
                    RoleAssignment.user_id == hod_id,
                    RoleAssignment.role_id == role.id,
                    RoleAssignment.tenant_id == tenant_id,
                    RoleAssignment.scope_id == department_id,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            assignment = RoleAssignment(
                id=uuid.uuid4(),
                user_id=hod_id,
                role_id=role.id,
                tenant_id=tenant_id,
                scope_id=department_id,
                scope_type="DEPARTMENT",
                assigned_by=actor.id if actor else None,
                assigned_at=datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(assignment)
            await db.flush()
            if actor is not None:
                AuditService.record(
                    db,
                    actor=actor,
                    actor_role="INSTITUTION_ADMIN",
                    action="ASSIGN_HOD_SCOPE",
                    entity="RoleAssignment",
                    entity_id=assignment.id,
                    tenant_id=tenant_id,
                    new_value={"hod_id": str(hod_id), "department_id": str(department_id)},
                )
        elif not existing.is_active:
            existing.is_active = True
            existing.assigned_by = actor.id if actor else None
            existing.assigned_at = datetime.now(timezone.utc)
            await db.flush()
            if actor is not None:
                AuditService.record(
                    db,
                    actor=actor,
                    actor_role="INSTITUTION_ADMIN",
                    action="ASSIGN_HOD_SCOPE",
                    entity="RoleAssignment",
                    entity_id=existing.id,
                    tenant_id=tenant_id,
                    new_value={"hod_id": str(hod_id), "department_id": str(department_id)},
                )

    @staticmethod
    async def _role_by_name(db, name: str) -> Role | None:
        res = await db.execute(select(Role).where(Role.name == name.upper()))
        return res.scalar_one_or_none()

    @staticmethod
    async def _load_user(db, tenant_id, user_id) -> User:
        res = await db.execute(select(User).where(User.id == user_id, User.tenant_id == tenant_id, User.deleted_at == None))  # noqa: E712
        user = res.scalar_one_or_none()
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    @staticmethod
    async def _assert_user_in_tenant(db, tenant_id, user_id) -> None:
        await InstitutionService._load_user(db, tenant_id, user_id)

    @staticmethod
    async def _assert_dept(db, tenant_id, dept_id) -> None:
        res = await db.execute(select(Department.id).where(Department.id == dept_id, Department.tenant_id == tenant_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department not found")

    @staticmethod
    async def _assert_year(db, tenant_id, year_id) -> None:
        res = await db.execute(select(AcademicYear.id).where(AcademicYear.id == year_id, AcademicYear.tenant_id == tenant_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Academic year not found")

    @staticmethod
    async def _assert_class(db, tenant_id, class_id) -> None:
        res = await db.execute(select(SchoolClass.id).where(SchoolClass.id == class_id, SchoolClass.tenant_id == tenant_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Class not found")

    @staticmethod
    async def _staff_out(db, tenant_id, user: User) -> StaffOut:
        roles_res = await db.execute(
            select(Role.name)
            .select_from(RoleAssignment)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(RoleAssignment.user_id == user.id, RoleAssignment.tenant_id == tenant_id, RoleAssignment.is_active == True)  # noqa: E712
        )
        roles = list(set(roles_res.scalars().all()))
        dept_res = await db.execute(
            select(RoleAssignment.scope_id).where(
                RoleAssignment.user_id == user.id, RoleAssignment.tenant_id == tenant_id,
                RoleAssignment.scope_type == "DEPARTMENT", RoleAssignment.is_active == True,  # noqa: E712
            ).limit(1)
        )
        dept_id = dept_res.scalar_one_or_none()
        dept_name = None
        if dept_id:
            dn = await db.execute(select(Department.name).where(Department.id == dept_id))
            dept_name = dn.scalar_one_or_none()
        return StaffOut(
            id=user.id, name=user.name, email=user.email, phone=user.phone,
            is_active=user.is_active, last_login_at=user.last_login_at, roles=roles,
            department_id=dept_id, department_name=dept_name,
        )

    @staticmethod
    async def _plan_name(db, tenant: Tenant) -> str | None:
        if tenant.plan_id is None:
            return None
        res = await db.execute(select(Plan.name).where(Plan.id == tenant.plan_id))
        return res.scalar_one_or_none()

    @staticmethod
    async def _subscription_status(db, tenant_id) -> str | None:
        res = await db.execute(
            select(Subscription.status).where(Subscription.tenant_id == tenant_id)
            .order_by(Subscription.created_at.desc()).limit(1)
        )
        return res.scalar_one_or_none()

    @staticmethod
    async def _queue_invite_email(db, tenant: Tenant, user: User, raw_token: str) -> None:
        domain = get_app_settings().PUBLIC_ROOT_DOMAIN or "xyz.com"
        link = f"https://{tenant.slug}.{domain}/reset-password?token={raw_token}"
        queue_email(
            db,
            "staff.invited",
            to=user.email or "",
            context={
                "name": user.name,
                "tenant_name": tenant.name,
                "invite_url": link,
            },
            tenant_id=tenant.id,
        )


def _year_out(y: AcademicYear) -> AcademicYearOut:
    return AcademicYearOut(id=y.id, name=y.name, start_date=y.start_date, end_date=y.end_date, is_current=y.is_current)
