"""
Routers — First-Time Setup Wizard (institution admin)

Authenticated tenant endpoints. The tenant is resolved from the JWT
(`get_current_tenant_user`); only INSTITUTION_ADMIN (or ACCOUNTANT when
finance is enabled) may run the wizard.

  GET  /api/v1/setup            current wizard state + entity counts
  PUT  /api/v1/setup            persist the whole 12-step state
  POST /api/v1/setup/complete   materialise state into tables, mark done
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.setup import (
    APIResponseSetup,
    SetupResponse,
    SetupState,
)
from app.services.setup_service import SetupService

router = APIRouter(prefix="/setup", tags=["Setup Wizard"])


@router.get("", response_model=APIResponseSetup)
async def get_setup(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_tenant_user)],
):
    """Resume the wizard — server-side state survives refresh/device switch."""
    data: SetupResponse = await SetupService.get_state(db, current_user.tenant_id)
    return APIResponse(success=True, data=data, message="Setup state loaded")


@router.put("", response_model=APIResponseSetup)
async def save_setup(
    payload: SetupState,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_tenant_user)],
):
    """Persist the wizard state after each step."""
    data: SetupResponse = await SetupService.save_state(
        db, current_user.tenant_id, payload
    )
    return APIResponse(success=True, data=data, message="Setup state saved")


@router.post("/complete", response_model=APIResponseSetup)
async def complete_setup(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_tenant_user)],
):
    """Finish the wizard — materialises departments/classes/subjects/staff/
    students/modules and opens the dashboard."""
    data: SetupResponse = await SetupService.complete(db, current_user.tenant_id)
    return APIResponse(
        success=True, data=data, message="Setup complete — dashboard unlocked"
    )
