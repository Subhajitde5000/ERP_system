"""
Services — Email Delivery

Central email service that actually delivers messages.

Previous implementation only wrote to `outbox_emails` table (QUEUED)
and never sent anything. This service fixes that:

  - `send_email()` — low-level SMTP delivery with console fallback
  - `queue_and_send()` — create OutboxEmail row + attempt delivery immediately
  - `send_templated_*` — high-level helpers for verification, welcome, invite,
    password reset, etc.
  - `process_pending_outbox()` — background worker to retry QUEUED/FAILED

In development (SMTP_HOST empty or EMAIL_FORCE_CONSOLE=True), emails are
printed to stdout and marked SENT so the flow can be tested without a real
SMTP server. In production, set SMTP_* env vars.

Retries: attempts counter + status (QUEUED -> SENT / FAILED). Worker can be
triggered via API `POST /api/v1/email/outbox/process` or run as cron.

Usage:
    from app.services.email_service import EmailService
    await EmailService.send_email(to="user@example.com", subject="...", body_text="...")
    await EmailService.queue_and_send(db, event="owner.verify_email", to_address=..., subject=..., body=...)
"""

import asyncio
import logging
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.billing import OutboxEmail

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    # ── Low-level delivery ────────────────────────────────────────────────────

    @staticmethod
    async def send_email(
        to_address: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
    ) -> bool:
        """
        Send an email via SMTP or console fallback.
        Returns True on success, False on failure.
        Never raises — caller decides what to do with failures.
        """
        to_address = to_address.strip().lower()
        s = get_settings()

        # Console / mock mode if SMTP not configured
        use_console = (
            not s.EMAIL_ENABLED
            or s.EMAIL_FORCE_CONSOLE
            or not s.SMTP_HOST
        )

        if use_console:
            # Log + print for dev visibility
            logger.info(f"[EMAIL MOCK] To={to_address} Subject={subject}")
            print(
                f"\n{'='*60}\n"
                f"[MOCK EMAIL] To: {to_address}\n"
                f"From: {s.SMTP_FROM_NAME} <{s.SMTP_FROM}>\n"
                f"Subject: {subject}\n"
                f"{'-'*60}\n"
                f"{body_text}\n"
                f"{'='*60}\n"
            )
            return True

        # Build MIME message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{s.SMTP_FROM_NAME} <{s.SMTP_FROM}>"
        msg["To"] = to_address

        # Always add plain text
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            msg.attach(MIMEText(body_html, "html", "utf-8"))

        def _send_sync() -> None:
            """Blocking SMTP send — runs in threadpool."""
            if s.SMTP_SSL:
                server = smtplib.SMTP_SSL(s.SMTP_HOST, s.SMTP_PORT, timeout=15)
            else:
                server = smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=15)
                if s.SMTP_TLS:
                    server.starttls()
            if s.SMTP_USER and s.SMTP_PASSWORD:
                server.login(s.SMTP_USER, s.SMTP_PASSWORD)
            server.sendmail(s.SMTP_FROM, [to_address], msg.as_string())
            server.quit()

        try:
            await asyncio.to_thread(_send_sync)
            logger.info(f"Email SENT to {to_address} | {subject}")
            return True
        except Exception as exc:
            logger.error(f"Email FAILED to {to_address} | {subject} | {exc}", exc_info=True)
            return False

    # ── Outbox queue + immediate send ─────────────────────────────────────────

    @staticmethod
    async def queue_and_send(
        db: AsyncSession,
        *,
        event: str,
        to_address: str,
        subject: str,
        body: str,
        body_html: Optional[str] = None,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> OutboxEmail:
        """
        Create OutboxEmail row QUEUED, flush, then attempt delivery.
        Updates status to SENT or FAILED and commits attempt count.
        Returns the OutboxEmail instance.
        """
        outbox = OutboxEmail(
            id=uuid.uuid4(),
            event=event,
            to_address=to_address.strip().lower(),
            subject=subject,
            body=body,
            status="QUEUED",
            attempts=0,
            tenant_id=tenant_id,
        )
        db.add(outbox)
        await db.flush()

        # Attempt immediate delivery
        success = await EmailService.send_email(
            to_address=to_address,
            subject=subject,
            body_text=body,
            body_html=body_html,
        )
        outbox.attempts = 1
        outbox.status = "SENT" if success else "FAILED"
        await db.flush()
        # Note: caller should commit() — we only flush so transaction stays atomic
        return outbox

    @staticmethod
    async def process_pending_outbox(db: AsyncSession, limit: int = 20) -> dict:
        """
        Worker: fetch QUEUED/FAILED emails (attempts < 5) and retry delivery.
        Returns summary dict.
        """
        stmt = (
            select(OutboxEmail)
            .where(OutboxEmail.status.in_(["QUEUED", "FAILED"]), OutboxEmail.attempts < 5)
            .order_by(OutboxEmail.created_at.asc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        pending = list(res.scalars().all())

        sent = 0
        failed = 0
        for email in pending:
            ok = await EmailService.send_email(
                to_address=email.to_address,
                subject=email.subject,
                body_text=email.body,
            )
            email.attempts += 1
            if ok:
                email.status = "SENT"
                sent += 1
            else:
                email.status = "FAILED"
                failed += 1
            await db.flush()

        if pending:
            await db.commit()

        return {
            "processed": len(pending),
            "sent": sent,
            "failed": failed,
            "remaining_queued": await EmailService._count_queued(db),
        }

    @staticmethod
    async def _count_queued(db: AsyncSession) -> int:
        from sqlalchemy import func
        res = await db.execute(
            select(func.count(OutboxEmail.id)).where(OutboxEmail.status == "QUEUED")
        )
        return res.scalar() or 0

    # ── Templated helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _frontend_base() -> str:
        s = get_settings()
        # Prefer explicit FRONTEND_URL, fall back to root domain
        if s.FRONTEND_URL:
            return s.FRONTEND_URL.rstrip("/")
        domain = s.PUBLIC_ROOT_DOMAIN or "xyz.com"
        return f"https://{domain}"

    @staticmethod
    def _root_domain() -> str:
        return get_settings().PUBLIC_ROOT_DOMAIN or "xyz.com"

    @staticmethod
    async def send_owner_verification(
        db: AsyncSession, to_address: str, name: str, token: str
    ) -> OutboxEmail:
        domain = EmailService._root_domain()
        frontend = EmailService._frontend_base()
        verify_url = f"{frontend}/verify-email?token={token}"
        # Fallback if frontend url path differs — platform verify uses /verify-email?token=
        subject = "Verify your xyz.com account"
        body_text = (
            f"Hi {name},\n\n"
            f"Thank you for creating your account on {domain}.\n\n"
            f"Please verify your email to activate your platform account:\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours.\n\n"
            f"If you didn't create this account, you can ignore this email.\n\n"
            f"— The {domain} Team"
        )
        body_html = f"""
        <p>Hi {name},</p>
        <p>Thank you for creating your account on <strong>{domain}</strong>.</p>
        <p>Please verify your email to activate your platform account:</p>
        <p><a href="{verify_url}" style="background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Verify Email</a></p>
        <p>Or copy this link:<br><a href="{verify_url}">{verify_url}</a></p>
        <p>This link expires in 24 hours.</p>
        <p>— The {domain} Team</p>
        """
        return await EmailService.queue_and_send(
            db, event="owner.verify_email", to_address=to_address,
            subject=subject, body=body_text, body_html=body_html
        )

    @staticmethod
    async def send_platform_owner_verification(
        db: AsyncSession, to_address: str, token: str
    ) -> OutboxEmail:
        domain = EmailService._root_domain()
        frontend = EmailService._frontend_base()
        verify_url = f"{frontend}/verify-email?token={token}"
        subject = f"Verify your {domain} platform account"
        body_text = (
            f"Welcome to {domain}. Verify your platform account before creating institutions.\n\n"
            f"Verification link: {verify_url}\n"
            f"Raw token (alternative): {token}\n\n"
            f"This link expires in 24 hours."
        )
        body_html = f"""
        <p>Welcome to <strong>{domain}</strong>.</p>
        <p>Verify your platform account:</p>
        <p><a href="{verify_url}">{verify_url}</a></p>
        <p>Token: <code>{token}</code></p>
        """
        return await EmailService.queue_and_send(
            db, event="platform_owner.verify_email", to_address=to_address,
            subject=subject, body=body_text, body_html=body_html
        )

    @staticmethod
    async def send_welcome_email(
        db: AsyncSession,
        to_address: str,
        institution_name: str,
        login_url: str,
        plan_name: str,
        modules: list[str],
        tenant_id: Optional[uuid.UUID] = None,
    ) -> OutboxEmail:
        domain = EmailService._root_domain()
        subject = f"Welcome to {institution_name} — your ERP is ready"
        modules_str = ", ".join(modules) if modules else "core modules"
        body_text = (
            f"Your institution {institution_name} has been created.\n\n"
            f"Platform dashboard: https://{domain}/platform/dashboard\n"
            f"Institution login URL: {login_url}\n"
            f"Plan: {plan_name}\n"
            f"Modules: {modules_str}\n\n"
            f"Set your password and complete the setup wizard to get started.\n\n"
            f"— The {domain} Team"
        )
        body_html = f"""
        <h2>Welcome to {institution_name}!</h2>
        <p>Your institution has been created on <strong>{domain}</strong>.</p>
        <ul>
            <li>Platform dashboard: <a href="https://{domain}/platform/dashboard">https://{domain}/platform/dashboard</a></li>
            <li>Institution login: <a href="{login_url}">{login_url}</a></li>
            <li>Plan: {plan_name}</li>
            <li>Modules: {modules_str}</li>
        </ul>
        <p>Set your password and complete the setup wizard.</p>
        <p>— The {domain} Team</p>
        """
        return await EmailService.queue_and_send(
            db, event="tenant.provisioned", to_address=to_address,
            subject=subject, body=body_text, body_html=body_html, tenant_id=tenant_id
        )

    @staticmethod
    async def send_staff_invite(
        db: AsyncSession,
        to_address: str,
        staff_name: str,
        institution_name: str,
        invite_url: str,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> OutboxEmail:
        domain = EmailService._root_domain()
        subject = f"You are invited to {institution_name}"
        body_text = (
            f"Hi {staff_name},\n\n"
            f"You have been added to {institution_name} on {domain}.\n"
            f"Set your password to activate your account:\n{invite_url}\n\n"
            f"This link expires in 7 days.\n\n"
            f"— {institution_name}"
        )
        body_html = f"""
        <p>Hi {staff_name},</p>
        <p>You have been added to <strong>{institution_name}</strong> on {domain}.</p>
        <p><a href="{invite_url}" style="background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Set Your Password</a></p>
        <p>Or copy: <a href="{invite_url}">{invite_url}</a></p>
        <p>Link expires in 7 days.</p>
        <p>— {institution_name}</p>
        """
        return await EmailService.queue_and_send(
            db, event="staff.invited", to_address=to_address,
            subject=subject, body=body_text, body_html=body_html, tenant_id=tenant_id
        )

    @staticmethod
    async def send_password_reset(
        db: AsyncSession,
        to_address: str,
        name: str,
        reset_url: str,
        is_owner: bool = True,
        tenant_slug: Optional[str] = None,
    ) -> OutboxEmail:
        domain = EmailService._root_domain()
        if is_owner:
            subject = f"Reset your {domain} password"
            event = "owner.password_reset"
        else:
            subject = f"Reset your password — {tenant_slug}.{domain}" if tenant_slug else "Reset your password"
            event = "tenant.password_reset"

        body_text = (
            f"Hi {name},\n\n"
            f"You requested a password reset.\n\n"
            f"Reset your password using this link:\n{reset_url}\n\n"
            f"This link expires in 30 minutes.\n"
            f"If you didn't request this, you can ignore this email.\n\n"
            f"— The {domain} Team"
        )
        body_html = f"""
        <p>Hi {name},</p>
        <p>You requested a password reset.</p>
        <p><a href="{reset_url}" style="background:#ef4444;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Reset Password</a></p>
        <p>Or copy: <a href="{reset_url}">{reset_url}</a></p>
        <p>Link expires in 30 minutes.</p>
        <p>— The {domain} Team</p>
        """
        return await EmailService.queue_and_send(
            db, event=event, to_address=to_address,
            subject=subject, body=body_text, body_html=body_html
        )

    @staticmethod
    async def send_test_email(to_address: str) -> bool:
        """Send a simple test email to verify SMTP config."""
        subject = "ERP System — Test Email"
        body_text = (
            "This is a test email from your ERP system.\n\n"
            "If you received this, your email sending configuration is working correctly!\n\n"
            "SMTP settings:\n"
            f"  Host: {get_settings().SMTP_HOST}:{get_settings().SMTP_PORT}\n"
            f"  From: {get_settings().SMTP_FROM}\n"
            f"  TLS: {get_settings().SMTP_TLS} SSL: {get_settings().SMTP_SSL}\n"
        )
        body_html = f"""
        <h2>ERP Email Test — Success!</h2>
        <p>If you received this, your email configuration is working!</p>
        <ul>
            <li>Host: {get_settings().SMTP_HOST}:{get_settings().SMTP_PORT}</li>
            <li>From: {get_settings().SMTP_FROM}</li>
            <li>TLS: {get_settings().SMTP_TLS} SSL: {get_settings().SMTP_SSL}</li>
        </ul>
        """
        return await EmailService.send_email(to_address, subject, body_text, body_html)

    @staticmethod
    def config_status() -> dict:
        s = get_settings()
        return {
            "enabled": s.EMAIL_ENABLED,
            "force_console": s.EMAIL_FORCE_CONSOLE,
            "smtp_host": s.SMTP_HOST or None,
            "smtp_port": s.SMTP_PORT,
            "smtp_user": s.SMTP_USER or None,
            "smtp_from": s.SMTP_FROM,
            "smtp_from_name": s.SMTP_FROM_NAME,
            "smtp_tls": s.SMTP_TLS,
            "smtp_ssl": s.SMTP_SSL,
            "frontend_url": s.FRONTEND_URL,
            "public_root_domain": s.PUBLIC_ROOT_DOMAIN,
            "mode": "console" if (not s.SMTP_HOST or s.EMAIL_FORCE_CONSOLE or not s.EMAIL_ENABLED) else "smtp",
        }
