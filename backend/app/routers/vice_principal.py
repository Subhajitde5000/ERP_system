"""Delegated Vice Principal API (C-VP-01 … C-VP-07).

Every route requires an active ``VICE_PRINCIPAL`` role and the service resolves
its department delegations before executing a query.  There are intentionally no
schedule/result approval endpoints: final approval remains Principal-only.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_vice_principal
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.principal import PrincipalNoticeCreate
from app.schemas.vice_principal import (
    APIResponseVicePrincipalAttendance,
    APIResponseVicePrincipalDashboard,
    APIResponseVicePrincipalExams,
    APIResponseVicePrincipalNotice,
    APIResponseVicePrincipalNotices,
    APIResponseVicePrincipalNoticeTargets,
    APIResponseVicePrincipalResults,
    APIResponseVicePrincipalStaff,
    APIResponseVicePrincipalStaffDetail,
)
from app.services.principal_service import PrincipalService
from app.services.vice_principal_service import VicePrincipalService

router = APIRouter(prefix="/vice-principal", tags=["Vice Principal"])


@router.get("/dashboard", response_model=APIResponseVicePrincipalDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.dashboard(db, vice_principal),
        message="Vice Principal dashboard loaded",
    )


@router.get("/attendance", response_model=APIResponseVicePrincipalAttendance)
async def attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.attendance(db, vice_principal, from_date, to_date),
        message="Delegated attendance overview loaded",
    )


@router.get("/examinations", response_model=APIResponseVicePrincipalExams)
async def examinations(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
    status_filter: str | None = Query(default=None, alias="status"),
    approval_status: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.examinations(
            db,
            vice_principal,
            status_filter=status_filter,
            approval_status=approval_status,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        ),
        message="Delegated exam schedules loaded",
    )


@router.get("/results", response_model=APIResponseVicePrincipalResults)
async def results(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.results(db, vice_principal),
        message="Delegated results overview loaded",
    )


@router.get("/staff", response_model=APIResponseVicePrincipalStaff)
async def staff(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
    query: str | None = Query(default=None, max_length=100),
    department_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.staff(
            db,
            vice_principal,
            query=query,
            department_id=department_id,
            limit=limit,
            offset=offset,
        ),
        message="Delegated staff directory loaded",
    )


@router.get("/staff/{user_id}", response_model=APIResponseVicePrincipalStaffDetail)
async def staff_detail(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.staff_detail(db, vice_principal, user_id),
        message="Staff profile loaded",
    )


@router.get("/notices/targets", response_model=APIResponseVicePrincipalNoticeTargets)
async def notice_targets(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.notice_targets(db, vice_principal),
        message="Delegated notice targets loaded",
    )


@router.get("/notices", response_model=APIResponseVicePrincipalNotices)
async def notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
    query: str | None = Query(default=None, max_length=100),
    scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS"] | None = Query(default=None),
    include_expired: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.notices(
            db,
            vice_principal,
            query=query,
            scope=scope,
            include_expired=include_expired,
            limit=limit,
            offset=offset,
        ),
        message="Delegated notices loaded",
    )


@router.post("/notices", response_model=APIResponseVicePrincipalNotice, status_code=status.HTTP_201_CREATED)
async def create_notice(
    payload: PrincipalNoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.create_notice(db, vice_principal, payload),
        message="Notice published",
    )


@router.get("/notices/{notice_id}", response_model=APIResponseVicePrincipalNotice)
async def notice_detail(
    notice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
):
    return APIResponse(
        success=True,
        data=await VicePrincipalService.notice_detail(db, vice_principal, notice_id),
        message="Notice loaded",
    )


@router.get("/reports/export", response_class=Response)
async def export_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    vice_principal: Annotated[User, Depends(get_current_tenant_user_vice_principal)],
    kind: Literal["attendance", "results", "examinations"] = Query(...),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    """Scoped CSV export used by the VP attendance/exam/result views."""
    filename, headings, rows = await VicePrincipalService.export_rows(
        db,
        vice_principal,
        kind,
        from_date=from_date,
        to_date=to_date,
    )
    return Response(
        content="\ufeff" + PrincipalService.csv_content(headings, rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )
