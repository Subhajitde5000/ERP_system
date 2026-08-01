"""Public, rate-limited endpoint for website consultation requests."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.service_request import ServiceRequest
from app.schemas.common import APIResponse
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestCreated

router = APIRouter(prefix="/public/service-requests", tags=["Public"])
limiter = Limiter(key_func=get_remote_address)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=APIResponse[ServiceRequestCreated],
)
@limiter.limit("5/hour")
async def create_service_request(
    request: Request,
    payload: ServiceRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> APIResponse[ServiceRequestCreated]:
    """Store a sales enquiry without provisioning a tenant or user account."""
    # Do not reveal whether bot detection fired. Returning a normal accepted
    # response discourages automated form probing and avoids saving spam.
    if payload.website:
        return APIResponse(
            data=None,
            message="Thanks — our team will be in touch shortly.",
        )

    service_request = ServiceRequest(
        contact_name=payload.contact_name,
        institution_name=payload.institution_name,
        work_email=payload.work_email,
        phone=payload.phone,
        institution_type=payload.institution_type,
        student_count=payload.student_count,
        service_interest=payload.service_interest,
        message=payload.message,
    )
    db.add(service_request)
    await db.flush()
    await db.refresh(service_request)

    return APIResponse(
        data=ServiceRequestCreated(
            id=service_request.id, created_at=service_request.created_at
        ),
        message="Thanks — our team will be in touch within one business day.",
    )
