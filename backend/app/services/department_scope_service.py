"""Shared resolver for department-scoped institution leadership roles.

A scope is always resolved from the database, never from the JWT or a query
parameter.  Vice Principals use explicitly delegated role assignments; HODs
also recognise the department's canonical ``hod_id`` for legacy/admin setup.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Department
from app.models.role import Role, RoleAssignment
from app.models.user import User
from app.services.principal_service import PrincipalService


@dataclass(frozen=True)
class ScopedDepartment:
    id: uuid.UUID
    name: str


@dataclass(frozen=True)
class DepartmentScope:
    department_ids: frozenset[uuid.UUID]
    departments: tuple[ScopedDepartment, ...]


class DepartmentScopeService:
    @staticmethod
    async def resolve(
        db: AsyncSession,
        user: User,
        *,
        role_name: str,
        include_department_head: bool = False,
        missing_message: str,
    ) -> DepartmentScope:
        """Return active tenant departments assigned to a leadership role.

        ``include_department_head`` supports HOD records created through the
        department administration flow before a scoped role assignment existed.
        The caller's role guard still requires the named role, so a random user
        cannot gain access merely by being referenced in a stale department row.
        """
        delegated_department_ids = (
            select(RoleAssignment.scope_id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(
                RoleAssignment.user_id == user.id,
                RoleAssignment.tenant_id == user.tenant_id,
                Role.name == role_name,
                func.upper(RoleAssignment.scope_type) == "DEPARTMENT",
                PrincipalService._active_role_clause(),
            )
        )
        reach = Department.id.in_(delegated_department_ids)
        if include_department_head:
            reach = or_(reach, Department.hod_id == user.id)

        rows = await db.execute(
            select(Department.id, Department.name)
            .where(
                Department.tenant_id == user.tenant_id,
                Department.is_active.is_(True),
                reach,
            )
            .order_by(Department.name)
        )
        by_id = {department_id: name for department_id, name in rows.all()}
        if not by_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=missing_message)
        departments = tuple(
            ScopedDepartment(id=department_id, name=name)
            for department_id, name in sorted(by_id.items(), key=lambda item: item[1].casefold())
        )
        return DepartmentScope(frozenset(by_id), departments)
