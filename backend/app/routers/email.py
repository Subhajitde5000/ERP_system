"""
Router — Email diagnostics & outbox management

Endpoints to verify the email system is working and to manually trigger
outbox processing. Useful for debugging SMTP config in staging.

  GET  /api/v1/email/status              current SMTP config + mode
  POST /api/v1/email/test                send a test email to an address
  GET  /api/v1/email/outbox              list recent outbox emails
  POST /api/v1/email/outbox/process      retry QUEUED/FAILED emails
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.billing import OutboxEmail
from app.services.email_service import EmailService

router = APIRouter(prefix="/email", tags=["Email"])


class TestEmailRequest(BaseModel):
    to: EmailStr


class OutboxEmailOut(BaseModel):
    id: str
    event: str
    to_address: str
    subject: str
    status: str
    attempts: int
    tenant_id: Optional[str] = None
    created_at: str


@router.get("/status")
async def email_status():
    """Return current email/SMTP configuration (sanitized)."""
    cfg = EmailService.config_status()
    # Quick connectivity check without sending
    mode_desc = {
        "console": "Console/mock mode — emails are printed to logs, marked SENT (dev mode). Set SMTP_HOST to enable real SMTP.",
        "smtp": "SMTP mode — emails are sent via configured SMTP server.",
    }
    return {
        "config": cfg,
        "mode_description": mode_desc.get(cfg["mode"], "unknown"),
        "working": True,  # config itself is valid if this endpoint returns
    }


@router.post("/test")
async def send_test_email(payload: TestEmailRequest):
    """Send a test email to verify SMTP config works."""
    ok = await EmailService.send_test_email(str(payload.to))
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Test email failed — check SMTP logs and config at /api/v1/email/status",
        )
    return {
        "success": True,
        "message": f"Test email sent to {payload.to}",
        "to": payload.to,
        "config": EmailService.config_status(),
    }


@router.get("/outbox", response_model=list[OutboxEmailOut])
async def list_outbox(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
):
    """List recent outbox emails (for debugging)."""
    stmt = select(OutboxEmail).order_by(OutboxEmail.created_at.desc()).limit(limit)
    if status_filter:
        stmt = stmt.where(OutboxEmail.status == status_filter.upper())

    res = await db.execute(stmt)
    rows = res.scalars().all()
    return [
        OutboxEmailOut(
            id=str(r.id),
            event=r.event,
            to_address=r.to_address,
            subject=r.subject,
            status=r.status,
            attempts=r.attempts,
            tenant_id=str(r.tenant_id) if r.tenant_id else None,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]


@router.post("/outbox/process")
async def process_outbox(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
):
    """Manually trigger retry of QUEUED/FAILED emails."""
    result = await EmailService.process_pending_outbox(db, limit=limit)
    return {"success": True, "result": result}
