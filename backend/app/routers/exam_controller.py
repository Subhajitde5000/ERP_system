"""Exam Controller API (C-EC-01 … C-EC-10).

Every endpoint requires a live ``EXAM_CONTROLLER`` role assignment.
The service performs tenant filtering before every aggregate or lookup;
writes are transactional and audited via ``AuditService``.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_exam_controller
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.exam_controller import (
    APIResponseExamControllerClashCheck,
    APIResponseExamControllerDashboard,
    APIResponseExamControllerEmpty,
    APIResponseExamControllerExamPage,
    APIResponseExamControllerExamRow,
    APIResponseExamControllerGradeCards,
    APIResponseExamControllerHallAllocation,
    APIResponseExamControllerHallBoard,
    APIResponseExamControllerMalpractice,
    APIResponseExamControllerMalpracticeRow,
    APIResponseExamControllerMonitor,
    APIResponseExamControllerPreview,
    APIResponseExamControllerPublication,
    APIResponseExamControllerPublicationPage,
    APIResponseExamControllerReport,
    APIResponseExamControllerResultContext,
    APIResponseExamControllerScheduleContext,
    ExamControllerClashCheckRequest,
    ExamControllerExamCreate,
    ExamControllerExamStatusUpdate,
    ExamControllerExamUpdate,
    ExamControllerGradeCardRegenerateRequest,
    ExamControllerHallAllocationCreate,
    ExamControllerHallAllocationUpdate,
    ExamControllerMalpracticeAction,
    ExamControllerPublicationCreate,
    ExamControllerPublicationForwardRequest,
    ExamControllerPublishRequest,
)
from app.services.exam_controller_service import ExamControllerService

router = APIRouter(prefix="/exam-controller", tags=["Exam Controller"])


# ── C-EC-01 dashboard ────────────────────────────────────────────────────────


@router.get("/dashboard", response_model=APIResponseExamControllerDashboard)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.dashboard(db, controller.tenant_id),
        message="Exam Controller dashboard loaded",
    )


# ── C-EC-02 exam schedule ────────────────────────────────────────────────────


@router.get("/exams", response_model=APIResponseExamControllerExamPage)
async def exam_schedule(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
    status_filter: str | None = Query(default=None, alias="status"),
    approval_status: str | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
    department_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.schedule(
            db,
            controller.tenant_id,
            status_filter=status_filter,
            approval_status=approval_status,
            class_id=class_id,
            department_id=department_id,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        ),
        message="Exam schedule loaded",
    )


@router.get(
    "/exams/{exam_id}", response_model=APIResponseExamControllerExamRow
)
async def exam_detail(
    exam_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.get_exam(db, controller.tenant_id, exam_id),
        message="Exam loaded",
    )


# ── C-EC-03 create / edit exam schedule ─────────────────────────────────────


@router.get(
    "/schedule/context", response_model=APIResponseExamControllerScheduleContext
)
async def schedule_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.schedule_form_context(db, controller.tenant_id),
        message="Schedule context loaded",
    )


@router.post(
    "/exams", response_model=APIResponseExamControllerExamRow, status_code=201
)
async def create_exam(
    payload: ExamControllerExamCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.create_exam(
            db, controller.tenant_id, controller, payload
        ),
        message="Exam created",
    )


@router.patch(
    "/exams/{exam_id}", response_model=APIResponseExamControllerExamRow
)
async def update_exam(
    exam_id: uuid.UUID,
    payload: ExamControllerExamUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.update_exam(
            db, controller.tenant_id, controller, exam_id, payload
        ),
        message="Exam updated",
    )


@router.patch(
    "/exams/{exam_id}/status", response_model=APIResponseExamControllerExamRow
)
async def update_exam_status(
    exam_id: uuid.UUID,
    payload: ExamControllerExamStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.update_exam_status(
            db, controller.tenant_id, controller, exam_id, payload
        ),
        message="Exam status updated",
    )


@router.post(
    "/schedule/clashes", response_model=APIResponseExamControllerClashCheck
)
async def check_clashes(
    payload: ExamControllerClashCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    response = await ExamControllerService.check_clashes(
        db, controller.tenant_id, payload
    )
    response.has_blocking = any(c.blocking for c in response.clashes)
    return APIResponse(success=True, data=response, message="Clash check complete")


# ── C-EC-04 hall allocation ──────────────────────────────────────────────────


@router.get("/halls", response_model=APIResponseExamControllerHallBoard)
async def hall_board(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.hall_board(db, controller.tenant_id),
        message="Hall board loaded",
    )


@router.post(
    "/halls", response_model=APIResponseExamControllerHallAllocation, status_code=201
)
async def allocate_hall(
    payload: ExamControllerHallAllocationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.allocate_hall(
            db, controller.tenant_id, controller, payload
        ),
        message="Hall allocated",
    )


@router.patch(
    "/halls/{hall_id}", response_model=APIResponseExamControllerHallAllocation
)
async def update_hall(
    hall_id: uuid.UUID,
    payload: ExamControllerHallAllocationUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.update_hall(
            db, controller.tenant_id, controller, hall_id, payload
        ),
        message="Hall updated",
    )


@router.delete("/halls/{hall_id}", response_model=APIResponseExamControllerEmpty)
async def release_hall(
    hall_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    await ExamControllerService.release_hall(
        db, controller.tenant_id, controller, hall_id
    )
    return APIResponse(success=True, data=None, message="Hall released")


# ── C-EC-05 active exams monitor ────────────────────────────────────────────


@router.get("/monitor", response_model=APIResponseExamControllerMonitor)
async def monitor(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.monitor(db, controller.tenant_id),
        message="Monitor loaded",
    )


# ── C-EC-06 malpractice logs ─────────────────────────────────────────────────


@router.get("/malpractice", response_model=APIResponseExamControllerMalpractice)
async def malpractice_board(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.malpractice_board(db, controller.tenant_id),
        message="Malpractice board loaded",
    )


@router.patch(
    "/malpractice/{log_id}", response_model=APIResponseExamControllerMalpracticeRow
)
async def resolve_malpractice(
    log_id: uuid.UUID,
    payload: ExamControllerMalpracticeAction,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.resolve_malpractice(
            db, controller.tenant_id, controller, log_id, payload
        ),
        message="Malpractice action recorded",
    )


# ── C-EC-07 results compilation ──────────────────────────────────────────────


@router.get(
    "/publications/context",
    response_model=APIResponseExamControllerResultContext,
)
async def result_context(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.result_context(db, controller.tenant_id),
        message="Result context loaded",
    )


@router.post(
    "/publications/preview", response_model=APIResponseExamControllerPreview
)
async def preview_compilation(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    exam_ids_raw = payload.get("exam_ids") or []
    try:
        exam_ids = [uuid.UUID(str(eid)) for eid in exam_ids_raw]
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail="exam_ids must contain valid UUIDs",
        ) from exc
    preview = await ExamControllerService.preview_compilation(
        db, controller.tenant_id, exam_ids
    )
    return APIResponse(success=True, data=preview, message="Preview ready")


@router.get("/publications", response_model=APIResponseExamControllerPublicationPage)
async def list_publications(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.publications(
            db,
            controller.tenant_id,
            status_filter=status_filter,
            limit=limit,
            offset=offset,
        ),
        message="Publications loaded",
    )


@router.get(
    "/publications/{publication_id}",
    response_model=APIResponseExamControllerPublication,
)
async def get_publication(
    publication_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.get_publication(
            db, controller.tenant_id, publication_id
        ),
        message="Publication loaded",
    )


@router.post(
    "/publications", response_model=APIResponseExamControllerPublication, status_code=201
)
async def create_publication(
    payload: ExamControllerPublicationCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.compile_publication(
            db, controller.tenant_id, controller, payload
        ),
        message="Publication compiled",
    )


@router.patch(
    "/publications/{publication_id}/forward",
    response_model=APIResponseExamControllerPublication,
)
async def forward_publication(
    publication_id: uuid.UUID,
    payload: ExamControllerPublicationForwardRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.forward_publication(
            db, controller.tenant_id, controller, publication_id, payload
        ),
        message="Publication forwarded for approval",
    )


# ── C-EC-08 publish results ──────────────────────────────────────────────────


@router.patch(
    "/publications/{publication_id}/publish",
    response_model=APIResponseExamControllerPublication,
)
async def publish_results(
    publication_id: uuid.UUID,
    payload: ExamControllerPublishRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.publish_results(
            db, controller.tenant_id, controller, publication_id, payload
        ),
        message="Publication updated",
    )


# ── C-EC-09 grade cards ──────────────────────────────────────────────────────


@router.get("/grade-cards", response_model=APIResponseExamControllerGradeCards)
async def grade_cards(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.grade_cards(db, controller.tenant_id),
        message="Grade cards loaded",
    )


@router.post(
    "/grade-cards/regenerate", response_model=APIResponseExamControllerGradeCards
)
async def regenerate_grade_cards(
    payload: ExamControllerGradeCardRegenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.regenerate_grade_cards(
            db, controller.tenant_id, controller, payload
        ),
        message="Grade cards regenerated",
    )


@router.patch(
    "/publications/{publication_id}/publish-cards",
    response_model=APIResponseExamControllerGradeCards,
)
async def publish_grade_cards(
    publication_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.publish_grade_cards(
            db, controller.tenant_id, controller, publication_id
        ),
        message="Grade cards published",
    )


# ── C-EC-10 exam reports ─────────────────────────────────────────────────────


@router.get("/reports", response_model=APIResponseExamControllerReport)
async def reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    controller: Annotated[User, Depends(get_current_tenant_user_exam_controller)],
):
    return APIResponse(
        success=True,
        data=await ExamControllerService.report_overview(db, controller.tenant_id),
        message="Exam reports loaded",
    )
