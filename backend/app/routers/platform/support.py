"""
Routers — Support Staff console (C-SP-01 … C-SP-04)

The endpoints named in `complete_webpage_developer_assignment.md` §2.2:

  GET   /api/v1/platform/tickets
  PATCH /api/v1/platform/tickets/{id}
  GET   /api/v1/platform/tickets/{id}
  POST  /api/v1/platform/tickets/{id}/reply
  GET   /api/v1/platform/institutions/{id}/readonly

Plus `/support/stats` for the C-SP-01 dashboard.

Access is Support **or** Super Admin: §4.1 gives the Super Admin platform-wide
oversight, and an escalated ticket has to be reachable from somewhere. Sales
and Finance authenticate against the same `platform_users` table and are
refused here.

There is deliberately no write endpoint under `/institutions/{id}/readonly`:
§4.1 says Support "cannot modify institution data or settings", so the route
is a read-only diagnostic and the absence is the enforcement.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_user
from app.models.platform_user import PlatformRole, PlatformUser
from app.schemas.common import APIResponse
from app.schemas.support import (
    APIResponseSnapshot,
    APIResponseSupportStats,
    APIResponseTicket,
    APIResponseTicketDetail,
    APIResponseTickets,
    TicketReplyCreate,
    TicketUpdate,
)
from app.services.support_service import SupportService

router = APIRouter(prefix="/platform", tags=["Support Staff"])

SUPPORT_ROLES = (PlatformRole.SUPPORT, PlatformRole.SUPER_ADMIN)


async def require_support(
    current: Annotated[PlatformUser, Depends(get_current_platform_user)],
) -> PlatformUser:
    """Support Staff, or a Super Admin exercising platform-wide oversight."""
    if current.platform_role not in SUPPORT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This console is restricted to Support Staff",
        )
    return current


Agent = Annotated[PlatformUser, Depends(require_support)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ══ C-SP-01 · Dashboard ══════════════════════════════════════════════════════

@router.get("/support/stats", response_model=APIResponseSupportStats)
async def support_stats(db: DB, agent: Agent):
    """Open/in-progress counts, priority split, unassigned, and my queue."""
    data = await SupportService.stats(db, agent)
    return APIResponse(success=True, data=data, message="Support stats loaded")


# ══ C-SP-02 · Ticket list ════════════════════════════════════════════════════

@router.get("/tickets", response_model=APIResponseTickets)
async def list_tickets(
    db: DB,
    agent: Agent,
    status_filter: str | None = Query(
        default=None, alias="status", description="ALL|OPEN_ALL|OPEN|IN_PROGRESS|RESOLVED|CLOSED"
    ),
    priority: str | None = None,
    tenant_id: uuid.UUID | None = Query(default=None, alias="tenantId"),
    assigned_to: uuid.UUID | None = Query(default=None, alias="assignedTo"),
    mine: bool = Query(default=False, description="Only tickets assigned to me"),
    unassigned: bool = False,
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    data = await SupportService.list_tickets(
        db,
        status_filter=status_filter,
        priority=priority,
        tenant_id=tenant_id,
        # `mine` is the dashboard's deep-link; it resolves to the signed-in
        # agent so the client never has to know its own id.
        assigned_to=agent.id if mine else assigned_to,
        unassigned=unassigned,
        search=search,
        limit=limit,
        offset=offset,
    )
    return APIResponse(success=True, data=data, message=f"{len(data)} ticket(s)")


# ══ C-SP-03 · Ticket detail ══════════════════════════════════════════════════

@router.get("/tickets/{ticket_id}", response_model=APIResponseTicketDetail)
async def ticket_detail(ticket_id: uuid.UUID, db: DB, agent: Agent):
    data = await SupportService.ticket_detail(db, ticket_id)
    return APIResponse(success=True, data=data, message="Ticket loaded")


@router.patch("/tickets/{ticket_id}", response_model=APIResponseTicket)
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    request: Request,
    db: DB,
    agent: Agent,
):
    """Change status, priority or assignee. Illegal transitions are refused."""
    data = await SupportService.update_ticket(db, ticket_id, payload, agent, request)
    return APIResponse(success=True, data=data, message="Ticket updated")


@router.post("/tickets/{ticket_id}/reply", response_model=APIResponseTicketDetail)
async def reply_to_ticket(
    ticket_id: uuid.UUID,
    payload: TicketReplyCreate,
    request: Request,
    db: DB,
    agent: Agent,
):
    """Post a reply. `isInternal` keeps it staff-only, never shown to the customer."""
    data = await SupportService.reply(db, ticket_id, payload, agent, request)
    return APIResponse(
        success=True,
        data=data,
        message="Internal note added" if payload.is_internal else "Reply sent",
    )


# ══ C-SP-04 · Institution read-only view ═════════════════════════════════════

@router.get("/institutions/{tenant_id}/readonly", response_model=APIResponseSnapshot)
async def institution_readonly(tenant_id: uuid.UUID, db: DB, agent: Agent):
    """
    Read-only diagnostic snapshot (§4.1 — "cannot modify institution data").
    Plan, modules, seat usage, health checks, recent activity, open tickets.
    """
    data = await SupportService.institution_snapshot(db, tenant_id)
    return APIResponse(success=True, data=data, message="Snapshot loaded")
