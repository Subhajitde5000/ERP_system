"""
Mailer provider — GOOGLE (Gmail / Google Workspace SMTP)

Sends the real MIME message over smtp.gmail.com using an App Password.
This is the only file that knows what SMTP is.

Setup (2 minutes):
  1. Enable 2-Step Verification on the sending Google account.
  2. https://myaccount.google.com/apppasswords → generate a 16-char password.
  3. In .env:
       EMAIL_PROVIDER=google
       GOOGLE_SMTP_USER=you@yourdomain.com
       GOOGLE_SMTP_PASSWORD=xxxxxxxxxxxxxxxx   # App Password, not your login
       EMAIL_FROM=you@yourdomain.com

Port 587 uses STARTTLS, port 465 uses implicit TLS — handled automatically.
Any other SMTP host (Workspace relay, Mailgun, SES) works by pointing
GOOGLE_SMTP_HOST elsewhere; nothing here is Gmail-specific beyond defaults.
"""

from __future__ import annotations

from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import aiosmtplib

from app.services.mailer.base import (
    MailMessage,
    MailProvider,
    PermanentSendError,
    SendResult,
)

# SMTP replies that will never succeed on retry (bad mailbox, bad auth).
_PERMANENT_CODES = {501, 503, 510, 511, 530, 535, 550, 553}


class GoogleMailProvider(MailProvider):
    name = "google"
    required_settings = ("GOOGLE_SMTP_USER", "GOOGLE_SMTP_PASSWORD", "EMAIL_FROM")

    async def deliver(self, msg: MailMessage) -> SendResult:
        s = self.settings
        mime = EmailMessage()
        mime["From"] = formataddr((s.EMAIL_FROM_NAME, s.EMAIL_FROM))
        mime["To"] = (
            formataddr((msg.recipient_name() or "", msg.to))
            if msg.recipient_name()
            else msg.to
        )
        mime["Subject"] = msg.subject
        mime["Message-ID"] = make_msgid(domain=s.EMAIL_FROM.split("@")[-1])
        if s.EMAIL_REPLY_TO:
            mime["Reply-To"] = s.EMAIL_REPLY_TO
        if msg.idempotency_key:
            # Helps downstream tooling collapse duplicates from outbox retries.
            mime["X-Entity-Ref-ID"] = msg.idempotency_key
        mime["X-ERP-Event"] = msg.event

        mime.set_content(msg.text or " ")
        if msg.html:
            mime.add_alternative(msg.html, subtype="html")

        port = int(s.GOOGLE_SMTP_PORT)
        try:
            await aiosmtplib.send(
                mime,
                hostname=s.GOOGLE_SMTP_HOST,
                port=port,
                username=s.GOOGLE_SMTP_USER,
                password=s.GOOGLE_SMTP_PASSWORD,
                start_tls=port == 587,
                use_tls=port == 465,
                timeout=s.EMAIL_TIMEOUT_SECONDS,
            )
        except aiosmtplib.SMTPResponseException as exc:
            if exc.code in _PERMANENT_CODES:
                raise PermanentSendError(f"SMTP {exc.code}: {exc.message}") from exc
            raise
        except aiosmtplib.SMTPRecipientsRefused as exc:
            raise PermanentSendError(f"recipient refused: {msg.to}") from exc

        return SendResult.success(
            self.name, f"smtp {s.GOOGLE_SMTP_HOST}:{port}", remote_id=mime["Message-ID"]
        )
