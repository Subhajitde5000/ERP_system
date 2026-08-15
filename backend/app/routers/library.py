"""Authenticated library catalogue, circulation and e-resource API."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_tenant_user
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.library import (
    APIResponseBook, APIResponseBorrowers, APIResponseCatalogue, APIResponseCirculation,
    APIResponseCopy, APIResponseDashboard, APIResponseLoan, APIResponseResource,
    APIResponseResources, BookIn, BookUpdate, CopyConditionIn, CopyIn, IssueIn,
    ResourceIn, ReturnIn,
)
from app.services.library_service import LibraryService

router = APIRouter(prefix="/library", tags=["Library"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_tenant_user)]


@router.get("/dashboard", response_model=APIResponseDashboard)
async def dashboard(db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.dashboard(db, user), message="Library dashboard loaded")


@router.get("/books", response_model=APIResponseCatalogue)
async def books(db: DB, user: CurrentUser, query: str | None = Query(None, max_length=100), subject: str | None = Query(None, max_length=255), available: bool | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return APIResponse(data=await LibraryService.catalogue(db, user, query=query, subject=subject, available=available, limit=limit, offset=offset), message="Catalogue loaded")


@router.post("/books", response_model=APIResponseBook, status_code=status.HTTP_201_CREATED)
async def create_book(payload: BookIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.create_book(db, user, payload), message="Book created")


@router.get("/books/{book_id}", response_model=APIResponseBook)
async def book(book_id: uuid.UUID, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.book_detail(db, user, book_id), message="Book loaded")


@router.put("/books/{book_id}", response_model=APIResponseBook)
async def update_book(book_id: uuid.UUID, payload: BookUpdate, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.update_book(db, user, book_id, payload), message="Book updated")


@router.post("/books/{book_id}/copies", response_model=APIResponseCopy, status_code=status.HTTP_201_CREATED)
async def add_copy(book_id: uuid.UUID, payload: CopyIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.add_copy(db, user, book_id, payload), message="Copy added")


@router.patch("/copies/{copy_id}/condition", response_model=APIResponseCopy)
async def set_condition(copy_id: uuid.UUID, payload: CopyConditionIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.set_condition(db, user, copy_id, payload.condition), message="Copy condition updated")


@router.get("/issues", response_model=APIResponseCirculation)
async def issues(db: DB, user: CurrentUser, overdue: bool = False, query: str | None = Query(None, max_length=100), limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return APIResponse(data=await LibraryService.circulation(db, user, overdue=overdue, query=query, limit=limit, offset=offset), message="Circulation loaded")


@router.post("/issues", response_model=APIResponseLoan, status_code=status.HTTP_201_CREATED)
async def issue_book(payload: IssueIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.issue(db, user, payload), message="Book issued")


@router.post("/issues/{issue_id}/return", response_model=APIResponseLoan)
async def return_book(issue_id: uuid.UUID, payload: ReturnIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.return_book(db, user, issue_id, payload), message="Book returned")


@router.get("/borrowers", response_model=APIResponseBorrowers)
async def borrowers(db: DB, user: CurrentUser, query: str | None = Query(None, max_length=100)):
    return APIResponse(data=await LibraryService.borrowers(db, user, query), message="Borrowers loaded")


@router.get("/e-resources", response_model=APIResponseResources)
async def resources(db: DB, user: CurrentUser, query: str | None = Query(None, max_length=100)):
    return APIResponse(data=await LibraryService.resources(db, user, query), message="Resources loaded")


@router.post("/e-resources", response_model=APIResponseResource, status_code=status.HTTP_201_CREATED)
async def create_resource(payload: ResourceIn, db: DB, user: CurrentUser):
    return APIResponse(data=await LibraryService.create_resource(db, user, payload), message="Resource created")


@router.delete("/e-resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(resource_id: uuid.UUID, db: DB, user: CurrentUser):
    await LibraryService.delete_resource(db, user, resource_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
