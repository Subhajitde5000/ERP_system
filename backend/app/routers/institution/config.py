"""Routers — institution admin: modules, settings, institution profile."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_admin
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.institution import (
    APIResponseModule,
    APIResponseModules,
    APIResponseProfile,
    APIResponseSettings,
    InstitutionProfileUpdate,
    ModuleToggle,
    SettingsUpdate,
)
from app.services.institution_service import InstitutionService

router = APIRouter()


# ── Modules ──────────────────────────────────────────────────────────────────

@router.get("/modules", response_model=APIResponseModules)
async def list_modules(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.list_modules(db, admin.tenant_id), message="Modules loaded")


@router.put("/modules/{module_key}", response_model=APIResponseModule)
async def toggle_module(
    module_key: str,
    payload: ModuleToggle,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    tenant = await InstitutionService._tenant(db, admin.tenant_id)
    data = await InstitutionService.toggle_module(db, tenant, module_key, payload.enabled)
    return APIResponse(success=True, data=data, message="Module updated")


# ── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=APIResponseSettings)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.get_settings(db, admin.tenant_id), message="Settings")


@router.put("/settings", response_model=APIResponseSettings)
async def update_settings(
    payload: SettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.update_settings(db, admin.tenant_id, payload), message="Settings updated")


# ── Institution profile ──────────────────────────────────────────────────────

@router.get("/profile", response_model=APIResponseProfile)
async def get_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.get_profile(db, admin.tenant_id), message="Institution profile")


@router.put("/profile", response_model=APIResponseProfile)
async def update_profile(
    payload: InstitutionProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    return APIResponse(success=True, data=await InstitutionService.update_profile(db, admin.tenant_id, payload), message="Profile updated")
