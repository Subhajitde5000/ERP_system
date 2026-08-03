"""
Platform Routers Package Init
"""

from app.routers.platform.auth import router as platform_auth_router
from app.routers.platform.admin import router as platform_admin_router
from app.routers.platform.support import router as platform_support_router

__all__ = [
    "platform_auth_router",
    "platform_admin_router",
    "platform_support_router",
]
