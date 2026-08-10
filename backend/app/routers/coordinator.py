"""Academic Coordinator API (C-AC-01 … C-AC-08).

Every endpoint requires a live ``ACADEMIC_COORDINATOR`` role assignment.
The service performs tenant filtering before every aggregate or lookup;
writes are transactional and audited via ``AuditService``.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_coordinator
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.coordinator import (
    APIResponseCoordinatorConflictReport,
    APIResponseCoordinatorDashboard,
    APIResponseCoordinatorEmpty,
    APIResponseCoordinatorEvent,
    APIResponseCoordinatorEventPage,
    APIResponseCoordinatorNotice,
    APIResponseCoordinatorNoticePage,
    APIResponseCoordinatorNoticeTargets,
    APIResponseCoordinatorSubstitution,
    APIResponseCoordinatorSubstitutionBoard,
    APIResponseCoordinatorSubstitutionFormContext,
    APIResponseCoordinatorTimetableGrid,
    APIResponseCoordinatorTimetableSlot,
    CoordinatorEventCreate,
    CoordinatorEventUpdate,
    CoordinatorNoticeCreate,
    CoordinatorSlotCreate,
    CoordinatorSlotUpdate,
    CoordinatorSubstitutionCreate,
)
from app.services.coordinator_service import CoordinatorService

router = APIRouter(prefix="/coordinator", tags=["Academic Coordinator"])


# ── C-AC-01 dashboard ────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=APIResponseCoordinatorDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.dashboard(db, coordinator.tenant_id),
        message="Coordinator dashboard loaded",
    )


# ── C-AC-02 timetable builder ───────────────────────────────────────────────


@router.get("/timetable", response_model=APIResponseCoordinatorTimetableGrid)
async def timetable(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
    class_id: uuid.UUID | None = Query(default=None),
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.timetable(db, coordinator.tenant_id, class_id),
        message="Timetable loaded",
    )


@router.post(
    "/timetable/slots",
    response_model=APIResponseCoordinatorTimetableSlot,
    status_code=201,
)
async def create_slot(
    payload: CoordinatorSlotCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.create_slot(
            db, coordinator.tenant_id, coordinator, payload
        ),
        message="Timetable slot created",
    )


@router.patch(
    "/timetable/slots/{slot_id}",
    response_model=APIResponseCoordinatorTimetableSlot,
)
async def update_slot(
    slot_id: uuid.UUID,
    payload: CoordinatorSlotUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.update_slot(
            db, coordinator.tenant_id, coordinator, slot_id, payload
        ),
        message="Timetable slot updated",
    )


@router.delete(
    "/timetable/slots/{slot_id}", response_model=APIResponseCoordinatorEmpty
)
async def delete_slot(
    slot_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    await CoordinatorService.delete_slot(
        db, coordinator.tenant_id, coordinator, slot_id
    )
    return APIResponse(success=True, data=None, message="Timetable slot deleted")


# ── C-AC-04 conflict checker ────────────────────────────────────────────────


@router.get("/timetable/conflicts", response_model=APIResponseCoordinatorConflictReport)
async def conflicts(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.conflicts(db, coordinator.tenant_id),
        message="Timetable conflicts loaded",
    )


# ── C-AC-05 / C-AC-06 substitution board ─────────────────────────────────────


@router.get(
    "/substitutions/board", response_model=APIResponseCoordinatorSubstitutionBoard
)
async def substitution_board(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.substitution_board(db, coordinator.tenant_id),
        message="Substitution board loaded",
    )


@router.get(
    "/substitutions/context",
    response_model=APIResponseCoordinatorSubstitutionFormContext,
)
async def substitution_form_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.substitution_form_context(
            db, coordinator.tenant_id
        ),
        message="Substitution form context loaded",
    )


@router.post(
    "/substitutions",
    response_model=APIResponseCoordinatorSubstitution,
    status_code=201,
)
async def create_substitution(
    payload: CoordinatorSubstitutionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.create_substitution(
            db, coordinator.tenant_id, coordinator, payload
        ),
        message="Substitution arranged",
    )


@router.delete(
    "/substitutions/{substitution_id}", response_model=APIResponseCoordinatorEmpty
)
async def delete_substitution(
    substitution_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    await CoordinatorService.delete_substitution(
        db, coordinator.tenant_id, coordinator, substitution_id
    )
    return APIResponse(success=True, data=None, message="Substitution removed")


# ── C-AC-07 academic calendar ───────────────────────────────────────────────


@router.get("/calendar/events", response_model=APIResponseCoordinatorEventPage)
async def events(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    event_type: Literal["HOLIDAY", "EVENT", "EXAM", "TERM"] | None = Query(default=None),
    include_past: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.events(
            db,
            coordinator.tenant_id,
            from_date=from_date,
            to_date=to_date,
            event_type=event_type,
            include_past=include_past,
            limit=limit,
            offset=offset,
        ),
        message="Academic events loaded",
    )


@router.post(
    "/calendar/events",
    response_model=APIResponseCoordinatorEvent,
    status_code=201,
)
async def create_event(
    payload: CoordinatorEventCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.create_event(
            db, coordinator.tenant_id, coordinator, payload
        ),
        message="Academic event created",
    )


@router.patch(
    "/calendar/events/{event_id}", response_model=APIResponseCoordinatorEvent
)
async def update_event(
    event_id: uuid.UUID,
    payload: CoordinatorEventUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.update_event(
            db, coordinator.tenant_id, coordinator, event_id, payload
        ),
        message="Academic event updated",
    )


@router.delete(
    "/calendar/events/{event_id}", response_model=APIResponseCoordinatorEmpty
)
async def delete_event(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    await CoordinatorService.delete_event(
        db, coordinator.tenant_id, coordinator, event_id
    )
    return APIResponse(success=True, data=None, message="Academic event deleted")


# ── C-AC-08 post academic notice ────────────────────────────────────────────


@router.get(
    "/notices/targets", response_model=APIResponseCoordinatorNoticeTargets
)
async def notice_targets(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.notice_targets(db, coordinator.tenant_id),
        message="Notice targets loaded",
    )


@router.get("/notices", response_model=APIResponseCoordinatorNoticePage)
async def notices(
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
    query: str | None = Query(default=None, max_length=100),
    include_expired: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.notices(
            db,
            coordinator.tenant_id,
            query=query,
            include_expired=include_expired,
            limit=limit,
            offset=offset,
        ),
        message="Notices loaded",
    )


@router.post(
    "/notices", response_model=APIResponseCoordinatorNotice, status_code=201
)
async def create_notice(
    payload: CoordinatorNoticeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    coordinator: Annotated[User, Depends(get_current_tenant_user_coordinator)],
):
    return APIResponse(
        success=True,
        data=await CoordinatorService.create_notice(
            db, coordinator.tenant_id, coordinator, payload
        ),
        message="Notice published",
    )
