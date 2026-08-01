"""
ORM Model — platform_sessions

Hashed refresh tokens for platform staff.
Mirrors the same session pattern used for tenant users (user_sessions)
but keyed to platform_users, not users.
"""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import INET, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class PlatformSession(Base):
    __tablename__ = "platform_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_users.id", ondelete="CASCADE"),
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
        Index("idx_platform_sessions_user_id", "user_id"),
        Index("idx_platform_sessions_expires_at", "expires_at"),
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
        return f"<PlatformSession user={self.user_id} valid={self.is_valid}>"
