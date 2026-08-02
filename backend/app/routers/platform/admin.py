"""
Routers — Super Admin console (C-SA-01 … C-SA-08)

The five API groups named in `complete_webpage_developer_assignment.md` §2.1:

  GET/POST/PATCH/DELETE /api/v1/platform/tenants
  GET/POST/PATCH        /api/v1/platform/plans
  GET/POST/PATCH        /api/v1/platform/users
  GET                   /api/v1/platform/audit-logs
  GET                   /api/v1/platform/dashboard-stats

Plus `/settings` (C-SA-08) and `/subscriptions`, which the console's settings
page and the shared Sales view need.

Authorisation is one dependency, `require_super_admin`, applied to the whole
router — every route here is Super-Admin-only, so guarding per-route would be
12 copies of the same check.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_user
from app.models.platform_user import PlatformRole, PlatformUser
from app.schemas.common import APIResponse
from app.schemas.platform_admin import (
    APIResponseAudit,
    APIResponsePlan,
    APIResponsePlans,
    APIResponsePlatformUser,
    APIResponsePlatformUsers,
    APIResponseSettings,
    APIResponseStats,
    APIResponseSubscriptions,
    APIResponseTenant,
    APIResponseTenantCreated,
    APIResponseTenantDetail,
    APIResponseTenants,
    PlanCreate,
    PlanUpdate,
    PlatformSettingsUpdate,
    PlatformUserCreate,
    PlatformUserUpdate,
    TenantCreate,
    TenantUpdate,
)
from app.services.audit_service import AuditService
from app.services.platform_admin_service import PlatformAdminService

router = APIRouter(prefix="/platform", tags=["Super Admin"])


async def require_super_admin(
    current: Annotated[PlatformUser, Depends(get_current_platform_user)],
) -> PlatformUser:
    """
    §4.1 — only the Super Admin runs this console.

    Support/Sales/Finance authenticate against the same `platform_users` table
    and would otherwise reach these routes with a valid token.
    """
    if current.platform_role != PlatformRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This console is restricted to Super Admin accounts",
        )
    return current


Admin = Annotated[PlatformUser, Depends(require_super_admin)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ══ C-SA-01 · Dashboard ══════════════════════════════════════════════════════

@router.get("/dashboard-stats", response_model=APIResponseStats)
async def dashboard_stats(db: DB, admin: Admin):
    """KPIs: institutions, students, MRR, tickets, revenue trend, plan mix."""
    return APIResponse(
        success=True, data=await PlatformAdminService.stats(db), message="Stats loaded"
    )


# ══ C-SA-02/03/04 · Tenants ══════════════════════════════════════════════════

@router.get("/tenants", response_model=APIResponseTenants)
async def list_tenants(
    db: DB,
    admin: Admin,
    search: str | None = None,
    plan: str | None = None,
    state: str | None = Query(default=None, description="ALL|TRIAL|ACTIVE|PAST_DUE|CANCELLED|SUSPENDED"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    data = await PlatformAdminService.list_tenants(
        db, search=search, plan_slug=plan, state=state, limit=limit, offset=offset
    )
    return APIResponse(success=True, data=data, message=f"{len(data)} institution(s)")


@router.post("/tenants", response_model=APIResponseTenantCreated, status_code=201)
async def create_tenant(payload: TenantCreate, request: Request, db: DB, admin: Admin):
    """Create tenant + subscription + admin + modules, and email activation."""
    data = await PlatformAdminService.create_tenant(db, payload, admin, request)
    return APIResponse(
        success=True, data=data, message="Institution created — activation email sent"
    )


@router.get("/tenants/{tenant_id}", response_model=APIResponseTenantDetail)
async def tenant_detail(tenant_id: uuid.UUID, db: DB, admin: Admin):
    data = await PlatformAdminService.tenant_detail(db, tenant_id)
    return APIResponse(success=True, data=data, message="Institution loaded")


@router.patch("/tenants/{tenant_id}", response_model=APIResponseTenant)
async def update_tenant(
    tenant_id: uuid.UUID, payload: TenantUpdate, request: Request, db: DB, admin: Admin
):
    data = await PlatformAdminService.update_tenant(db, tenant_id, payload, admin, request)
    return APIResponse(success=True, data=data, message="Institution updated")


@router.put("/tenants/{tenant_id}/active", response_model=APIResponseTenant)
async def set_tenant_active(
    tenant_id: uuid.UUID,
    active: Annotated[bool, Query(description="false suspends, true reactivates")],
    request: Request,
    db: DB,
    admin: Admin,
):
    """Suspend or reactivate — locks every user out without deleting anything."""
    data = await PlatformAdminService.set_tenant_active(db, tenant_id, active, admin, request)
    return APIResponse(
        success=True,
        data=data,
        message="Institution reactivated" if active else "Institution suspended",
    )


@router.delete("/tenants/{tenant_id}", response_model=APIResponse)
async def delete_tenant(tenant_id: uuid.UUID, request: Request, db: DB, admin: Admin):
    """Soft delete: deactivate + cancel subscriptions. History is preserved."""
    await PlatformAdminService.delete_tenant(db, tenant_id, admin, request)
    return APIResponse(success=True, data=None, message="Institution deleted")


# ══ C-SA-05 · Plans ══════════════════════════════════════════════════════════

@router.get("/plans", response_model=APIResponsePlans)
async def list_plans(db: DB, admin: Admin):
    data = await PlatformAdminService.list_plans(db)
    return APIResponse(success=True, data=data, message=f"{len(data)} plan(s)")


@router.post("/plans", response_model=APIResponsePlan, status_code=201)
async def create_plan(payload: PlanCreate, request: Request, db: DB, admin: Admin):
    data = await PlatformAdminService.create_plan(db, payload, admin, request)
    return APIResponse(success=True, data=data, message="Plan created")


@router.patch("/plans/{plan_id}", response_model=APIResponsePlan)
async def update_plan(
    plan_id: uuid.UUID, payload: PlanUpdate, request: Request, db: DB, admin: Admin
):
    data = await PlatformAdminService.update_plan(db, plan_id, payload, admin, request)
    return APIResponse(success=True, data=data, message="Plan updated")


# ══ C-SA-06 · Platform users ═════════════════════════════════════════════════

@router.get("/users", response_model=APIResponsePlatformUsers)
async def list_platform_users(db: DB, admin: Admin):
    data = await PlatformAdminService.list_platform_users(db)
    return APIResponse(success=True, data=data, message=f"{len(data)} staff account(s)")


@router.post("/users", response_model=APIResponsePlatformUser, status_code=201)
async def create_platform_user(
    payload: PlatformUserCreate, request: Request, db: DB, admin: Admin
):
    data = await PlatformAdminService.create_platform_user(db, payload, admin, request)
    return APIResponse(success=True, data=data, message="Staff account created")


@router.patch("/users/{user_id}", response_model=APIResponsePlatformUser)
async def update_platform_user(
    user_id: uuid.UUID,
    payload: PlatformUserUpdate,
    request: Request,
    db: DB,
    admin: Admin,
):
    data = await PlatformAdminService.update_platform_user(db, user_id, payload, admin, request)
    return APIResponse(success=True, data=data, message="Staff account updated")


# ══ C-SA-07 · Audit logs ═════════════════════════════════════════════════════

@router.get("/audit-logs", response_model=APIResponseAudit)
async def audit_logs(
    db: DB,
    admin: Admin,
    # camelCase aliases keep every query string in this router consistent with
    # the camelCase JSON bodies the console already sends.
    tenant_id: uuid.UUID | None = Query(default=None, alias="tenantId"),
    platform_only: bool = Query(
        default=False, alias="platformOnly", description="Only tenant_id IS NULL"
    ),
    action: str | None = None,
    entity: str | None = None,
    search: str | None = None,
    since: str | None = Query(default=None, description="ISO date, inclusive"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Read-only: `audit_logs` is append-only (§10.3)."""
    data = await AuditService.list_entries(
        db,
        tenant_id=tenant_id,
        platform_only=platform_only,
        action=action,
        entity=entity,
        search=search,
        since=since,
        limit=limit,
        offset=offset,
    )
    return APIResponse(success=True, data=data, message=f"{data.total} entr(ies)")


# ══ C-SA-08 · Settings ═══════════════════════════════════════════════════════

@router.get("/settings", response_model=APIResponseSettings)
async def get_platform_settings(db: DB, admin: Admin):
    data = await PlatformAdminService.get_settings_page(db)
    return APIResponse(success=True, data=data, message="Settings loaded")


@router.patch("/settings", response_model=APIResponseSettings)
async def update_platform_settings(
    payload: PlatformSettingsUpdate, request: Request, db: DB, admin: Admin
):
    data = await PlatformAdminService.update_settings(db, payload, admin, request)
    return APIResponse(success=True, data=data, message="Settings saved")


# ══ Subscriptions ════════════════════════════════════════════════════════════

@router.get("/subscriptions", response_model=APIResponseSubscriptions)
async def list_subscriptions(
    db: DB,
    admin: Admin,
    status_filter: str | None = Query(default=None, alias="status"),
):
    data = await PlatformAdminService.list_subscriptions(db, status_filter=status_filter)
    return APIResponse(success=True, data=data, message=f"{len(data)} subscription(s)")
