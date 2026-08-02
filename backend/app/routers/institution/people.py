"""Routers — institution admin: people (staff, students, enrollments)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_admin
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.institution import (
    APIResponseEnrollment,
    APIResponseEnrollments,
    APIResponseStaff,
    APIResponseStaffOne,
    APIResponseStudent,
    APIResponseStudents,
    AssignRoleRequest,
    EnrollmentCreate,
    StaffInvite,
    StudentCreate,
)
from app.services.institution_service import InstitutionService

router = APIRouter()


async def _tenant(db: AsyncSession, admin: User):
    return await InstitutionService._tenant(db, admin.tenant_id)


# ── Staff / users ────────────────────────────────────────────────────────────

@router.get("/staff", response_model=APIResponseStaff)
async def list_staff(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_staff(db, admin.tenant_id), message="Staff loaded")


@router.post("/staff", response_model=APIResponseStaffOne, status_code=201)
async def invite_staff(
    payload: StaffInvite,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    tenant = await _tenant(db, admin)
    data = await InstitutionService.invite_staff(db, tenant, payload)
    return APIResponse(success=True, data=data, message="Staff invited — set-password link emailed")


@router.put("/staff/{user_id}/roles", response_model=APIResponseStaffOne)
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    data = await InstitutionService.assign_role(db, admin.tenant_id, user_id, payload.role_name, admin.id)
    return APIResponse(success=True, data=data, message="Role assigned")


@router.put("/staff/{user_id}/active", response_model=APIResponseStaffOne)
async def set_staff_active(
    user_id: uuid.UUID,
    active: Annotated[bool, "true to activate, false to deactivate"],
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    data = await InstitutionService.set_user_active(db, admin.tenant_id, user_id, active)
    return APIResponse(success=True, data=data, message="Staff status updated")


# ── Students ─────────────────────────────────────────────────────────────────

@router.get("/students", response_model=APIResponseStudents)
async def list_students(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_students(db, admin.tenant_id), message="Students loaded")


@router.post("/students", response_model=APIResponseStudent, status_code=201)
async def create_student(
    payload: StudentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    tenant = await _tenant(db, admin)
    data = await InstitutionService.create_student(db, tenant, payload)
    return APIResponse(success=True, data=data, message="Student created")


# ── Enrollments ──────────────────────────────────────────────────────────────

@router.get("/enrollments", response_model=APIResponseEnrollments)
async def list_enrollments(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_enrollments(db, admin.tenant_id), message="Enrollments loaded")


@router.post("/enrollments", response_model=APIResponseEnrollment, status_code=201)
async def create_enrollment(
    payload: EnrollmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    data = await InstitutionService.create_enrollment(db, admin.tenant_id, payload)
    return APIResponse(success=True, data=data, message="Student enrolled")
