"""
Routers — institution admin: dashboard + academic structure.

All routes are tenant-scoped (tenant resolved from the JWT) and require the
INSTITUTION_ADMIN role via `get_current_tenant_user_admin`.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import (
    get_current_tenant_user_admin,
    get_current_tenant_user_student_records_manager,
)
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.institution import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
    APIResponseClass,
    APIResponseClasses,
    APIResponseDashboard,
    APIResponseDepartment,
    APIResponseDepartments,
    APIResponseGrade,
    APIResponseGrades,
    APIResponseProgram,
    APIResponsePrograms,
    APIResponseSubject,
    APIResponseSubjects,
    APIResponseYear,
    APIResponseYears,
    ClassCreate,
    ClassGradeCreate,
    ClassProgramCreate,
    ClassUpdate,
    DepartmentCreate,
    DepartmentUpdate,
    SubjectCreate,
    SubjectUpdate,
)
from app.services.institution_service import InstitutionService

router = APIRouter()


@router.get("/dashboard", response_model=APIResponseDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    data = await InstitutionService.dashboard(db, admin.tenant_id)
    return APIResponse(success=True, data=data, message="Dashboard summary")


# ── Academic years ───────────────────────────────────────────────────────────

@router.get("/academic-years", response_model=APIResponseYears)
async def list_years(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_years(db, admin.tenant_id), message="Academic years")


@router.post("/academic-years", response_model=APIResponseYear, status_code=201)
async def create_year(
    payload: AcademicYearCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.create_year(db, admin.tenant_id, payload), message="Academic year created")


@router.put("/academic-years/{year_id}", response_model=APIResponseYear)
async def update_year(
    year_id: uuid.UUID,
    payload: AcademicYearUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.update_year(db, admin.tenant_id, year_id, payload), message="Academic year updated")


@router.delete("/academic-years/{year_id}", response_model=APIResponse[None])
async def delete_year(
    year_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    await InstitutionService.delete_year(db, admin.tenant_id, year_id)
    return APIResponse(success=True, data=None, message="Academic year deleted")


# ── Departments ──────────────────────────────────────────────────────────────

@router.get("/departments", response_model=APIResponseDepartments)
async def list_departments(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_departments(db, admin.tenant_id), message="Departments")


@router.post("/departments", response_model=APIResponseDepartment, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.create_department(db, admin.tenant_id, payload, actor=admin), message="Department created")


@router.put("/departments/{department_id}", response_model=APIResponseDepartment)
async def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.update_department(db, admin.tenant_id, department_id, payload, actor=admin), message="Department updated")


@router.delete("/departments/{department_id}", response_model=APIResponse[None])
async def delete_department(
    department_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    await InstitutionService.delete_department(db, admin.tenant_id, department_id)
    return APIResponse(success=True, data=None, message="Department deleted")


# ── Classes ──────────────────────────────────────────────────────────────────

@router.get("/classes", response_model=APIResponseClasses)
async def list_classes(
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(get_current_tenant_user_student_records_manager)],
):
    return APIResponse(success=True, data=await InstitutionService.list_classes(db, manager.tenant_id), message="Classes")


@router.post("/classes", response_model=APIResponseClass, status_code=201)
async def create_class(
    payload: ClassCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.create_class(db, admin.tenant_id, payload), message="Class created")


@router.put("/classes/{class_id}", response_model=APIResponseClass)
async def update_class(
    class_id: uuid.UUID,
    payload: ClassUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.update_class(db, admin.tenant_id, class_id, payload), message="Class updated")


@router.delete("/classes/{class_id}", response_model=APIResponse[None])
async def delete_class(
    class_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    await InstitutionService.delete_class(db, admin.tenant_id, class_id)
    return APIResponse(success=True, data=None, message="Class deleted")


# ── Grades (School wizard) ────────────────────────────────────────────────────

@router.get("/grades", response_model=APIResponseGrades)
async def list_grades(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
    academic_year_id: uuid.UUID | None = None,
):
    return APIResponse(
        success=True,
        data=await InstitutionService.list_grades(db, admin.tenant_id, academic_year_id),
        message="Grade groups",
    )


@router.post("/grades", response_model=APIResponseGrade, status_code=201)
async def create_grade(
    payload: ClassGradeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(
        success=True,
        data=await InstitutionService.create_grade_with_sections(db, admin.tenant_id, payload),
        message="Grade and sections created",
    )


@router.delete("/grades/{grade_id}", response_model=APIResponse[None])
async def delete_grade(
    grade_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    await InstitutionService.delete_grade(db, admin.tenant_id, grade_id)
    return APIResponse(success=True, data=None, message="Grade deleted")


# ── Programs (College wizard) ────────────────────────────────────────────────

@router.get("/programs", response_model=APIResponsePrograms)
async def list_programs(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
    department_id: uuid.UUID | None = None,
    academic_year_id: uuid.UUID | None = None,
):
    return APIResponse(
        success=True,
        data=await InstitutionService.list_programs(db, admin.tenant_id, department_id, academic_year_id),
        message="Program groups",
    )


@router.post("/programs", response_model=APIResponseProgram, status_code=201)
async def create_program(
    payload: ClassProgramCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(
        success=True,
        data=await InstitutionService.create_program_with_batches(db, admin.tenant_id, payload),
        message="Program and batches created",
    )


@router.delete("/programs/{program_id}", response_model=APIResponse[None])
async def delete_program(
    program_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    await InstitutionService.delete_program(db, admin.tenant_id, program_id)
    return APIResponse(success=True, data=None, message="Program deleted")


# ── Subjects ─────────────────────────────────────────────────────────────────

@router.get("/subjects", response_model=APIResponseSubjects)
async def list_subjects(
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(get_current_tenant_user_student_records_manager)],
):
    return APIResponse(success=True, data=await InstitutionService.list_subjects(db, manager.tenant_id), message="Subjects")


@router.post("/subjects", response_model=APIResponseSubject, status_code=201)
async def create_subject(
    payload: SubjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(get_current_tenant_user_student_records_manager)],
):
    return APIResponse(success=True, data=await InstitutionService.create_subject(db, manager.tenant_id, payload), message="Subject created")


@router.put("/subjects/{subject_id}", response_model=APIResponseSubject)
async def update_subject(
    subject_id: uuid.UUID,
    payload: SubjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(get_current_tenant_user_student_records_manager)],
):
    return APIResponse(success=True, data=await InstitutionService.update_subject(db, manager.tenant_id, subject_id, payload), message="Subject updated")


@router.delete("/subjects/{subject_id}", response_model=APIResponse[None])
async def delete_subject(
    subject_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    manager: Annotated[User, Depends(get_current_tenant_user_student_records_manager)],
):
    await InstitutionService.delete_subject(db, manager.tenant_id, subject_id)
    return APIResponse(success=True, data=None, message="Subject deleted")
