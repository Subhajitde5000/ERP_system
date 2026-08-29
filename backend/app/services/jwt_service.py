"""
Services — JWT Service

Encapsulates token minting, decoding, and verification for both
Platform and Tenant tokens.
Matches the payload spec in ARCHITECTURE.md exactly:
  Platform JWT: { sub, type: "platform", role, exp, iat }
  Tenant JWT:   { sub, type: "tenant", tenant_id, role, permissions, exp, iat }
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()


def create_platform_access_token(user_id: uuid.UUID, role: str) -> str:
    """Mint a Platform JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "platform",
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_tenant_access_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID,
    role: str,
    permissions: list[str],
) -> str:
    """Mint a Tenant JWT access token with role and permission array."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "tenant",
        "tenant_id": str(tenant_id),
        "role": role,
        "permissions": permissions,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def create_owner_access_token(owner_id: uuid.UUID) -> str:
    """
    Mint a Platform-Owner JWT access token.

    The owner is the customer / account-holder who logs in at xyz.com and
    manages their institutions, billing and subscriptions. `type="owner"`
    distinguishes it from staff (`type="platform"`) and institution users
    (`type="tenant"`), so a token from one login system is never accepted by
    another.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(owner_id),
        "type": "owner",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT access token.
    Raises JWTError if invalid or expired.
    """
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


# ── Signed file URLs (audit issue A6) ─────────────────────────────────────────
# Uploaded files are no longer served from a public static mount. Instead the
# API returns short-lived signed URLs: the authorization decision is made when
# a notice/class payload is built (only users allowed to see the resource get
# the URL), and the file endpoint re-verifies the signature + expiry on every
# download. `type="file"` keeps these tokens from being accepted by any of the
# three login systems.


def create_file_token(relative_path: str, ttl_minutes: int | None = None) -> str:
    """
    Mint a short-lived signed URL token for one upload path.

    The path claim is the uploads-root-relative location, e.g.
    ``/uploads/notices/{id}/{name}``. The signature (same JWT secret as all
    other tokens) makes the path tamper-proof; ``exp`` bounds its lifetime.
    """
    now = datetime.now(timezone.utc)
    ttl = ttl_minutes if ttl_minutes is not None else settings.FILE_URL_TTL_MINUTES
    payload: dict[str, Any] = {
        "sub": relative_path,
        "type": "file",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl)).timestamp()),
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def sign_upload_url(relative_path: str) -> str:
    """Build the public signed-download URL for an uploads-root-relative path."""
    return f"/api/v1/files/signed/{create_file_token(relative_path)}"
