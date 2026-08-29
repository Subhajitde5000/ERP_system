"""Parent API — C-PA-01 … C-PA-12, plus the two public endpoints that turn an
activation code into a guardian account.

Every ``/children/{child_id}/…`` route is fenced the same way: the service
requires a live ``parent_student_links`` row joining the caller to that child,
in the caller's tenant, with the module in scope. No route can be handed a child
it has not been linked to, and the check runs per request — so a link the office
revokes stops working immediately, not when a token expires.

The portal is read-only apart from leave requests. A guardian cannot edit a
child's record, submit an assignment or mark attendance, and that is a policy
statement rather than an omission.
"""

# No ``from __future__ import annotations`` here, on purpose: the two public
# routes below are wrapped by slowapi's ``@limiter.limit``, and ``functools.wraps``
# does not carry ``__globals__`` over to the wrapper. With PEP 563 string
# annotations FastAPI then resolves them against *slowapi's* module, silently
# fails, and degrades ``db: Annotated[AsyncSession, Depends(get_db)]`` into a
# required *query parameter* named ``db`` — a 422 on every request. Real
# annotation objects are not re-evaluated, so the dependency survives.
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_parent
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.parent import (
    APIResponseParentAssignments,
    APIResponseParentAttendance,
    APIResponseParentAttendanceCalendar,
    APIResponseParentChildDashboard,
    APIResponseParentChildProfile,
    APIResponseParentClaim,
    APIResponseParentChildren,
    APIResponseParentCodeCheck,
    APIResponseParentExaminations,
    APIResponseParentExamSummary,
    APIResponseParentFees,
    APIResponseParentGuardianProfile,
    APIResponseParentLeave,
    APIResponseParentLeaves,
    APIResponseParentNotices,
    APIResponseParentOverview,
    APIResponseParentResult,
    APIResponseParentResults,
    APIResponseParentTimetable,
    ParentAccountClaim,
    ParentClaimByCode,
    ParentGuardianUpdate,
    ParentLeaveCreate,
)
from app.services.parent_service import ParentLinkService, ParentService

router = APIRouter(prefix="/parent", tags=["Parent Portal"])
limiter = Limiter(key_func=get_remote_address)


# ── Before you have an account: the claim flow ───────────────────────────────
#
# Unauthenticated by necessity — this is how a guardian gets a login at all. Both
# are rate limited per IP and answer only about a code the caller already holds,
# and `activate` also requires the child's roll number, so neither is a discovery
# endpoint for families.


@router.get("/access/check-code", response_model=APIResponseParentCodeCheck)
@limiter.limit("20/hour")
async def check_code(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    code: str = Query(
        ..., min_length=6, max_length=24, description="Guardian code from the admission slip"
    ),
):
    """Preview what a code connects to, so a parent knows they hold the right one."""
    return APIResponse(
        success=True,
        data=await ParentLinkService.check_code(db, code),
        message="Invitation found",
    )


