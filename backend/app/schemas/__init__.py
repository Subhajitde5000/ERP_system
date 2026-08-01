"""Schemas package."""

from app.schemas.common import APIResponse, ErrorDetail
from app.schemas.auth import (
    PlatformLoginRequest,
    TenantLoginRequest,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    PlatformUserInfo,
    TenantUserInfo,
    PlatformLoginResponse,
    TenantLoginResponse,
)

__all__ = [
    "APIResponse",
    "ErrorDetail",
    "PlatformLoginRequest",
    "TenantLoginRequest",
    "TokenResponse",
    "RefreshRequest",
    "LogoutRequest",
    "PlatformUserInfo",
    "TenantUserInfo",
    "PlatformLoginResponse",
    "TenantLoginResponse",
]
