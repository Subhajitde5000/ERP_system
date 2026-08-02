"""
ORM Models — plans & modules (platform catalogue)

`plans`   — the sellable subscription packages (Starter / Professional /
             Enterprise / Build Your Own). Mirrors the `plans` table in
             database.sql §4.1.
`modules` — the 16 module catalogue (8 core + 8 optional). `price_monthly`
             is the a-la-carte monthly price used by the "Build Your Own"
             checkout — a column added for the self-service signup flow
             (database.sql's `modules` table has no price column).
"""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ARRAY, Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    max_students: Mapped[int] = mapped_column(Integer, nullable=False)
    max_teachers: Mapped[int] = mapped_column(Integer, nullable=False)
    max_storage_gb: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10
    )
    price_monthly: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_yearly: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR"
    )
    # Module keys bundled into this plan; anything not listed is an add-on.
    allowed_modules: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, default=list
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f"<Plan {self.slug} ({self.name})>"


class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_core: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # A-la-carte monthly price (INR) for the "Build Your Own Plan" checkout.
    price_monthly: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0")
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<Module {self.key}>"