@router.post("/access/activate", status_code=status.HTTP_201_CREATED)
@limiter.limit("8/hour")
async def activate_guardian_account(
    request: Request,
    payload: ParentAccountClaim,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create the guardian account and claim the invitation in one step.

    Returns no token on purpose: the client signs in through the ordinary tenant
    login, so lockout, session records and refresh rotation apply to this
    identity like any other. Handing out a JWT here would be a second, weaker
    route to the same account.
    """
    data = await ParentLinkService.activate_with_code(db, payload)
    return APIResponse(
        success=True,
        data=data,
        message="Account created. Sign in to open the parent portal.",
    )


# ── C-PA-01 … C-PA-03 family, overview, dashboard ───────────────────────────


@router.get("/children", response_model=APIResponseParentChildren)
async def children(
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """The guardian's children, each with the access this family actually holds."""
    return APIResponse(
        success=True,
        data=await ParentService.children(db, parent),
        message="Linked students loaded",
    )


@router.post("/children/claim", response_model=APIResponseParentClaim)
async def claim_invitation(
    payload: ParentClaimByCode,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """Attach an existing account to an invitation code the school issued."""
    return APIResponse(
        success=True,
        data=await ParentService.claim(db, parent, payload),
        message="Student linked to your account",
    )


@router.get("/overview", response_model=APIResponseParentOverview)
async def overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """Every child in one request — the family screen, not N dashboards."""
    return APIResponse(
        success=True, data=await ParentService.overview(db, parent), message="Family overview loaded"
    )


@router.get("/guardian", response_model=APIResponseParentGuardianProfile)
async def guardian_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.guardian_profile(db, parent),
        message="Guardian profile loaded",
    )


@router.patch("/guardian", response_model=APIResponseParentGuardianProfile)
async def update_guardian_profile(
    payload: ParentGuardianUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.update_guardian(db, parent, payload),
        message="Contact details updated",
    )


@router.get(
    "/children/{child_id}/dashboard", response_model=APIResponseParentChildDashboard
)
async def child_dashboard(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """The child's own dashboard, minus any section this guardian was not granted."""
    return APIResponse(
        success=True,
        data=await ParentService.dashboard(db, parent, child_id),
        message="Student overview loaded",
    )


@router.get(
    "/children/{child_id}/profile", response_model=APIResponseParentChildProfile
)
async def child_profile(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """Who to call: the child's record, class teacher and mentor."""
    return APIResponse(
        success=True,
        data=await ParentService.child_profile(db, parent, child_id),
        message="Student profile loaded",
    )


# ── C-PA-05 … C-PA-06 attendance and leave (module: attendance) ──────────────


@router.get("/children/{child_id}/attendance", response_model=APIResponseParentAttendance)
async def child_attendance(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.attendance(db, parent, child_id),
        message="Attendance loaded",
    )


@router.get(
    "/children/{child_id}/attendance/calendar",
    response_model=APIResponseParentAttendanceCalendar,
)
async def child_attendance_calendar(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
):
    return APIResponse(
        success=True,
        data=await ParentService.attendance_calendar(db, parent, child_id, month=month),
        message="Attendance calendar loaded",
    )


@router.get("/children/{child_id}/attendance/last", response_model=APIResponse[dict])
async def child_last_attendance(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """"Was my child at school today?" without shipping a whole month."""
    day, status_value = await ParentService.last_attendance(db, parent, child_id)
    return APIResponse(
        success=True,
        data={"date": day.isoformat() if day else None, "status": status_value},
        message="Last attendance loaded",
    )


@router.get("/children/{child_id}/leaves", response_model=APIResponseParentLeaves)
async def child_leaves(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ParentService.leaves(db, parent, child_id, limit=limit, offset=offset),
        message="Leave requests loaded",
    )


@router.post(
    "/children/{child_id}/leaves",
    response_model=APIResponseParentLeave,
    status_code=status.HTTP_201_CREATED,
)
async def child_apply_leave(
    child_id: uuid.UUID,
    payload: ParentLeaveCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """File an absence for the child, recorded as coming from the guardian."""
    return APIResponse(
        success=True,
        data=await ParentService.apply_leave(db, parent, child_id, payload),
        message="Leave request submitted",
    )


@router.post("/children/{child_id}/leaves/{leave_id}/cancel", response_model=APIResponseParentLeave)
async def child_cancel_leave(
    child_id: uuid.UUID,
    leave_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.cancel_leave(db, parent, child_id, leave_id),
        message="Leave request cancelled",
    )


# ── C-PA-07 … C-PA-11 the rest of the child's record ─────────────────────────


@router.get("/children/{child_id}/timetable", response_model=APIResponseParentTimetable)
async def child_timetable(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.timetable(db, parent, child_id),
        message="Timetable loaded",
    )


@router.get("/children/{child_id}/examinations", response_model=APIResponseParentExaminations)
async def child_examinations(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
    when: Literal["upcoming", "completed", "all"] | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ParentService.examinations(
            db, parent, child_id, when=when, limit=limit, offset=offset
        ),
        message="Examinations loaded",
    )


@router.get(
    "/children/{child_id}/examinations/{exam_id}/result",
    response_model=APIResponseParentExamSummary,
)
async def child_exam_result(
    child_id: uuid.UUID,
    exam_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    """Score, grade and status only — answer review belongs to the student."""
    return APIResponse(
        success=True,
        data=await ParentService.exam_result(db, parent, child_id, exam_id),
        message="Exam result loaded",
    )


@router.get("/children/{child_id}/assignments", response_model=APIResponseParentAssignments)
async def child_assignments(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
    status_filter: Literal["pending", "submitted", "graded", "all"] | None = Query(
        default=None, alias="status"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ParentService.assignments(
            db, parent, child_id, status_filter=status_filter, limit=limit, offset=offset
        ),
        message="Assignments loaded",
    )


@router.get("/children/{child_id}/results", response_model=APIResponseParentResults)
async def child_results(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.results(db, parent, child_id),
        message="Results loaded",
    )


@router.get(
    "/children/{child_id}/results/{publication_id}", response_model=APIResponseParentResult
)
async def child_result_detail(
    child_id: uuid.UUID,
    publication_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.result_detail(db, parent, child_id, publication_id),
        message="Result loaded",
    )


@router.get("/children/{child_id}/notices", response_model=APIResponseParentNotices)
async def child_notices(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
    query: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ParentService.notices(
            db, parent, child_id, query=query, limit=limit, offset=offset
        ),
        message="Notices loaded",
    )


@router.get("/children/{child_id}/fees", response_model=APIResponseParentFees)
async def child_fees(
    child_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    parent: Annotated[User, Depends(get_current_tenant_user_parent)],
):
    return APIResponse(
        success=True,
        data=await ParentService.fees(db, parent, child_id),
        message="Fee account loaded",
    )
