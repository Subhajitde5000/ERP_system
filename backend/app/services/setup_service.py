"""
Services — First-Time Setup Wizard

Step 10 of the institution-admin journey. The admin lands here after the
first login instead of the dashboard. Progress is persisted server-side in
`tenant_settings['onboarding']` (SYSTEM-FLOW §4.3: state lives in
tenant_settings, not the browser) so a 2,000-student college can resume.

`materialize()` turns a completed state into real rows:
  academic_years (already created at provisioning — updated in place)
  departments, classes (sections = classes), subjects
  invited staff → users + role_assignments
  imported students → users + STUDENT role
  modules → tenant_modules (plan-gated)
  branding → tenants.logo_url + tenant_settings
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import AcademicYear, Department, SchoolClass, Subject
from app.models.billing import TenantModule, TenantSetting
from app.models.role import Role, RoleAssignment
from app.models.tenant import Tenant, TenantType
from app.models.user import User
from app.schemas.setup import (
    SetupEntityCounts,
    SetupResponse,
    SetupState,
)
from app.utils.security import hash_password

ONBOARDING_KEY = "onboarding"
DEFAULT_SETUP_PASSWORD = "Setup@12345"  # staff get a reset link in real deployments
DEFAULT_STUDENT_PASSWORD = "password1232!"


class SetupService:
    # ── Read ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def _tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
        res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = res.scalar_one_or_none()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
            )
        return tenant

    @staticmethod
    async def _load_state(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
        res = await db.execute(
            select(TenantSetting).where(
                TenantSetting.tenant_id == tenant_id,
                TenantSetting.key == ONBOARDING_KEY,
            )
        )
        setting = res.scalar_one_or_none()
        if setting is None:
            return {}
        try:
            return json.loads(setting.value)
        except (TypeError, json.JSONDecodeError):
            return {}

    @staticmethod
    async def get_state(db: AsyncSession, tenant_id: uuid.UUID) -> SetupResponse:
        tenant = await SetupService._tenant(db, tenant_id)
        state = await SetupService._load_state(db, tenant_id)
        entities = await SetupService._counts(db, tenant_id)
        return SetupResponse(
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            state=SetupState.model_validate(state),
            entities=entities,
        )

    # ── Write ────────────────────────────────────────────────────────────────

    @staticmethod
    async def save_state(
        db: AsyncSession, tenant_id: uuid.UUID, state: SetupState
    ) -> SetupResponse:
        """Upsert the full wizard state (called after every step)."""
        tenant = await SetupService._tenant(db, tenant_id)
        raw = state.model_dump(mode="json")
        res = await db.execute(
            select(TenantSetting).where(
                TenantSetting.tenant_id == tenant_id,
                TenantSetting.key == ONBOARDING_KEY,
            )
        )
        setting = res.scalar_one_or_none()
        if setting is None:
            setting = TenantSetting(
                tenant_id=tenant_id, key=ONBOARDING_KEY, value="{}"
            )
            db.add(setting)
        setting.value = json.dumps(raw)
        await db.flush()
        entities = await SetupService._counts(db, tenant_id)
        return SetupResponse(
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            state=state,
            entities=entities,
        )

    @staticmethod
    async def _counts(db: AsyncSession, tenant_id: uuid.UUID) -> SetupEntityCounts:
        async def count(model) -> int:
            res = await db.execute(
                select(model.id).where(model.tenant_id == tenant_id).limit(1)
            )
            return 1 if res.scalar_one_or_none() is not None else 0

        return SetupEntityCounts(
            academic_years=await count(AcademicYear),
            departments=await count(Department),
            classes=await count(SchoolClass),
            subjects=await count(Subject),
            staff=0,
            students=0,
            modules=0,
        )

    # ── Materialise ──────────────────────────────────────────────────────────

    @staticmethod
    async def complete(
        db: AsyncSession, tenant_id: uuid.UUID
    ) -> SetupResponse:
        """
        Called when the admin finishes the wizard (step 12).

        Materialises departments → classes → subjects → staff → students →
        modules into real tables, flags the tenant as onboarded, and marks
        the state complete so the dashboard gate opens.
        """
        tenant = await SetupService._tenant(db, tenant_id)
        raw = await SetupService._load_state(db, tenant_id)
        state = SetupState.model_validate(raw)
        state.completed = True
        state.step = 12

        await SetupService._materialize_entities(db, tenant, state)
        await SetupService._mark_complete(db, tenant, state)

        entities = await SetupService._counts(db, tenant_id)
        return SetupResponse(
            tenant_id=tenant.id,
            tenant_slug=tenant.slug,
            state=state,
            entities=entities,
        )

    @staticmethod
    async def _materialize_entities(
        db: AsyncSession, tenant: Tenant, state: SetupState
    ) -> None:
        # 1. Profile → tenants row.
        profile = state.profile
        if profile is not None:
            if profile.name:
                tenant.name = profile.name
            if profile.type:
                tenant.type = TenantType(profile.type)
            if profile.email:
                tenant.email = str(profile.email)
            if profile.phone:
                tenant.phone = profile.phone
            if profile.address:
                tenant.address = profile.address
            if profile.city:
                tenant.city = profile.city
            if profile.state:
                tenant.state = profile.state
            if profile.country:
                tenant.country = profile.country
            if profile.pincode:
                tenant.pincode = profile.pincode
            if profile.website:
                tenant.website = profile.website
            if profile.timezone:
                tenant.timezone = profile.timezone

        # 2. Academic year — the provisioning template is updated in place.
        year = await SetupService._current_year(db, tenant.id)
        if year is None and state.academic_year is not None:
            year = AcademicYear(
                tenant_id=tenant.id,
                name=state.academic_year.name,
                start_date=state.academic_year.start_date,
                end_date=state.academic_year.end_date,
                is_current=True,
            )
            db.add(year)
        elif year is not None and state.academic_year is not None:
            year.name = state.academic_year.name
            year.start_date = state.academic_year.start_date
            year.end_date = state.academic_year.end_date
            year.is_current = True
        await db.flush()

        # 3. Departments.
        # Performance: Batch fetch existing departments in 1 query (O(1) roundtrips instead of O(N))
        dept_by_code: dict[str, Department] = {}
        if state.departments:
            dept_codes = [dep.code for dep in state.departments]
            res_dept = await db.execute(
                select(Department).where(
                    Department.tenant_id == tenant.id, Department.code.in_(dept_codes)
                )
            )
            existing_depts = {dep.code: dep for dep in res_dept.scalars().all()}
            for dep in state.departments:
                row = existing_depts.get(dep.code)
                if row is None:
                    row = Department(
                        tenant_id=tenant.id,
                        name=dep.name,
                        code=dep.code,
                        description=dep.description,
                    )
                    db.add(row)
                else:
                    row.name = dep.name
                    row.description = dep.description
                dept_by_code[dep.code] = row
            await db.flush()

        # 4. Classes (sections are classes — "10-A", "CSE-3").
        # Performance: Batch fetch existing classes in 1 query (O(1) roundtrips instead of O(N))
        class_by_code: dict[str, SchoolClass] = {}
        if state.classes:
            class_codes = [cls.code for cls in state.classes]
            res_cls = await db.execute(
                select(SchoolClass).where(
                    SchoolClass.tenant_id == tenant.id, SchoolClass.code.in_(class_codes)
                )
            )
            existing_classes = {cls.code: cls for cls in res_cls.scalars().all()}
            for cls in state.classes:
                department = dept_by_code.get(cls.department_code)
                if department is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Class '{cls.code}' references unknown department '{cls.department_code}'",
                    )
                if year is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Set the academic year before creating classes",
                    )
                row = existing_classes.get(cls.code)
                name = cls.section and f"{cls.name} · {cls.section}" or cls.name
                if row is None:
                    row = SchoolClass(
                        tenant_id=tenant.id,
                        department_id=department.id,
                        academic_year_id=year.id,
                        name=name,
                        code=cls.code,
                        max_strength=cls.max_strength,
                        room_no=cls.room_no,
                    )
                    db.add(row)
                else:
                    row.department_id = department.id
                    row.academic_year_id = year.id
                    row.name = name
                    row.max_strength = cls.max_strength
                    row.room_no = cls.room_no
                class_by_code[cls.code] = row
            await db.flush()

        # 5. Subjects.
        # Performance: Batch fetch existing subjects in 1 query (O(1) roundtrips instead of O(N))
        if state.subjects:
            subject_codes = [sub.code for sub in state.subjects]
            res_sub = await db.execute(
                select(Subject).where(
                    Subject.tenant_id == tenant.id, Subject.code.in_(subject_codes)
                )
            )
            existing_subjects = {sub.code: sub for sub in res_sub.scalars().all()}
            for subject in state.subjects:
                school_class = class_by_code.get(subject.class_code)
                if school_class is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Subject '{subject.code}' references unknown class '{subject.class_code}'",
                    )
                row = existing_subjects.get(subject.code)
                if row is None:
                    row = Subject(
                        tenant_id=tenant.id,
                        class_id=school_class.id,
                        name=subject.name,
                        code=subject.code,
                        subject_type=subject.subject_type,
                        credits=subject.credits,
                        max_marks=subject.max_marks,
                        passing_marks=subject.passing_marks,
                    )
                    db.add(row)
                else:
                    row.class_id = school_class.id
                    row.name = subject.name
                    row.subject_type = subject.subject_type
                    row.credits = subject.credits
                    row.max_marks = subject.max_marks
                    row.passing_marks = subject.passing_marks
            await db.flush()

        # 6. Staff → users + role assignments.
        # Performance: Batch fetch staff users and role assignments (O(1) queries instead of O(N) queries + flushes)
        roles = await SetupService._roles_by_name(db)
        now = datetime.now(timezone.utc)
        if state.staff:
            emails = [str(m.email).lower() for m in state.staff if m.email]
            res_users = await db.execute(
                select(User).where(
                    User.tenant_id == tenant.id, User.email.in_(emails)
                )
            ) if emails else None
            existing_users = {u.email: u for u in res_users.scalars().all()} if res_users else {}

            staff_user_pairs = []
            for member in state.staff:
                email = str(member.email).lower() if member.email else None
                user = existing_users.get(email) if email else None
                if user is None:
                    user = User(
                        tenant_id=tenant.id,
                        name=member.name,
                        email=email,
                        phone=member.phone,
                        password_hash=hash_password(DEFAULT_SETUP_PASSWORD),
                        is_active=True,
                    )
                    db.add(user)
                    if email:
                        existing_users[email] = user
                staff_user_pairs.append((member, user))

            await db.flush()

            staff_user_ids = [u.id for _, u in staff_user_pairs]
            res_roles = await db.execute(
                select(RoleAssignment.user_id, RoleAssignment.role_id).where(
                    RoleAssignment.tenant_id == tenant.id,
                    RoleAssignment.user_id.in_(staff_user_ids),
                    RoleAssignment.is_active == True,  # noqa: E712
                )
            ) if staff_user_ids else None
            existing_assignments = {(r[0], r[1]) for r in res_roles.all()} if res_roles else set()

            for member, user in staff_user_pairs:
                role = roles.get(member.role)
                if role is not None:
                    if (user.id, role.id) not in existing_assignments:
                        db.add(
                            RoleAssignment(
                                user_id=user.id,
                                role_id=role.id,
                                tenant_id=tenant.id,
                                assigned_at=now,
                                is_active=True,
                            )
                        )
                        existing_assignments.add((user.id, role.id))
            await db.flush()

        # 7. Students → users + STUDENT role.
        # Performance: Batch fetch student users and STUDENT role assignments (O(1) queries instead of O(N) queries + flushes)
        student_role = roles.get("STUDENT")
        if state.students:
            roll_nos = [s.roll_no for s in state.students if s.roll_no]
            res_students = await db.execute(
                select(User).where(
                    User.tenant_id == tenant.id,
                    User.student_roll_no.in_(roll_nos),
                )
            ) if roll_nos else None
            existing_students = {u.student_roll_no: u for u in res_students.scalars().all()} if res_students else {}

            student_user_pairs = []
            for student in state.students:
                user = existing_students.get(student.roll_no) if student.roll_no else None
                if user is None:
                    user = User(
                        tenant_id=tenant.id,
                        name=student.name,
                        email=str(student.email).lower() if student.email else None,
                        gender=student.gender,
                        date_of_birth=student.date_of_birth,
                        student_roll_no=student.roll_no,
                        password_hash=hash_password(DEFAULT_STUDENT_PASSWORD),
                        is_active=True,
                    )
                    db.add(user)
                    if student.roll_no:
                        existing_students[student.roll_no] = user
                student_user_pairs.append((student, user))

            await db.flush()

            if student_role is not None and student_user_pairs:
                student_user_ids = [u.id for _, u in student_user_pairs]
                res_roles = await db.execute(
                    select(RoleAssignment.user_id).where(
                        RoleAssignment.tenant_id == tenant.id,
                        RoleAssignment.role_id == student_role.id,
                        RoleAssignment.user_id.in_(student_user_ids),
                        RoleAssignment.is_active == True,  # noqa: E712
                    )
                ) if student_user_ids else None
                assigned_student_user_ids = set(res_roles.scalars().all()) if res_roles else set()

                for student, user in student_user_pairs:
                    if user.id not in assigned_student_user_ids:
                        db.add(
                            RoleAssignment(
                                user_id=user.id,
                                role_id=student_role.id,
                                tenant_id=tenant.id,
                                assigned_at=now,
                                is_active=True,
                            )
                        )
                        assigned_student_user_ids.add(user.id)
            await db.flush()

        # 8. Modules — plan-gated: only modules the tenant's plan allows.
        await SetupService._sync_modules(db, tenant, state.modules)

        # 9. Branding.
        branding = state.branding
        if branding is not None:
            if branding.logo_url:
                tenant.logo_url = branding.logo_url
            if branding.primary_color:
                await SetupService._set_setting(
                    db, tenant.id, "branding.primary_color", branding.primary_color
                )
            if branding.tagline:
                await SetupService._set_setting(
                    db, tenant.id, "branding.tagline", branding.tagline
                )
        await db.flush()

    @staticmethod
    async def _current_year(
        db: AsyncSession, tenant_id: uuid.UUID
    ) -> AcademicYear | None:
        res = await db.execute(
            select(AcademicYear)
            .where(AcademicYear.tenant_id == tenant_id)
            .order_by(AcademicYear.is_current.desc(), AcademicYear.start_date.desc())
            .limit(1)
        )
        return res.scalar_one_or_none()

    @staticmethod
    async def _roles_by_name(db: AsyncSession) -> dict[str, Role]:
        res = await db.execute(select(Role))
        return {role.name: role for role in res.scalars().all()}

    @staticmethod
    async def _set_setting(
        db: AsyncSession, tenant_id: uuid.UUID, key: str, value: str
    ) -> None:
        res = await db.execute(
            select(TenantSetting).where(
                TenantSetting.tenant_id == tenant_id, TenantSetting.key == key
            )
        )
        setting = res.scalar_one_or_none()
        if setting is None:
            db.add(TenantSetting(tenant_id=tenant_id, key=key, value=value))
        else:
            setting.value = value

    @staticmethod
    async def _sync_modules(
        db: AsyncSession, tenant: Tenant, module_keys: list[str]
    ) -> None:
        """Enable selected modules — but never beyond the tenant's plan."""
        from app.models.catalog import Module, Plan

        plan_res = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
        plan = plan_res.scalar_one_or_none()
        allowed = set(plan.allowed_modules or []) if plan else set()

        res = await db.execute(select(Module))
        modules = list(res.scalars().all())

        existing_res = await db.execute(
            select(TenantModule).where(TenantModule.tenant_id == tenant.id)
        )
        existing = {tm.module_key: tm for tm in existing_res.scalars().all()}

        now = datetime.now(timezone.utc)
        for module in modules:
            if module.is_core:
                wanted = True
            elif module.key in module_keys and module.key in allowed:
                wanted = True
            else:
                wanted = False
            row = existing.get(module.key)
            if row is None:
                if wanted:
                    db.add(
                        TenantModule(
                            tenant_id=tenant.id,
                            module_key=module.key,
                            is_enabled=True,
                            enabled_at=now,
                        )
                    )
            elif wanted and not row.is_enabled:
                row.is_enabled = True
                row.enabled_at = now
            elif not wanted and row.is_enabled:
                row.is_enabled = False
                row.disabled_at = now
        await db.flush()

    @staticmethod
    async def _mark_complete(
        db: AsyncSession, tenant: Tenant, state: SetupState
    ) -> None:
        res = await db.execute(
            select(TenantSetting).where(
                TenantSetting.tenant_id == tenant.id,
                TenantSetting.key == ONBOARDING_KEY,
            )
        )
        setting = res.scalar_one_or_none()
        if setting is None:
            setting = TenantSetting(
                tenant_id=tenant.id, key=ONBOARDING_KEY, value="{}"
            )
            db.add(setting)
        setting.value = json.dumps(state.model_dump(mode="json"))
        await SetupService._set_setting(db, tenant.id, "onboarding.completed", "true")
        await db.flush()
