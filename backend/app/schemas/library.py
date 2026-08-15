"""Validated API contracts for the library module."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, HttpUrl, model_validator

from app.schemas.common import APIResponse, Wire

Condition = Literal["GOOD", "FAIR", "DAMAGED", "LOST"]
ResourceType = Literal["EBOOK", "JOURNAL", "PAPER", "LINK"]


class BookIn(Wire):
    title: str = Field(min_length=1, max_length=500)
    authors: list[str] = Field(min_length=1, max_length=20)
    isbn: str | None = Field(default=None, max_length=20)
    publisher: str | None = Field(default=None, max_length=255)
    edition: str | None = Field(default=None, max_length=50)
    publication_year: int | None = Field(default=None, ge=1000, le=2100)
    subject_area: str | None = Field(default=None, max_length=255)
    language: str = Field(default="English", min_length=1, max_length=50)
    location_code: str | None = Field(default=None, max_length=50)
    cover_image_url: str | None = None


class BookUpdate(BookIn):
    is_active: bool = True


class CopyIn(Wire):
    accession_number: str = Field(min_length=1, max_length=50)
    condition: Condition = "GOOD"


class CopyConditionIn(Wire):
    condition: Condition


class IssueIn(Wire):
    copy_id: uuid.UUID
    borrower_id: uuid.UUID
    due_date: date
    notes: str | None = Field(default=None, max_length=1000)


class ReturnIn(Wire):
    fine_paid: bool = False
    notes: str | None = Field(default=None, max_length=1000)


class ResourceIn(Wire):
    title: str = Field(min_length=1, max_length=500)
    resource_type: ResourceType
    url: HttpUrl | None = None
    file_key: str | None = None
    subject_area: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def source_required(self):
        if bool(self.url) == bool(self.file_key):
            raise ValueError("Provide exactly one of url or fileKey")
        return self


class BookRow(Wire):
    id: uuid.UUID
    title: str
    authors: list[str]
    isbn: str | None
    publisher: str | None
    edition: str | None
    publication_year: int | None
    subject_area: str | None
    language: str
    location_code: str | None
    cover_image_url: str | None
    is_active: bool
    total_copies: int
    available_copies: int
    issued_copies: int
    unavailable_copies: int


class CopyRow(Wire):
    id: uuid.UUID
    accession_number: str
    condition: Condition
    is_available: bool
    added_at: date


class LoanRow(Wire):
    id: uuid.UUID
    copy_id: uuid.UUID
    book_id: uuid.UUID
    book_title: str
    accession_number: str
    borrower_id: uuid.UUID
    borrower_name: str
    borrower_ref: str
    issued_at: datetime
    due_date: date
    returned_at: datetime | None
    fine_amount: Decimal
    fine_paid: bool
    is_overdue: bool
    overdue_days: int


class BookDetail(Wire):
    book: BookRow
    copies: list[CopyRow] | None = None
    issues: list[LoanRow] | None = None
    own_loan: LoanRow | None = None
    can_manage: bool


class Catalogue(Wire):
    items: list[BookRow]
    total: int
    limit: int
    offset: int
    subjects: list[str]
    can_manage: bool


class Circulation(Wire):
    items: list[LoanRow]
    total: int
    limit: int
    offset: int
    overdue: int
    outstanding_fines: Decimal


class BorrowerRow(Wire):
    id: uuid.UUID
    name: str
    ref: str
    current_loans: int
    overdue_loans: int


class Dashboard(Wire):
    titles: int
    copies: int
    available: int
    on_loan: int
    overdue: int
    outstanding_fines: Decimal
    recent_loans: list[LoanRow]
    can_manage: bool


class ResourceRow(Wire):
    id: uuid.UUID
    title: str
    resource_type: ResourceType
    url: str | None
    file_key: str | None
    subject_area: str | None
    uploaded_by_name: str
    created_at: datetime


APIResponseBook = APIResponse[BookDetail]
APIResponseCatalogue = APIResponse[Catalogue]
APIResponseCopy = APIResponse[CopyRow]
APIResponseLoan = APIResponse[LoanRow]
APIResponseCirculation = APIResponse[Circulation]
APIResponseBorrowers = APIResponse[list[BorrowerRow]]
APIResponseDashboard = APIResponse[Dashboard]
APIResponseResources = APIResponse[list[ResourceRow]]
APIResponseResource = APIResponse[ResourceRow]
