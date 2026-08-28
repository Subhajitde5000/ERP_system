"""
Routers — Tenant Auth Router

Endpoints:
  POST /api/v1/tenant/auth/login
  POST /api/v1/tenant/auth/logout
  POST /api/v1/tenant/auth/refresh
  POST /api/v1/tenant/auth/forgot-password
  GET  /api/v1/tenant/auth/reset-password/verify
  POST /api/v1/tenant/auth/reset-password
  GET  /api/v1/tenant/auth/me
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from app.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user, rls_public_bypass
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    TenantLoginRequest,
    TenantLoginResponse,
    TenantUserInfo,
)
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService, _load_tenant_user_permissions

router = APIRouter(prefix="/tenant/auth", tags=["Tenant Authentication"])


@router.post("/login", response_model=APIResponse[TenantLoginResponse])
@limiter.limit("10/minute")
async def tenant_login(
    req: TenantLoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rls: Annotated[None, Depends(rls_public_bypass)],
):
    """Authenticate an institution user. Accepts email or student roll number."""
    data = await AuthService.tenant_login(
        slug=req.slug,
        identifier=req.identifier,
        password=req.password,
        request=request,
        db=db,
    )
    return APIResponse(success=True, data=data, message="Tenant login successful")


@router.post("/logout", response_model=APIResponse[None])
async def tenant_logout(
    req: LogoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_tenant_user)],
):
    """Revoke the current user session."""
    await AuthService.tenant_logout(refresh_token=req.refresh_token, db=db)
    return APIResponse(success=True, data=None, message="Logout successful")


@router.post("/refresh", response_model=APIResponse[AccessTokenResponse])
async def tenant_refresh(
    req: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rls: Annotated[None, Depends(rls_public_bypass)],
):
    """Refresh an expired access token using a valid refresh token."""
    data = await AuthService.tenant_refresh(
        refresh_token=req.refresh_token, db=db
    )
    return APIResponse(
        success=True, data=data, message="Token refreshed successfully"
    )


@router.post("/forgot-password", response_model=APIResponse[None])
@limiter.limit("5/hour")
async def tenant_forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rls: Annotated[None, Depends(rls_public_bypass)],
):
    """
    Request a password reset link.
    Always returns 200 — never reveals whether an account exists.
    """
    await AuthService.tenant_forgot_password(
        slug=req.slug, identifier=req.identifier, db=db
    )
    return APIResponse(
        success=True,
        data=None,
        message="If an account matches, a reset link has been sent.",
    )


@router.get("/reset-password/verify", response_model=APIResponse[None])
async def verify_reset_token(
    token: Annotated[str, Query(min_length=1)],
    db: Annotated[AsyncSession, Depends(get_db)],
    _rls: Annotated[None, Depends(rls_public_bypass)],
):
    """
    Verify that a reset token is present and unexpired.
    Called server-side by the Next.js reset-password page before rendering
    the form.  Returns 200 if valid, 400 if invalid or expired.
    """
    await AuthService.verify_reset_token(token=token, db=db)
    return APIResponse(success=True, data=None, message="Token is valid")


@router.post("/reset-password", response_model=APIResponse[None])
@limiter.limit("10/hour")
async def tenant_reset_password(
    req: ResetPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    _rls: Annotated[None, Depends(rls_public_bypass)],
):
    """Set a new password using a valid reset token (30-minute window)."""
    await AuthService.tenant_reset_password(
        token=req.token, new_password=req.password, db=db
    )
    return APIResponse(
        success=True, data=None, message="Password updated successfully"
    )


@router.get("/me", response_model=APIResponse[TenantUserInfo])
async def get_me(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve profile and permissions for the authenticated institution user."""
    roles, permissions, primary_role = await _load_tenant_user_permissions(
        current_user.id, current_user.tenant_id, db
    )
    user_info = TenantUserInfo(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        role=primary_role,
        roles=roles,
        permissions=permissions,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
    )
    return APIResponse(
        success=True, data=user_info, message="User profile retrieved"
    )
