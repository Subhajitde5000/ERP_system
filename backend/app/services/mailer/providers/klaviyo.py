"""
Mailer provider — KLAVIYO (Events API → Flow)

Klaviyo has no "send this raw HTML now" API; sending mail via API is blocked
by design to prevent spam. The supported path for transactional mail is:

    POST /api/events  →  metric fires  →  Flow triggered by that metric
                                          sends the template you designed.

So this provider pushes a named metric plus every field the template needs.
The email body itself is still authored once in `templates.py` and passed
through as `subject` / `text_body` / `html_body` properties, so a Klaviyo
template can simply render {{ event.html_body }} and stay in sync with SMTP.

Setup:
  1. Klaviyo → Settings → API keys → create a PRIVATE key (pk_...).
     Scopes: Events (write) + Profiles (write).
  2. In .env:
       EMAIL_PROVIDER=klaviyo
       KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxxxx
       EMAIL_FROM=you@yourdomain.com
  3. In Klaviyo, create one Flow per metric name below, set it to
     "Transactional", and point it at your template.

Metric names are `KLAVIYO_METRIC_PREFIX` + the outbox event, e.g.
"ERP owner.verify_email" — override the prefix in .env if you like.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.services.mailer.base import (
    MailMessage,
    MailProvider,
    PermanentSendError,
    SendResult,
)

_ENDPOINT = "https://a.klaviyo.com/api/events"


class KlaviyoMailProvider(MailProvider):
    name = "klaviyo"
    required_settings = ("KLAVIYO_API_KEY", "EMAIL_FROM")

    async def deliver(self, msg: MailMessage) -> SendResult:
        s = self.settings
        metric = f"{s.KLAVIYO_METRIC_PREFIX} {msg.event}".strip()

        profile: dict[str, object] = {"email": msg.to}
        if msg.recipient_name():
            profile["first_name"] = msg.recipient_name()

        # Everything the Klaviyo template may reference. The rendered copy is
        # included so one template can serve every event if you prefer.
        properties: dict[str, object] = {
            "event": msg.event,
            "subject": msg.subject,
            "text_body": msg.text,
            "html_body": msg.html,
            "from_email": s.EMAIL_FROM,
            "from_name": s.EMAIL_FROM_NAME,
            **{k: v for k, v in msg.context.items() if v is not None},
        }
        if msg.tenant_id is not None:
            properties["tenant_id"] = str(msg.tenant_id)

        attributes: dict[str, object] = {
            "metric": {"data": {"type": "metric", "attributes": {"name": metric}}},
            "profile": {"data": {"type": "profile", "attributes": profile}},
            "properties": properties,
            "time": datetime.now(timezone.utc).isoformat(),
        }
        if msg.idempotency_key:
            # Klaviyo de-duplicates on unique_id, so outbox retries are safe.
            attributes["unique_id"] = msg.idempotency_key

        payload = {"data": {"type": "event", "attributes": attributes}}
        headers = {
            "Authorization": f"Klaviyo-API-Key {s.KLAVIYO_API_KEY}",
            "revision": s.KLAVIYO_API_REVISION,
            "accept": "application/vnd.api+json",
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=s.EMAIL_TIMEOUT_SECONDS) as client:
            resp = await client.post(_ENDPOINT, json=payload, headers=headers)

        # 202 Accepted is the success case for the Events API.
        if resp.status_code in (200, 201, 202):
            return SendResult.success(self.name, f"event '{metric}' accepted")

        body = resp.text[:400]
        # 4xx (except 429) means the payload or key is wrong — retrying won't help.
        if 400 <= resp.status_code < 500 and resp.status_code != 429:
            raise PermanentSendError(f"HTTP {resp.status_code}: {body}")
        return SendResult.failure(
            self.name, f"HTTP_{resp.status_code}", body
        )
