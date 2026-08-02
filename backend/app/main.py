"""
ERP Backend — Main FastAPI Application Entrypoint
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.middleware.request_id import RequestIDMiddleware
from app.routers import (
    platform_auth_router,
    public_signup_router,
    owner_router,
    institution_router,
    service_requests_router,
    setup_router,
    tenant_auth_router,
)
from app.schemas.common import ErrorDetail

settings = get_settings()

# ── Rate Limiter ─────────────────────────────────────────────────────────────
# Keyed on the real client IP so a shared school NAT doesn't lock everyone out
# at the account level. Per-account lockout is enforced in the service layer.
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ERP Platform API",
    description="Multi-Tenant ERP System Backend",
    version="1.0.0",
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
)

# Attach limiter to app state so the decorator can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware Stack ─────────────────────────────────────────────────────────
# Order matters: RequestID first so every subsequent log entry has an ID.
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorDetail(
            success=False,
            error="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again later.",
            details=str(exc) if settings.APP_DEBUG else None,
        ).model_dump(),
    )


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "environment": settings.APP_ENV}


# ── Router Mounts ─────────────────────────────────────────────────────────────
api_prefix = "/api/v1"
app.include_router(platform_auth_router, prefix=api_prefix)
app.include_router(tenant_auth_router, prefix=api_prefix)
app.include_router(service_requests_router, prefix=api_prefix)
app.include_router(public_signup_router, prefix=api_prefix)
app.include_router(owner_router, prefix=api_prefix)
app.include_router(institution_router, prefix=api_prefix)
app.include_router(setup_router, prefix=api_prefix)
