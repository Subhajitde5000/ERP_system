"""
Tenant Routers Package Init
"""

from app.routers.tenant.auth import router as tenant_auth_router

__all__ = ["tenant_auth_router"]
