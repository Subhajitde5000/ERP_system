"""Tenant-scoped library catalogue and circulation models."""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, Enum as SAEnum, ForeignKey, Index, Integer, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class BookCondition(str, enum.Enum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    DAMAGED = "DAMAGED"
    LOST = "LOST"


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        Index("idx_books_tenant_title", "tenant_id", "title"),
        Index("uq_books_tenant_isbn", "tenant_id", "isbn", unique=True, postgresql_where="isbn IS NOT NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    isbn: Mapped[str | None] = mapped_column(String(20))
    publisher: Mapped[str | None] = mapped_column(String(255))
    edition: Mapped[str | None] = mapped_column(String(50))
    publication_year: Mapped[int | None] = mapped_column(SmallInteger)
    subject_area: Mapped[str | None] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(50), nullable=False, default="English")
    total_copies: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_copies: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cover_image_url: Mapped[str | None] = mapped_column(Text)
    location_code: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class BookCopy(Base):
    __tablename__ = "book_copies"
    __table_args__ = (UniqueConstraint("tenant_id", "accession_number", name="uq_book_copies__tenant_id_accession_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    accession_number: Mapped[str] = mapped_column(String(50), nullable=False)
    condition: Mapped[BookCondition] = mapped_column(SAEnum(BookCondition, name="book_condition"), nullable=False, default=BookCondition.GOOD)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    added_at: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)


class BookIssue(Base):
    __tablename__ = "book_issues"
    __table_args__ = (
        Index("uq_book_issues_active_copy", "copy_id", unique=True, postgresql_where="returned_at IS NULL"),
        Index("idx_book_issues_tenant_due_active", "tenant_id", "due_date", postgresql_where="returned_at IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    copy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("book_copies.id"), nullable=False)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    borrower_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issued_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    returned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    fine_amount: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=0)
    fine_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fine_paid_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)


class EResource(Base):
    __tablename__ = "e_resources"
    __table_args__ = (Index("idx_e_resources_tenant_subject", "tenant_id", "subject_area"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str | None] = mapped_column(Text)
    file_key: Mapped[str | None] = mapped_column(Text)
    subject_area: Mapped[str | None] = mapped_column(String(255))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
