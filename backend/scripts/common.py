"""
Shared safeguards for maintenance/seed scripts (audit issue H5).

Seed scripts write KNOWN demo credentials (Password123! etc.). Running them
against a production database is a critical security incident, so every seed
entrypoint refuses to run when APP_ENV=production unless explicitly forced.
"""

from __future__ import annotations

import sys


def refuse_in_production(tool_name: str) -> None:
    """
    Abort the script when it would touch a production database.

    Call this first thing in every seed/demo script. Pass --force to override
    (e.g. staging environments that deliberately use APP_ENV=production).
    """
    from app.config import get_settings

    # Always let --help / -h through so usage is discoverable.
    if "--help" in sys.argv or "-h" in sys.argv:
        return

    env = (get_settings().APP_ENV or "").strip().lower()
    if env in ("production", "prod") and "--force" not in sys.argv:
        sys.exit(
            f"ABORT: {tool_name} refuses to run with APP_ENV={env}. "
            "Seed scripts create well-known demo credentials and must never "
            "touch a production database. Re-run with --force only for "
            "staging environments that deliberately use APP_ENV=production."
        )


def validate_password_strength(password: str, email: str | None = None) -> None:
    """
    Reject obviously weak passwords for manually created privileged accounts.

    Policy: at least 10 characters, mixed character classes, and not equal
    to the account email. (Full password policy lives client-side for users;
    this guards admin bootstrap only.)
    """
    if len(password) < 10:
        sys.exit("ABORT: password must be at least 10 characters.")
    classes = sum(
        (
            any(c.islower() for c in password),
            any(c.isupper() for c in password),
            any(c.isdigit() for c in password),
            any(not c.isalnum() for c in password),
        )
    )
    if classes < 3:
        sys.exit(
            "ABORT: password must contain at least 3 of: lowercase, "
            "uppercase, digits, symbols."
        )
    if email and password.lower() == email.lower():
        sys.exit("ABORT: password must not equal the account email.")
