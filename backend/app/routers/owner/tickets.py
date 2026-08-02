"""Routers — Owner support tickets (the 'Support Tickets' nav item)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_owner
from app.models.platform_owner import PlatformOwner
from app.schemas.common import APIResponse
from app.schemas.owner import (
    APIResponseTicket,
    APIResponseTickets,
    SupportTicketOut,
    TicketCreateRequest,
    TicketReplyRequest,
)
from app.services.owner_service import OwnerService

router = APIRouter()


@router.get("/tickets", response_model=APIResponseTickets)
async def list_tickets(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.list_tickets(db, owner)
    return APIResponse(success=True, data=data, message="Tickets loaded")


@router.post(
    "/tickets",
    response_model=APIResponseTicket,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(
    payload: TicketCreateRequest,
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.create_ticket(db, owner, payload)
    return APIResponse(success=True, data=data, message="Ticket created")


@router.get("/tickets/{ticket_id}", response_model=APIResponseTicket)
async def get_ticket(
    ticket_id: uuid.UUID,
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.get_ticket(db, owner, ticket_id)
    return APIResponse(success=True, data=data, message="Ticket loaded")


@router.post("/tickets/{ticket_id}/reply", response_model=APIResponseTicket)
async def reply_ticket(
    ticket_id: uuid.UUID,
    payload: TicketReplyRequest,
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.reply_ticket(db, owner, ticket_id, payload.message)
    return APIResponse(success=True, data=data, message="Reply added")
