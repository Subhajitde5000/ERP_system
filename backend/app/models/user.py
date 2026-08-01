"""
ORM Model — users

Institution-scoped end users (teachers, students, parents, admins, etc.).
Every row is tied to a tenant_id. email is optional (K-12 students may lack one).
Mirrors the users table in database.sql exactly.
"""

import enum
import uuid

from sqlalchemy import Boolean, Date, Enum as SAEnum, Index, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(
        SAEnum(Gender, name="gender"), nullable=True
    )
    date_of_birth: Mapped[Date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    employee_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    student_roll_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_verified_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    phone_verified_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    last_login_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    password_reset_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    password_reset_expires: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    created_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    __table_args__ = (
        # Unique email per tenant
        Index(
            "uq_users__tenant_id_email",
            "tenant_id",
            "email",
            unique=True,
            postgresql_where=("email IS NOT NULL"),
        ),
        # Unique student roll number per tenant
        Index(
            "uq_users__tenant_id_student_roll_no",
            "tenant_id",
            "student_roll_no",
            unique=True,
            postgresql_where=("student_roll_no IS NOT NULL"),
        ),
        Index("idx_users_tenant_id", "tenant_id"),
        Index(
            "idx_users_email",
            "email",
            postgresql_where=("email IS NOT NULL"),
        ),
        Index("idx_users_is_active", "tenant_id", "is_active"),
        Index(
            "idx_users_deleted_at",
            "deleted_at",
            postgresql_where=("deleted_at IS NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<User {self.email or self.phone} [tenant={self.tenant_id}]>"
