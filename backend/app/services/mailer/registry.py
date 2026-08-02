"""
Mailer — Provider registry  ◀── THE ONLY FILE YOU EDIT TO SWITCH SYSTEMS

Two ways to choose the active provider. Both work; use whichever you prefer.

  A) .env  (no code change — preferred for deploys)
         EMAIL_PROVIDER=google     # Gmail / Workspace SMTP
         EMAIL_PROVIDER=klaviyo    # Klaviyo Events API
         EMAIL_PROVIDER=console    # log only, never sends

  B) Comment out a block below (what you asked for)
         Comment the GOOGLE block  → only Klaviyo is registered → Klaviyo runs.
         Comment the KLAVIYO block → only Google is registered  → Google runs.
     Select the two lines and hit your editor's comment shortcut. Nothing
     else to change — there is no matching line to uncomment.

Rule that makes (B) work without touching .env: if EMAIL_PROVIDER names a
provider that is commented out, `resolve()` falls back to whichever provider
is still registered and logs a warning. So you can flip systems by commenting
alone, even if .env still says the old one.

No email logic lives here — providers hold transport, templates.py holds copy.
"""

from __future__ import annotations

import logging

from app.services.mailer.base import MailProvider
from app.services.mailer.providers.console import ConsoleMailProvider

logger = logging.getLogger("app.mailer")

# Providers that are switched ON. Order matters only for the fallback message.
_ENABLED: list[type[MailProvider]] = []

# ══════════════════════════════════════════════════════════════════════════════
# ── GOOGLE SYSTEM (Gmail / Workspace SMTP) ────────────────────────────────────
# ↓↓↓ COMMENT OUT THESE 2 LINES TO DISABLE GOOGLE ↓↓↓
from app.services.mailer.providers.google import GoogleMailProvider
_ENABLED.append(GoogleMailProvider)
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# ── KLAVIYO SYSTEM (Events API → Flow) ────────────────────────────────────────
# ↓↓↓ COMMENT OUT THESE 2 LINES TO DISABLE KLAVIYO ↓↓↓
from app.services.mailer.providers.klaviyo import KlaviyoMailProvider
_ENABLED.append(KlaviyoMailProvider)
# ══════════════════════════════════════════════════════════════════════════════


# Registered = selectable. Console is always present as the safety net, so the
# app still boots and logs mail even when both blocks above are commented out.
PROVIDERS: dict[str, type[MailProvider]] = {
    cls.name: cls for cls in (*_ENABLED, ConsoleMailProvider)
}

# Providers that actually deliver (console excluded) — used for the fallback.
_REAL: list[str] = [cls.name for cls in _ENABLED]


def available() -> list[str]:
    """Names of every registered provider, in registration order."""
    return list(PROVIDERS)


def resolve(requested: str, settings: object) -> MailProvider:
    """
    Pick the provider to use, in priority order:

      1. `requested` (EMAIL_PROVIDER) if it is registered and configured
      2. the only real provider left, when the requested one is commented out
      3. console, so the app never crashes over email configuration
    """
    key = (requested or "").strip().lower()
    cls = PROVIDERS.get(key)

    if cls is None:
        if len(_REAL) == 1:
            fallback = _REAL[0]
            logger.warning(
                "[mailer] EMAIL_PROVIDER=%r is not registered (commented out in "
                "registry.py) — using %r instead.",
                requested,
                fallback,
            )
            cls = PROVIDERS[fallback]
        else:
            logger.warning(
                "[mailer] EMAIL_PROVIDER=%r is unknown (registered: %s) — falling "
                "back to console; no mail will be delivered.",
                requested,
                ", ".join(PROVIDERS),
            )
            cls = ConsoleMailProvider

    provider = cls(settings)

    # Registered but half-configured (missing key/password) → console, loudly.
    if not provider.is_configured():
        logger.warning(
            "[mailer] provider %r is missing settings: %s — falling back to "
            "console so nothing crashes. Fill these in .env to send real mail.",
            provider.name,
            ", ".join(provider.missing_settings()),
        )
        return ConsoleMailProvider(settings)

    return provider
