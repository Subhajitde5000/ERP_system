"""
Routers — Platform Auth Router

Endpoints:
  POST /api/v1/platform/auth/login
  POST /api/v1/platform/auth/logout
  POST /api/v1/platform/auth/refresh
  GET  /api/v1/platform/auth/me
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from app.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_user
from app.models.platform_user import PlatformUser
from app.schemas.auth import (
    AccessTokenResponse,
    LogoutRequest,
    PlatformLoginRequest,
    PlatformLoginResponse,
    PlatformUserInfo,
    RefreshRequest,
)
from app.schemas.common import APIResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/platform/auth", tags=["Platform Authentication"])


@router.post("/login", response_model=APIResponse[PlatformLoginResponse])
@limiter.limit("10/minute")
async def platform_login(
    req: PlatformLoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate a platform staff member and return JWT token pair."""
    data = await AuthService.platform_login(
        email=req.email,
        password=req.password,
        request=request,
        db=db,
    )
    return APIResponse(success=True, data=data, message="Platform login successful")


@router.post("/logout", response_model=APIResponse[None])
async def platform_logout(
    req: LogoutRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[PlatformUser, Depends(get_current_platform_user)],
):
    """Revoke the current platform session."""
    await AuthService.platform_logout(refresh_token=req.refresh_token, db=db)
    return APIResponse(success=True, data=None, message="Logout successful")


@router.post("/refresh", response_model=APIResponse[AccessTokenResponse])
async def platform_refresh(
    req: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Issue a new platform access token using a valid refresh token."""
    data = await AuthService.platform_refresh(
        refresh_token=req.refresh_token, db=db
    )
    return APIResponse(
        success=True, data=data, message="Token refreshed successfully"
    )


@router.get("/me", response_model=APIResponse[PlatformUserInfo])
async def get_me(
    current_user: Annotated[PlatformUser, Depends(get_current_platform_user)],
):
    """Retrieve details of the currently authenticated platform user."""
    user_info = PlatformUserInfo(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.platform_role.value,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
    )
    return APIResponse(success=True, data=user_info, message="User profile retrieved")
