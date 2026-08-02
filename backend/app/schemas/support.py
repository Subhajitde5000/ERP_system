"""
Pydantic Schemas — Support Staff console (C-SP-01 … C-SP-04)

camelCase on the wire (`Wire`, schemas/common.py) because
`fontend/types/support.ts` already declares these contracts and the four
Support components consume them directly.

§4.1 shapes what is writable here: a support agent may change a *ticket* —
status, assignee, replies, all `support_tickets` rows the platform owns — but
"cannot modify institution data or settings". So C-SP-04 returns a read-only
snapshot and has no PATCH counterpart.
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import APIResponse, Wire

TicketPriorityT = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
TicketStatusT = Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
ReplyAuthorKindT = Literal["SUPPORT", "INSTITUTION"]


# ── Replies ──────────────────────────────────────────────────────────────────

class TicketReply(Wire):
    id: uuid.UUID
    author_name: str
    author_kind: ReplyAuthorKindT
    author_role: str
    body: str
    # Platform-staff-only note. The owner-facing serialiser drops these rows
    # entirely; the flag is still sent here so the Support UI can mark them.
    is_internal: bool
    created_at: datetime


# ── Tickets ──────────────────────────────────────────────────────────────────

class TicketRow(Wire):
    id: uuid.UUID
    reference: str
    subject: str
    description: str
    priority: TicketPriorityT
    status: TicketStatusT
    tenant_id: uuid.UUID | None = None
    tenant_name: str
    tenant_slug: str
    raised_by_name: str
    raised_by_role: str
    assigned_to_id: uuid.UUID | None = None
    assigned_to_name: str | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    reply_count: int
    # Hours since raised — computed server-side so the queue sort, the SLA
    # badge and the dashboard cannot disagree about what is late.
    age_hours: float


class TicketDetail(Wire):
    ticket: TicketRow
    replies: list[TicketReply]


class TicketUpdate(Wire):
    """PATCH — every field optional."""

    status: TicketStatusT | None = None
    priority: TicketPriorityT | None = None
    # Explicit null means "unassign"; omitted means "leave as is". A plain
    # `uuid | None` cannot express that, so the sentinel is handled in the
    # service by inspecting `model_fields_set`.
    assigned_to_id: uuid.UUID | None = None


class TicketReplyCreate(Wire):
    body: str = Field(..., min_length=1, max_length=4000)
    is_internal: bool = False


# ── C-SP-01 dashboard ────────────────────────────────────────────────────────

class PriorityCount(Wire):
    priority: TicketPriorityT
    count: int


class SupportStats(Wire):
    open: int
    in_progress: int
    resolved_today: int
    unassigned: int
    # Open tickets assigned to the signed-in agent.
    mine: int
    by_priority: list[PriorityCount]
    oldest_open: list[TicketRow]
    my_queue: list[TicketRow]


# ── C-SP-04 institution read-only snapshot ───────────────────────────────────

class HealthCheck(Wire):
    label: str
    value: str
    ok: bool
    hint: str | None = None


class SnapshotActivity(Wire):
    id: uuid.UUID
    action: str
    target: str
    actor_name: str
    created_at: datetime


class InstitutionSnapshot(Wire):
    tenant_id: uuid.UUID
    tenant_name: str
    tenant_slug: str
    type: str
    plan_name: str
    is_active: bool
    status: str
    created_at: datetime
    checks: list[HealthCheck]
    enabled_modules: list[str]
    allowed_modules: list[str]
    student_count: int
    teacher_count: int
    max_students: int
    max_teachers: int
    storage_used_gb: float
    max_storage_gb: int
    recent_activity: list[SnapshotActivity]
    open_tickets: list[TicketRow]


# ── Response aliases ─────────────────────────────────────────────────────────

APIResponseTickets = APIResponse[list[TicketRow]]
APIResponseTicket = APIResponse[TicketRow]
APIResponseTicketDetail = APIResponse[TicketDetail]
APIResponseSupportStats = APIResponse[SupportStats]
APIResponseSnapshot = APIResponse[InstitutionSnapshot]
