import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.models.catalog import Module, Plan
from app.models.role import Role
from app.models.tenant import Tenant, TenantType
from app.schemas.setup import (
    SetupAcademicYear,
    SetupClass,
    SetupDepartment,
    SetupProfile,
    SetupStaff,
    SetupState,
    SetupStudent,
    SetupSubject,
)
from app.services.setup_service import SetupService


@pytest.mark.asyncio
async def test_materialize_entities_batch_execution():
    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    tenant = Tenant(
        id=tenant_id,
        name="Test University",
        slug="test-uni",
        type=TenantType.COLLEGE,
        plan_id=plan_id,
    )

    state = SetupState(
        step=12,
        completed=True,
        profile=SetupProfile(name="Test University", type="COLLEGE"),
        academic_year=SetupAcademicYear(
            name="2025-2026", start_date="2025-06-01", end_date="2026-05-31"
        ),
        departments=[
            SetupDepartment(code="CS", name="Computer Science"),
            SetupDepartment(code="EE", name="Electrical Engineering"),
        ],
        classes=[
            SetupClass(code="CS-1", name="CS Year 1", department_code="CS"),
            SetupClass(code="EE-1", name="EE Year 1", department_code="EE"),
        ],
        subjects=[
            SetupSubject(code="CS101", name="Intro to CS", class_code="CS-1"),
            SetupSubject(code="EE101", name="Intro to EE", class_code="EE-1"),
        ],
        staff=[
            SetupStaff(name="Alice Smith", email="alice@test.edu", role="TEACHER"),
            SetupStaff(name="Bob Jones", email="bob@test.edu", role="TEACHER"),
        ],
        students=[
            SetupStudent(name="Charlie Brown", roll_no="101", class_code="CS-1"),
            SetupStudent(name="David Miller", roll_no="102", class_code="EE-1"),
        ],
    )

    db = AsyncMock()
    db.add = MagicMock()
    teacher_role = Role(id=uuid.uuid4(), name="TEACHER")
    student_role = Role(id=uuid.uuid4(), name="STUDENT")
    plan = Plan(id=plan_id, allowed_modules=["lms"])

    def mock_execute_side_effect(stmt, *args, **kwargs):
        res = MagicMock()
        res.scalar_one_or_none.return_value = None
        res.scalars.return_value.all.return_value = []
        res.all.return_value = []

        stmt_str = str(stmt)
        if "roles" in stmt_str.lower() or "FROM roles" in stmt_str or "roles." in stmt_str:
            res.scalars.return_value.all.return_value = [teacher_role, student_role]
        elif "FROM plans" in stmt_str or "plans." in stmt_str:
            res.scalar_one_or_none.return_value = plan
        return res

    db.execute.side_effect = mock_execute_side_effect

    await SetupService._materialize_entities(db, tenant, state)

    assert db.add.called
    added_objects = [call.args[0] for call in db.add.call_args_list]

    dept_names = [o.name for o in added_objects if hasattr(o, "code") and hasattr(o, "description")]
    assert "Computer Science" in dept_names
    assert "Electrical Engineering" in dept_names

    student_roll_nos = [o.student_roll_no for o in added_objects if hasattr(o, "student_roll_no")]
    assert "101" in student_roll_nos
    assert "102" in student_roll_nos


@pytest.mark.asyncio
async def test_materialize_entities_empty_state():
    tenant_id = uuid.uuid4()
    plan_id = uuid.uuid4()
    tenant = Tenant(
        id=tenant_id,
        name="Empty Uni",
        slug="empty-uni",
        type=TenantType.SCHOOL,
        plan_id=plan_id,
    )

    state = SetupState(
        step=12,
        completed=True,
        profile=None,
        academic_year=None,
        departments=[],
        classes=[],
        subjects=[],
        staff=[],
        students=[],
    )

    db = AsyncMock()
    db.add = MagicMock()
    plan = Plan(id=plan_id, allowed_modules=[])

    def mock_execute_side_effect(stmt, *args, **kwargs):
        res = MagicMock()
        res.scalar_one_or_none.return_value = None
        res.scalars.return_value.all.return_value = []
        res.all.return_value = []
        stmt_str = str(stmt)
        if "FROM plans" in stmt_str or "plans." in stmt_str:
            res.scalar_one_or_none.return_value = plan
        return res

    db.execute.side_effect = mock_execute_side_effect

    await SetupService._materialize_entities(db, tenant, state)
