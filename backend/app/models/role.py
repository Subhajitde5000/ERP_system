"""
ORM Models — roles, permissions, role_assignments

Three tables that together form the RBAC system.
- roles: 22 named roles (4 platform + 18 institution)
- permissions: role → module_key + action + scope matrix
- role_assignments: user ↔ role link, optionally scoped to a resource (HOD → dept)

Mirrors database.sql exactly.
"""

import enum
import uuid

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


# ── Enums (mirror DB enum types) ─────────────────────────────────────────────

class ScopeLevel(str, enum.Enum):
    PLATFORM = "PLATFORM"
    INSTITUTION = "INSTITUTION"
    DEPARTMENT = "DEPARTMENT"
    CLASS = "CLASS"
    SUBJECT = "SUBJECT"
    SELF = "SELF"
    CHILD = "CHILD"


class PermissionAction(str, enum.Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class PermissionScope(str, enum.Enum):
    ALL = "ALL"
    DEPARTMENT = "DEPARTMENT"
    CLASS = "CLASS"
    SUBJECT = "SUBJECT"
    OWN = "OWN"
    CHILD = "CHILD"


# ── Role ──────────────────────────────────────────────────────────────────────

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    scope_level: Mapped[ScopeLevel] = mapped_column(
        SAEnum(ScopeLevel, name="scope_level"), nullable=False
    )
    is_platform: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_optional: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    module_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


# ── Permission ────────────────────────────────────────────────────────────────

class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[PermissionAction] = mapped_column(
        SAEnum(PermissionAction, name="permission_action"), nullable=False
    )
    scope: Mapped[PermissionScope] = mapped_column(
        SAEnum(PermissionScope, name="permission_scope"), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_permissions__role_id_module_key_action",
            "role_id",
            "module_key",
            "action",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<Permission {self.module_key}.{self.action}.{self.scope}>"


# ── RoleAssignment ────────────────────────────────────────────────────────────

class RoleAssignment(Base):
    __tablename__ = "role_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id"),
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
    )
    # Optional: scopes this assignment to a specific resource (e.g. HOD → dept id)
    scope_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    scope_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    assigned_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[TIMESTAMP | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index(
            "uq_role_assignments__user_role_tenant_scope",
            "user_id",
            "role_id",
            "tenant_id",
            "scope_id",
            unique=True,
        ),
        Index("idx_ra_user_id", "user_id"),
        Index("idx_ra_tenant_role", "tenant_id", "role_id"),
        Index(
            "idx_ra_scope_id",
            "scope_id",
            postgresql_where=("scope_id IS NOT NULL"),
        ),
    )

    def __repr__(self) -> str:
        return f"<RoleAssignment user={self.user_id} role={self.role_id}>"
