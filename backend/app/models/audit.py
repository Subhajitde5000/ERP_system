"""
ORM Model — audit_logs

The global, append-only activity trail (database.sql §10.3). One row per
state-changing action anywhere in the platform.

`tenant_id` is NULL for platform-level actions — the Super Admin creating a
tenant or deactivating a staff account belongs to no institution. That single
nullable column is what makes C-SA-07's "Platform" filter possible, and it is
why the table can't simply live behind the tenant-scoped audit view.

Append-only by contract: the service layer exposes `record()` and queries, and
never an update or a delete. Nothing in the Super Admin console mutates a row
here — §10.3 and the read-only C-SA-07 page depend on that.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # NULL = platform-level action (§10.3)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Role held at the time — platform or institution. Stored, not joined, so
    # the trail still reads correctly after a role is revoked or renamed.
    user_role: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    old_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_audit_tenant_time", "tenant_id", "created_at"),
        Index("idx_audit_entity_id", "entity", "entity_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.entity} by {self.user_role}>"
