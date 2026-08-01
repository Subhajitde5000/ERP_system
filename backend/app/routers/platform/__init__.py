"""
Platform Routers Package Init
"""

from app.routers.platform.auth import router as platform_auth_router

__all__ = ["platform_auth_router"]
