"""Routers — Owner billing (summary, subscriptions, invoices, payments)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_owner
from app.models.platform_owner import PlatformOwner
from app.schemas.common import APIResponse
from app.schemas.owner import (
    APIResponseBilling,
    OwnerInvoice,
    OwnerPayment,
    OwnerSubscription,
)
from app.services.owner_service import OwnerService

router = APIRouter()


@router.get("/billing/summary", response_model=APIResponseBilling)
async def billing_summary(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.billing_summary(db, owner)
    return APIResponse(success=True, data=data, message="Billing summary")


@router.get("/subscriptions", response_model=APIResponse[list[OwnerSubscription]])
async def my_subscriptions(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.list_subscriptions(db, owner)
    return APIResponse(success=True, data=data, message="Subscriptions loaded")


@router.get("/invoices", response_model=APIResponse[list[OwnerInvoice]])
async def my_invoices(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.list_invoices(db, owner)
    return APIResponse(success=True, data=data, message="Invoices loaded")


@router.get("/payments", response_model=APIResponse[list[OwnerPayment]])
async def my_payments(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await OwnerService.list_payments(db, owner)
    return APIResponse(success=True, data=data, message="Payments loaded")
