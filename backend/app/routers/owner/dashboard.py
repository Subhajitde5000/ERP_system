"""
Routers — Owner dashboard (My Institutions + Create New Institution).

"My Institutions" lists every institution the owner manages. "Create New
Institution" reuses the existing self-service checkout pipeline
(SignupService) but stamps the order with the owner's id, so the provisioned
tenant appears under this account.

The full checkout (Choose Plan → Subdomain → Payment → Provision) is driven
from the frontend; these endpoints are the two owner-specific touchpoints on
top of the anonymous /public/* endpoints the checkout already calls.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from app.rate_limit import limiter
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_platform_owner
from app.models.platform_owner import PlatformOwner
from app.schemas.common import APIResponse
from app.schemas.owner import APIResponseInstitutions
from app.schemas.signup import (
    APIResponseSubdomain,
    OrderCreateRequest,
    OrderPayRequest,
)
from app.services.owner_service import OwnerService
from app.services.signup_service import SignupService

router = APIRouter()


@router.get("/institutions", response_model=APIResponseInstitutions)
async def my_institutions(
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Every institution owned by this account (one owner → many institutions)."""
    data = await OwnerService.list_institutions(db, owner)
    return APIResponse(success=True, data=data, message="Institutions loaded")


@router.get("/subdomains/check", response_model=APIResponseSubdomain)
@limiter.limit("60/minute")
async def check_subdomain(
    slug: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Subdomain availability for the 'Choose Subdomain' step."""
    data = await SignupService.check_subdomain(db, slug)
    return APIResponse(success=True, data=data, message="Subdomain checked")


@router.post(
    "/orders",
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/hour")
async def create_institution_order(
    payload: OrderCreateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
):
    """Start an institution checkout as this owner. Stamps the order with
    owner.id so the provisioned tenant is linked to the account."""
    payload.owner_id = owner.id
    data = await SignupService.create_order(db, payload)
    return APIResponse(
        success=True, data=data, message="Order created — proceed to payment"
    )


@router.post("/orders/{order_id}/pay")
@limiter.limit("10/hour")
async def pay_institution_order(
    order_id: uuid.UUID,
    payload: OrderPayRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
):
    """Pay + provision. The order must belong to this owner."""
    from fastapi import HTTPException
    from sqlalchemy import select

    from app.models.billing import Order

    res = await db.execute(select(Order).where(Order.id == order_id))
    order = res.scalar_one_or_none()
    if order is None or order.owner_id != owner.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    result = await SignupService.provision_with_payment(db, order_id, payload)
    return APIResponse(
        success=True, data=result, message="Institution created"
    )


@router.get("/orders/{order_id}")
async def get_institution_order(
    order_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    owner: Annotated[PlatformOwner, Depends(get_current_platform_owner)],
):
    """Success-page summary for an already-provisioned order (idempotent)."""
    from fastapi import HTTPException
    from sqlalchemy import select

    from app.models.billing import Order

    res = await db.execute(select(Order).where(Order.id == order_id))
    order = res.scalar_one_or_none()
    if order is None or order.owner_id != owner.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    result = await SignupService.result(db, order_id)
    return APIResponse(success=True, data=result, message="Order status")
