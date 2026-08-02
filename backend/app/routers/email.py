"""
Routers — Email system diagnostics

  GET  /api/v1/email/status        which provider is live + what is missing
  POST /api/v1/email/test          send one real test email
  POST /api/v1/email/outbox/drain  deliver everything still QUEUED

`status` is open in debug builds so you can confirm wiring from a browser;
`test` and `outbox/drain` always require a platform admin token because both
cause real sending.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies.auth import get_current_platform_user
from app.models.platform_user import PlatformUser
from app.schemas.common import APIResponse
from app.services.mailer import deliver_outbox, provider_status, send_email

router = APIRouter(prefix="/email", tags=["Email"])
settings = get_settings()


class TestEmailRequest(BaseModel):
    to: EmailStr
    note: str = "Your email configuration works."


@router.get("/status", response_model=APIResponse)
async def email_status():
    """Show the active provider without leaking any credential value."""
    return APIResponse(
        success=True, data=provider_status(), message="Email provider status"
    )


@router.post("/test", response_model=APIResponse)
async def send_test_email(
    payload: TestEmailRequest,
    current_user: Annotated[PlatformUser, Depends(get_current_platform_user)],
):
    """Send one email through whichever provider is currently active."""
    active = provider_status()
    result = await send_email(
        "mailer.test",
        to=str(payload.to),
        context={"note": payload.note, "provider": active["active_provider"]},
    )
    if not result.ok:
        raise HTTPException(
            status_code=http_status.HTTP_502_BAD_GATEWAY,
            detail=f"{result.provider}: {result.error} — {result.detail}",
        )
    return APIResponse(
        success=True,
        data={
            "provider": result.provider,
            "detail": result.detail,
            "remote_id": result.remote_id,
            "to": str(payload.to),
        },
        message="Test email sent",
    )


@router.post("/outbox/drain", response_model=APIResponse)
async def drain_outbox(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[PlatformUser, Depends(get_current_platform_user)],
    limit: int = 50,
):
    """Deliver queued emails. Safe to call repeatedly — SENT rows are skipped."""
    summary = await deliver_outbox(db, limit=limit)
    return APIResponse(
        success=True, data=summary, message=f"Delivered {summary['sent']} email(s)"
    )
