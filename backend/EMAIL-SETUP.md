# Email System — Google ⇄ Klaviyo

One email system, two interchangeable providers. Switching between them
changes **no application code** — only a `.env` value or two commented lines.

---

## Answer to "does the email send system properly work?"

Before this change: **no.** The codebase created `outbox_emails` rows and
nothing ever read them — there was no SMTP client, no API client, no worker.
Every "verification email sent" message in the API was a row in a table that
no one delivered. Two flows (`resend_verification`, `forgot_password`) did not
even queue a row: they generated a token, saved the hash, and returned success
with the token going nowhere.

Now mail is actually delivered, and both gaps are fixed.

---

## The switch

### Option A — `.env` (no code change, use this for deploys)

```bash
EMAIL_PROVIDER=google     # Gmail / Workspace SMTP
EMAIL_PROVIDER=klaviyo    # Klaviyo Events API
EMAIL_PROVIDER=console    # log only, never delivers (default)
```

### Option B — comment a block in `app/services/mailer/registry.py`

```python
# ── GOOGLE SYSTEM ──
# ↓↓↓ COMMENT OUT THESE 2 LINES TO DISABLE GOOGLE ↓↓↓
from app.services.mailer.providers.google import GoogleMailProvider
_ENABLED.append(GoogleMailProvider)

# ── KLAVIYO SYSTEM ──
# ↓↓↓ COMMENT OUT THESE 2 LINES TO DISABLE KLAVIYO ↓↓↓
from app.services.mailer.providers.klaviyo import KlaviyoMailProvider
_ENABLED.append(KlaviyoMailProvider)
```

Comment the **Google** block → Klaviyo sends everything.
Comment the **Klaviyo** block → Google sends everything.

You do **not** need to touch `.env` as well. If `EMAIL_PROVIDER` names a
provider you commented out, the resolver uses the one that is still registered
and logs a warning. Comment both blocks and the app still boots on `console`.

Verified for real (registry edited on disk, transports stubbed):

| registry.py state | `EMAIL_PROVIDER` | active | SMTP calls | Klaviyo calls |
|---|---|---|---|---|
| both enabled | `google` | google | 1 | 0 |
| both enabled | `klaviyo` | klaviyo | 0 | 1 |
| Google commented | `klaviyo` | klaviyo | 0 | 1 |
| Google commented | `google` *(stale)* | **klaviyo** | 0 | 1 |
| Klaviyo commented | `google` | google | 1 | 0 |
| Klaviyo commented | `klaviyo` *(stale)* | **google** | 1 | 0 |

---

## How duplication is avoided

```
app/services/mailer/
├── base.py         validation, error handling, retry classification, results
├── templates.py    ALL email copy + the HTML shell — written once
├── registry.py     ◀── the switch
├── service.py      queue_email / send_email / deliver_outbox
└── providers/
    ├── google.py   ~55 lines — builds MIME, calls aiosmtplib
    ├── klaviyo.py  ~60 lines — builds JSON, calls the Events API
    └── console.py  ~15 lines — logs it
```

A provider implements exactly one method, `deliver()`. Everything else is
inherited from `MailProvider`:

| Concern | Lives in | Written how many times |
|---|---|---|
| Recipient/subject validation | `base.send()` | once |
| Missing-credential detection | `base.missing_settings()` | once |
| Exception → result conversion | `base.send()` | once |
| Permanent vs. transient failure | `SendResult.permanent` | once |
| Email subject / text / HTML | `templates.py` | once |
| Outbox row, attempts, retry cap | `service.py` | once |
| Talking to SMTP | `providers/google.py` | once |
| Talking to Klaviyo | `providers/klaviyo.py` | once |

Callers never name a provider:

```python
from app.services.mailer import queue_email

queue_email(db, "owner.verify_email", to=email,
            context={"name": owner.name, "verify_url": url})
```

That one call sends via Gmail or Klaviyo depending only on configuration.

---

## Setup — Google (Gmail / Workspace)

1. Enable 2-Step Verification on the sending account.
2. Create an App Password at <https://myaccount.google.com/apppasswords>
   (16 characters — this is **not** your Google account password).
3. `.env`:

```bash
EMAIL_PROVIDER=google
EMAIL_FROM=no-reply@yourdomain.com
GOOGLE_SMTP_USER=no-reply@yourdomain.com
GOOGLE_SMTP_PASSWORD=abcdefghijklmnop
```

Port 587 (STARTTLS) is the default; 465 switches to implicit TLS automatically.
Any other SMTP host (Workspace relay, SES, Mailgun) works by changing
`GOOGLE_SMTP_HOST` — nothing in the provider is Gmail-specific.

## Setup — Klaviyo

Klaviyo deliberately has **no "send raw email" API**. The supported route for
transactional mail is: fire an event → a Flow triggered by that metric sends
your template. This provider does exactly that.

1. Klaviyo → Settings → API keys → create a **private** key (`pk_...`) with
   `Events:write` and `Profiles:write`.
2. `.env`:

```bash
EMAIL_PROVIDER=klaviyo
EMAIL_FROM=no-reply@yourdomain.com
KLAVIYO_API_KEY=pk_xxxxxxxxxxxxxxxxxxxx
KLAVIYO_METRIC_PREFIX=ERP
```

3. In Klaviyo create one Flow per metric, set it to **transactional**, and
   point it at a template:

| Metric name | Sent when |
|---|---|
| `ERP owner.verify_email` | owner signs up / requests a resend |
| `ERP owner.password_reset` | owner uses forgot-password |
| `ERP platform_owner.verify_email` | platform owner account created |
| `ERP tenant.provisioned` | an institution finishes provisioning |
| `ERP staff.invited` | staff member is added |
| `ERP mailer.test` | `POST /api/v1/email/test` |

Each event carries `subject`, `text_body` and `html_body` plus the structured
fields (`verify_url`, `tenant_name`, `plan_name`, …). The simplest template is
just `{{ event.html_body }}`, which keeps Klaviyo byte-identical to SMTP; or
bind the individual properties and design freely in Klaviyo.

---

## Endpoints

```
GET  /api/v1/email/status        # active provider + missing settings (no secrets)
POST /api/v1/email/test          # send one real email  {"to": "you@x.com"}
POST /api/v1/email/outbox/drain  # deliver everything still QUEUED
```

`status` is readable in debug builds; `test` and `drain` require a platform
admin token.

---

## Why emails are queued, not sent inline

Provisioning runs in a single transaction (SYSTEM-FLOW §2.1). An SMTP
round-trip inside it would hold locks open, and a mail outage would roll back
a **paid** signup. So `queue_email()` writes the outbox row in the caller's
transaction, and delivery happens after the commit:

- transient failure (SMTP timeout, Klaviyo 503) → stays `QUEUED`, retried up
  to 5 attempts by the next drain
- permanent failure (bad address, SMTP 550, Klaviyo 401) → `FAILED` at once,
  no wasted retries
- success → `SENT`

Run the drain from cron, a worker, or the endpoint:

```bash
curl -X POST localhost:8000/api/v1/email/outbox/drain -H "Authorization: Bearer $TOKEN"
```

---

## Adding a third provider

1. Create `providers/sendgrid.py` with one `deliver()` method.
2. Add two lines to `registry.py`.

No template, validation, retry or caller changes.

---

## Tests

`tests/test_email_system.py` — 28 tests covering both providers, the switch in
both directions, retry classification and outbox transitions. The suite is
pinned to the console provider (`conftest.py`), so it never opens a socket.

```bash
pytest tests/test_email_system.py -v
```
