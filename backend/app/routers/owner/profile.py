"""Routers — Owner profile (the 'Profile' nav item)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_owner
from app.models.platform_owner import PlatformOwner
from app.schemas.common import APIResponse
from app.schemas.owner import APIResponseOwner, ChangePasswordRequest, OwnerProfileUpdate
from app.services.owner_service import OwnerService

router = APIRouter()


@router.put("/profile", response_model=APIResponseOwner)
async def update_profile(
    payload: OwnerProfileUpdate,
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.update_profile(db, owner, payload.name)
    return APIResponse(success=True, data=data, message="Profile updated")


@router.post("/change-password", response_model=APIResponse[None])
async def change_password(
    payload: ChangePasswordRequest,
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await OwnerService.change_password(db, owner, payload)
    return APIResponse(success=True, data=None, message="Password changed — sign in again")
