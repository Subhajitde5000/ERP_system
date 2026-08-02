"""
ORM Models — support_tickets & support_ticket_messages

Account-level support tickets raised by a platform owner (customer) from their
platform dashboard ("Support Tickets" in the nav). This is the AWS/Shopify-style
"contact support" channel — separate from institution-internal notices and
from the anonymous sales enquiry captured in `service_requests`.

A ticket may be account-wide (tenant_id NULL) or scoped to a specific
institution the owner manages. The conversation is a thread of messages from
either the OWNER or platform STAFF.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

# Status / category / priority are plain VARCHAR (mirrors the rest of the
# billing layer) so adding a value is a data change, not a migration.
TICKET_STATUS_OPEN = "OPEN"
TICKET_STATUSES = ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
TICKET_CATEGORIES = ("BILLING", "TECHNICAL", "ACCOUNT", "OTHER")
TICKET_PRIORITIES = ("LOW", "NORMAL", "HIGH", "URGENT")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_owners.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Optional: a ticket about a specific institution the owner manages.
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="OTHER"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TICKET_STATUS_OPEN
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="NORMAL"
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("idx_support_tickets_owner_status", "owner_id", "status"),
        Index("idx_support_tickets_tenant_id", "tenant_id"),
    )


class SupportTicketMessage(Base):
    __tablename__ = "support_ticket_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    # OWNER (the customer) or STAFF (a platform_users row replying).
    author_role: Mapped[str] = mapped_column(String(20), nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_support_ticket_messages_ticket_id", "ticket_id"),
    )
