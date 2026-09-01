"""Routers — institution admin: guardian links (C-IA-12).

The board this serves already existed in the web app as a mock: the component
said "API not connected yet" out loud. It is connected now, and the shape is
deliberately asymmetric:

* creating a link is allowed for a school tenant only — the role design lists
  PARENT as a school role (doc/role_based_system_design.md §3) and a college has
  no guardian console to open — while reading and unlinking stay allowed, so an
  institution that switched type can still clean up its old links;
* the activation code is returned exactly once, on the row that carries it, and
  never after the link is claimed. It is a capability: the office prints it, the
  family redeems it, and the platform forgets it;
* every mutation writes an audit row, because "who removed this grandfather's
  access, and when" is the first question in every dispute about a parent portal.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user_admin
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.parent import (
    APIResponseParentLinkPage,
    APIResponseParentLinkRow,
    ParentLinkCreate,
    ParentLinkUpdate,
)
from app.services.institution_service import InstitutionService
from app.services.parent_service import ParentLinkService

router = APIRouter()


@router.get("/parent-links", response_model=APIResponseParentLinkPage)
async def list_parent_links(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
    query: str | None = Query(default=None, max_length=200, description="Name, email or relation"),
    link_status: str = Query(default="ALL", alias="status", description="ALL | PENDING_CLAIM | ACTIVE | SUSPENDED"),
    class_id: uuid.UUID | None = Query(default=None),
    relation: str | None = Query(default=None, max_length=50),
    primary_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Guardian links, counts, and the students nobody is linked to."""
    return APIResponse(
        success=True,
        data=await ParentLinkService.board(
            db,
            admin,
            query=query,
            link_status=link_status,
            class_id=class_id,
            relation=relation,
            primary_only=primary_only,
            limit=limit,
            offset=offset,
        ),
        message="Guardian links loaded",
    )


@router.post(
    "/parent-links",
    response_model=APIResponseParentLinkRow,
    status_code=status.HTTP_201_CREATED,
)
async def create_parent_link(
    payload: ParentLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    """Link an existing parent account, or invite a guardian behind a code."""
    tenant = await InstitutionService._tenant(db, admin.tenant_id)
    data = await ParentLinkService.create_link(db, admin, tenant, payload)
    message = (
        "Guardian invited — share the activation code with them"
        if data.status == "PENDING_CLAIM"
        else "Guardian linked to the student"
    )
    return APIResponse(success=True, data=data, message=message)


@router.patch("/parent-links/{link_id}", response_model=APIResponseParentLinkRow)
async def update_parent_link(
    link_id: uuid.UUID,
    payload: ParentLinkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    """Change relation, primary flag, status, module scope, expiry or note."""
    return APIResponse(
        success=True,
        data=await ParentLinkService.update_link(db, admin, link_id, payload),
        message="Guardian link updated",
    )


@router.post("/parent-links/{link_id}/code", response_model=APIResponseParentLinkRow)
async def issue_parent_code(
    link_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    """(Re)issue the activation code and email it to the invited guardian."""
    return APIResponse(
        success=True,
        data=await ParentLinkService.issue_code(db, admin, link_id),
        message="Activation code sent",
    )


@router.delete("/parent-links/{link_id}", response_model=APIResponse[None])
async def delete_parent_link(
    link_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_tenant_user_admin)],
):
    """Unlink. The portal access stops immediately; the audit row keeps the history."""
    await ParentLinkService.delete_link(db, admin, link_id)
    return APIResponse(success=True, data=None, message="Guardian unlinked")
