"""
ORM Model — user_sessions

Stores hashed refresh tokens for institution users.
Tracks device info and IP for security auditing.
Mirrors the user_sessions table in database.sql exactly.
"""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import INET, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SHA-256 hash of the actual refresh token — never store the raw token
    refresh_token_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    device_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    expires_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    revoked_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_user_sessions_user_id", "user_id"),
        Index("idx_user_sessions_expires_at", "expires_at"),
    )

    @property
    def is_valid(self) -> bool:
        """True if the session has not been revoked and has not expired."""
        from datetime import datetime, timezone

        return (
            self.revoked_at is None
            and self.expires_at > datetime.now(timezone.utc)
        )

    def __repr__(self) -> str:
        return f"<UserSession user={self.user_id} valid={self.is_valid}>"
