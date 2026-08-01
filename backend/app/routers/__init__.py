"""
Routers Package Init
"""

from app.routers.platform import platform_auth_router
from app.routers.tenant import tenant_auth_router

__all__ = ["platform_auth_router", "tenant_auth_router"]
