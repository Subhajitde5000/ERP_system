"""
Utils — Security helpers

Single place for all cryptographic operations:
  - Password hashing/verification (bcrypt)
  - Secure token generation (refresh tokens)
  - Token hashing (SHA-256 before DB storage)

Nothing here knows about FastAPI, SQLAlchemy, or business logic.
"""

import hashlib
import logging
import secrets
import warnings

# passlib 1.7.x tries to read bcrypt.__about__.__version__ which was removed
# in bcrypt 4.0.  The AttributeError is caught internally and the correct
# backend is still selected, but it prints a noisy "(trapped) error" line.
# Suppress it at the warnings level before importing passlib's bcrypt handler.
warnings.filterwarnings(
    "ignore",
    message=".*error reading bcrypt version.*",
    category=UserWarning,
)
# Also silence the logger passlib uses for the same message.
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)

from passlib.context import CryptContext

# bcrypt context — cost factor 12 as per architecture doc
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of the given plaintext password."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored bcrypt hash."""
    return _pwd_context.verify(plain_password, hashed_password)


def generate_secure_token(nbytes: int = 64) -> str:
    """
    Generate a cryptographically secure URL-safe random string.
    Used for refresh tokens — the raw value is sent to the client
    and never stored directly in the DB.
    """
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """
    Return the SHA-256 hex digest of a token string.
    This is what we store in user_sessions.refresh_token_hash.
    Lookup: hash the incoming token and compare to the stored hash.
    """
    return hashlib.sha256(token.encode()).hexdigest()
