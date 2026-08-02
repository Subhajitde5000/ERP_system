"""Head of Department API — C-HD-01 … C-HD-12.

The HOD role is department-scoped.  Every handler resolves that scope in the
service before querying or mutating any resource; route ids alone never widen
access to another department.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_hod
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.hod import (
    APIResponseHodAssignments,
    APIResponseHodAttendance,
    APIResponseHodAttendanceDetail,
    APIResponseHodDashboard,
    APIResponseHodDiscussion,
    APIResponseHodDiscussionThread,
    APIResponseHodExams,
    APIResponseHodMentorAssign,
    APIResponseHodMentors,
    APIResponseHodNotice,
    APIResponseHodNotices,
    APIResponseHodNoticeTargets,
    APIResponseHodResults,
    APIResponseHodTeachers,
    APIResponseHodTimetable,
    HodDiscussionModeration,
    HodMentorAssign,
    HodTeacherSubjectAssign,
)
from app.schemas.principal import PrincipalNoticeCreate
from app.services.hod_service import HodService
from app.services.principal_service import PrincipalService

router = APIRouter(prefix="/hod", tags=["Head of Department"])


@router.get("/dashboard", response_model=APIResponseHodDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.dashboard(db, hod), message="HOD dashboard loaded")


# ── C-HD-02 / C-HD-03 attendance ───────────────────────────────────────────

@router.get("/attendance", response_model=APIResponseHodAttendance)
async def attendance(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await HodService.attendance(db, hod, from_date, to_date),
        message="Department attendance loaded",
    )


@router.get("/attendance/report", response_model=APIResponseHodAttendanceDetail)
async def attendance_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await HodService.attendance_detail(
            db,
            hod,
            from_date=from_date,
            to_date=to_date,
            class_id=class_id,
            student_id=student_id,
            limit=limit,
            offset=offset,
        ),
        message="Student attendance report loaded",
    )


@router.get("/attendance/report/export", response_class=Response)
async def attendance_report_export(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
):
    filename, headings, rows = await HodService.attendance_export_rows(
        db, hod, from_date=from_date, to_date=to_date, class_id=class_id
    )
    return Response(
        content="\ufeff" + PrincipalService.csv_content(headings, rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


# ── C-HD-04 / C-HD-05 / C-HD-06 ─────────────────────────────────────────────

@router.get("/examinations", response_model=APIResponseHodExams)
async def examinations(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    status_filter: str | None = Query(default=None, alias="status"),
    approval_status: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await HodService.examinations(
            db,
            hod,
            status_filter=status_filter,
            approval_status=approval_status,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        ),
        message="Department examinations loaded",
    )


@router.get("/assignments", response_model=APIResponseHodAssignments)
async def assignments(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.assignments(db, hod), message="Department assignments loaded")


@router.get("/results", response_model=APIResponseHodResults)
async def results(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.results(db, hod), message="Department results loaded")


@router.get("/reports/export", response_class=Response)
async def export_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    kind: Literal["attendance", "results", "examinations"] = Query(...),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
):
    filename, headings, rows = await HodService.export_rows(
        db, hod, kind, from_date=from_date, to_date=to_date
    )
    return Response(
        content="\ufeff" + PrincipalService.csv_content(headings, rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


# ── C-HD-07 teachers / subjects ─────────────────────────────────────────────

@router.get("/teachers", response_model=APIResponseHodTeachers)
async def teachers(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.teachers(db, hod), message="Department teachers loaded")


@router.post("/teacher-subjects", response_model=APIResponseHodTeachers, status_code=status.HTTP_201_CREATED)
async def assign_teacher_subject(
    payload: HodTeacherSubjectAssign,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(
        success=True,
        data=await HodService.assign_teacher_subject(db, hod, payload),
        message="Teacher subject assigned",
    )


@router.delete("/teacher-subjects/{teacher_subject_id}", response_model=APIResponseHodTeachers)
async def remove_teacher_subject(
    teacher_subject_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(
        success=True,
        data=await HodService.remove_teacher_subject(db, hod, teacher_subject_id),
        message="Teacher subject assignment removed",
    )


# ── C-HD-08 mentor assignments ──────────────────────────────────────────────

@router.get("/mentors", response_model=APIResponseHodMentors)
async def mentors(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.mentors(db, hod), message="Mentor assignments loaded")


@router.post("/mentor-assignments", response_model=APIResponseHodMentorAssign)
async def assign_mentor(
    payload: HodMentorAssign,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.assign_mentor(db, hod, payload), message="Mentor assigned")


@router.delete("/mentor-assignments/{assignment_id}", response_model=APIResponseHodMentorAssign)
async def remove_mentor(
    assignment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.remove_mentor_assignment(db, hod, assignment_id), message="Mentor assignment removed")


# ── C-HD-09 / C-HD-10 notices ───────────────────────────────────────────────

@router.get("/notices/targets", response_model=APIResponseHodNoticeTargets)
async def notice_targets(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.notice_targets(db, hod), message="Department notice targets loaded")


@router.get("/notices", response_model=APIResponseHodNotices)
async def notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    query: str | None = Query(default=None, max_length=100),
    scope: Literal["INSTITUTION", "DEPARTMENT", "CLASS"] | None = Query(default=None),
    include_expired: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await HodService.notices(
            db,
            hod,
            query=query,
            scope=scope,
            include_expired=include_expired,
            limit=limit,
            offset=offset,
        ),
        message="Department notices loaded",
    )


@router.post("/notices", response_model=APIResponseHodNotice, status_code=status.HTTP_201_CREATED)
async def create_notice(
    payload: PrincipalNoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.create_notice(db, hod, payload), message="Notice published")


@router.get("/notices/{notice_id}", response_model=APIResponseHodNotice)
async def notice_detail(
    notice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.notice_detail(db, hod, notice_id), message="Notice loaded")


# ── C-HD-11 discussion moderation ───────────────────────────────────────────

@router.get("/discussion", response_model=APIResponseHodDiscussion)
async def discussion(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
    query: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(success=True, data=await HodService.discussion(db, hod, query=query, limit=limit, offset=offset), message="Department discussions loaded")


@router.patch("/discussion/{thread_id}", response_model=APIResponseHodDiscussionThread)
async def moderate_discussion(
    thread_id: uuid.UUID,
    payload: HodDiscussionModeration,
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.moderate_discussion(db, hod, thread_id, payload), message="Discussion moderation applied")


# ── C-HD-12 timetable ───────────────────────────────────────────────────────

@router.get("/timetable", response_model=APIResponseHodTimetable)
async def timetable(
    db: Annotated[AsyncSession, Depends(get_db)],
    hod: Annotated[User, Depends(get_current_tenant_user_hod)],
):
    return APIResponse(success=True, data=await HodService.timetable(db, hod), message="Department timetable loaded")
