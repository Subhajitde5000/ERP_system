"""
ORM Models — support_tickets & support_ticket_messages

Account-level support tickets raised by a platform owner (customer) from their
platform dashboard ("Support Tickets" in the nav). This is the AWS/Shopify-style
"contact support" channel — separate from institution-internal notices and
from the anonymous sales enquiry captured in `service_requests`.

A ticket may be account-wide (tenant_id NULL) or scoped to a specific
institution the owner manages. The conversation is a thread of messages from
either the OWNER or platform STAFF.

**One table, two sources.** C-SP-02 ("All tickets") requires the Support
console to work a single queue, so an institution admin's bug report
(`raised_by` → users, database.sql §10.2) and an owner's billing question
(`owner_id` → platform_owners, update.sql §1) live here together. Exactly one
of the two is set; a DB CHECK enforces that (update2.sql §8).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Sequence, String, Text, text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base

# Status / category / priority are plain VARCHAR (mirrors the rest of the
# billing layer) so adding a value is a data change, not a migration.
TICKET_STATUS_OPEN = "OPEN"
TICKET_STATUSES = ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")
TICKET_CATEGORIES = ("BILLING", "TECHNICAL", "ACCOUNT", "OTHER")
# LOW/MEDIUM/HIGH/CRITICAL — the spelling database.sql §10.2 and
# `fontend/types/support.ts` both use. This module previously said
# NORMAL/URGENT, which no other layer recognised; update2.sql §8 migrates the
# two legacy values and adds a CHECK so they cannot come back.
TICKET_PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TICKET_PRIORITY_DEFAULT = "MEDIUM"

# Who wrote a message. OWNER/INSTITUTION are the customer side; SUPPORT/STAFF
# are platform_users. Mirrored by a CHECK in update2.sql §8.
TICKET_AUTHOR_ROLES = ("OWNER", "INSTITUTION", "SUPPORT", "STAFF")

# Response-time target per priority, in hours. One table so the dashboard,
# the queue sort and the detail banner cannot disagree about what is late.
SLA_HOURS = {"CRITICAL": 4, "HIGH": 12, "MEDIUM": 48, "LOW": 96}

# Allocates the human reference (TKT-1042).
#
# Bound to `Base.metadata` so `create_all` — which the integration tests use —
# emits CREATE SEQUENCE alongside the table; otherwise the sequence exists
# only in update2.sql and every ORM insert fails with UndefinedTableError.
#
# Deliberately NOT attached to the column: a Sequence on a column becomes its
# *client-side* default, so SQLAlchemy would pre-fetch nextval and insert the
# bare number (1001) instead of letting the server apply the 'TKT-' prefix.
ticket_reference_seq = Sequence(
    "support_ticket_reference_seq", start=1001, metadata=Base.metadata
)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Human reference (TKT-1042) shown in every Support screen. Allocated by a
    # DB sequence default, not count(*)+1, which races (SYSTEM-FLOW §9).
    #
    # `server_default` is essential, not decorative: without it SQLAlchemy
    # sends an explicit NULL for the column and Postgres never applies its
    # DEFAULT, so every ticket created through the ORM had a blank reference
    # while raw INSERTs got one. `FetchedValue`-style server_default makes the
    # INSERT omit the column and reads the generated value back.
    reference: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        unique=True,
        server_default=text(
            "'TKT-' || nextval('support_ticket_reference_seq')"
        ),
    )
    # Exactly one raiser. Owner-raised → owner_id; institution-raised →
    # raised_by. Both nullable here; the CHECK in update2.sql §8 requires one.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("platform_owners.id", ondelete="CASCADE"),
        nullable=True,
    )
    raised_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # Optional: a ticket about a specific institution the owner manages.
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True
    )
    # The support agent working it (§4.5). NULL = unassigned queue.
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platform_users.id"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="OTHER"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TICKET_STATUS_OPEN
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TICKET_PRIORITY_DEFAULT
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
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
        Index("idx_support_tickets_status", "status"),
        Index("idx_support_tickets_assigned_to", "assigned_to"),
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
    # OWNER / INSTITUTION (customer side) or SUPPORT / STAFF (platform side).
    author_role: Mapped[str] = mapped_column(String(20), nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # An internal note is visible to platform staff only and must never be
    # returned on a customer-facing endpoint. Explicit so it cannot leak by
    # omission — the owner serialiser filters on it.
    is_internal: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_support_ticket_messages_ticket_id", "ticket_id"),
    )
