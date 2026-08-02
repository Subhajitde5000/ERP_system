"""
Routers Package Init
"""

from app.routers.platform import platform_auth_router
from app.routers.tenant import tenant_auth_router
from app.routers.service_requests import router as service_requests_router
from app.routers.public.signup import router as public_signup_router
from app.routers.owner import router as owner_router
from app.routers.institution import router as institution_router
from app.routers.setup import router as setup_router

__all__ = [
    "platform_auth_router",
    "tenant_auth_router",
    "service_requests_router",
    "public_signup_router",
    "owner_router",
    "institution_router",
    "setup_router",
]
