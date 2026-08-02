"""Principal academic-oversight API (C-PR-01 … C-PR-10).

All endpoints require a current ``PRINCIPAL`` role assignment.  The service
performs tenant filtering before every aggregate or lookup; approval writes are
transactional and audited.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_principal
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.principal import (
    APIResponsePrincipalAttendance,
    APIResponsePrincipalDashboard,
    APIResponsePrincipalExam,
    APIResponsePrincipalExams,
    APIResponsePrincipalNotice,
    APIResponsePrincipalNotices,
    APIResponsePrincipalNoticeTargets,
    APIResponsePrincipalPublication,
    APIResponsePrincipalReports,
    APIResponsePrincipalResults,
    APIResponsePrincipalStaff,
    APIResponsePrincipalStaffDetail,
    APIResponsePrincipalStudentDetail,
    APIResponsePrincipalStudents,
    APIResponsePrincipalTimetable,
    PrincipalNoticeCreate,
    ResultApprovalRequest,
    ScheduleApprovalRequest,
)
from app.services.principal_service import PrincipalService

router = APIRouter(prefix="/principal", tags=["Principal"])


@router.get("/dashboard", response_model=APIResponsePrincipalDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.dashboard(db, principal.tenant_id),
        message="Principal dashboard loaded",
    )


# ── C-PR-02 attendance ──────────────────────────────────────────────────────

@router.get("/attendance", response_model=APIResponsePrincipalAttendance)
async def attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.attendance(db, principal.tenant_id, from_date, to_date),
        message="Attendance overview loaded",
    )


# ── C-PR-03 examination schedule ────────────────────────────────────────────

@router.get("/examinations", response_model=APIResponsePrincipalExams)
async def examinations(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    status_filter: str | None = Query(default=None, alias="status"),
    approval_status: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.examinations(
            db,
            principal.tenant_id,
            status_filter=status_filter,
            approval_status=approval_status,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        ),
        message="Exam schedules loaded",
    )


@router.post("/examinations/{exam_id}/approval", response_model=APIResponsePrincipalExam)
async def approve_exam_schedule(
    exam_id: uuid.UUID,
    payload: ScheduleApprovalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.approve_schedule(
            db, principal.tenant_id, principal, exam_id, payload
        ),
        message="Exam schedule decision recorded",
    )


# ── C-PR-04 results ─────────────────────────────────────────────────────────

@router.get("/results", response_model=APIResponsePrincipalResults)
async def results(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.results(db, principal.tenant_id),
        message="Results overview loaded",
    )


@router.post(
    "/results/publications/{publication_id}/approval",
    response_model=APIResponsePrincipalPublication,
)
async def approve_result_publication(
    publication_id: uuid.UUID,
    payload: ResultApprovalRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.approve_result_publication(
            db, principal.tenant_id, principal, publication_id, payload
        ),
        message="Result publication decision recorded",
    )


# ── C-PR-05 / C-PR-06 people directories ───────────────────────────────────

@router.get("/staff", response_model=APIResponsePrincipalStaff)
async def staff(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    query: str | None = Query(default=None, max_length=100),
    department_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.staff(
            db,
            principal.tenant_id,
            query=query,
            department_id=department_id,
            limit=limit,
            offset=offset,
        ),
        message="Staff directory loaded",
    )


@router.get("/staff/{user_id}", response_model=APIResponsePrincipalStaffDetail)
async def staff_detail(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.staff_detail(db, principal.tenant_id, user_id),
        message="Staff profile loaded",
    )


@router.get("/students", response_model=APIResponsePrincipalStudents)
async def students(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    query: str | None = Query(default=None, max_length=100),
    class_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.students(
            db,
            principal.tenant_id,
            query=query,
            class_id=class_id,
            limit=limit,
            offset=offset,
        ),
        message="Student directory loaded",
    )


@router.get("/students/{user_id}", response_model=APIResponsePrincipalStudentDetail)
async def student_detail(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.student_detail(db, principal.tenant_id, user_id),
        message="Student profile loaded",
    )


# ── C-PR-07 / C-PR-08 notice board and composer ─────────────────────────────

@router.get("/notices/targets", response_model=APIResponsePrincipalNoticeTargets)
async def notice_targets(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.notice_targets(db, principal.tenant_id),
        message="Notice targets loaded",
    )


@router.get("/notices", response_model=APIResponsePrincipalNotices)
async def notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    query: str | None = Query(default=None, max_length=100),
    scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS"] | None = Query(default=None),
    include_expired: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.notices(
            db,
            principal.tenant_id,
            query=query,
            scope=scope,
            include_expired=include_expired,
            limit=limit,
            offset=offset,
        ),
        message="Notices loaded",
    )


@router.post("/notices", response_model=APIResponsePrincipalNotice, status_code=status.HTTP_201_CREATED)
async def create_notice(
    payload: PrincipalNoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.create_notice(db, principal.tenant_id, principal, payload),
        message="Notice published",
    )


@router.get("/notices/{notice_id}", response_model=APIResponsePrincipalNotice)
async def notice_detail(
    notice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
):
    return APIResponse(
        success=True,
        data=await PrincipalService.notice_detail(db, principal.tenant_id, notice_id),
        message="Notice loaded",
    )


# ── C-PR-09 timetable ───────────────────────────────────────────────────────

@router.get("/timetable", response_model=APIResponsePrincipalTimetable)
async def timetable(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    class_id: uuid.UUID | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.timetable(db, principal.tenant_id, class_id),
        message="Timetable loaded",
    )


# ── C-PR-10 reports and exports ─────────────────────────────────────────────

@router.get("/reports", response_model=APIResponsePrincipalReports)
async def reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await PrincipalService.reports(
            db, principal.tenant_id, from_date=from_date, to_date=to_date
        ),
        message="Academic reports loaded",
    )


@router.get("/reports/export", response_class=Response)
async def export_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    principal: Annotated[User, Depends(get_current_tenant_user_principal)],
    kind: Literal["attendance", "results", "performance", "timetable", "examinations"] = Query(...),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    filename, headings, rows = await PrincipalService.export_rows(
        db,
        principal.tenant_id,
        kind,
        from_date=from_date,
        to_date=to_date,
    )
    return Response(
        content="\ufeff" + PrincipalService.csv_content(headings, rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )
