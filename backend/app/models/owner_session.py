"""
ORM Model — owner_sessions

Hashed refresh tokens for platform owners (customer accounts). Mirrors
`platform_sessions` (staff) but is keyed to `platform_owners`, so a customer
session and a staff session can never collide on the same table — they are two
different login systems with two different token types (type="owner" vs
type="platform").
"""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import INET, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class OwnerSession(Base):
    __tablename__ = "owner_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_owners.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SHA-256 hash of the raw refresh token — the raw value is never stored.
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
        Index("idx_owner_sessions_owner_id", "owner_id"),
        Index("idx_owner_sessions_expires_at", "expires_at"),
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
        return f"<OwnerSession owner={self.owner_id} valid={self.is_valid}>"
