"""ORM model for sales enquiries submitted from the public website."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ServiceRequest(Base):
    """A prospect request; this is deliberately separate from a tenant."""

    __tablename__ = "service_requests"
    __table_args__ = (
        CheckConstraint("student_count IS NULL OR student_count > 0", name="ck_service_requests_student_count"),
        Index("idx_service_requests_status_created_at", "status", "created_at"),
        Index("idx_service_requests_work_email", "work_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    work_email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    institution_type: Mapped[str] = mapped_column(String(20), nullable=False)
    student_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    service_interest: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'NEW'")
    )
    source: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default=text("'website'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
