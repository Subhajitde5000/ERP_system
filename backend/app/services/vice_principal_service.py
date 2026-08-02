"""Delegated Vice Principal service (C-VP-01 … C-VP-07).

This module owns exactly one additional rule over the Principal data service:
a Vice Principal may see and act only inside departments explicitly delegated
through active ``VICE_PRINCIPAL`` role assignments.  All aggregates and rows
are then produced by ``PrincipalService`` with that department fence, avoiding
a second implementation of attendance, results, notices or directory queries.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Department
from app.models.role import Role, RoleAssignment
from app.models.user import User
from app.schemas.principal import (
    LeadershipNoticeRow,
    PrincipalAttendanceOverview,
    PrincipalExamPage,
    PrincipalNoticeCreate,
    PrincipalNoticeTargets,
    PrincipalResultsOverview,
    PrincipalStaffDetail,
    PrincipalStaffPage,
    PrincipalTargetOption,
)
from app.schemas.vice_principal import (
    VicePrincipalDashboard,
    VicePrincipalNoticeDetail,
    VicePrincipalNoticePage,
)
from app.services.principal_service import PrincipalService


@dataclass(frozen=True)
class VicePrincipalScope:
    """Validated, immutable department delegation for one request."""

    department_ids: frozenset[uuid.UUID]
    departments: tuple[PrincipalTargetOption, ...]


class VicePrincipalService:
    @staticmethod
    async def scope_for_user(db: AsyncSession, vice_principal: User) -> VicePrincipalScope:
        """Load active department delegations and fail closed when none exist.

        An unscoped institution-role assignment is intentionally not treated as
        institution-wide.  That would turn an incomplete delegation into a
        cross-department disclosure, contrary to §4.3's delegated-scope rule.
        """
        rows = await db.execute(
            select(Department.id, Department.name)
            .select_from(RoleAssignment)
            .join(Role, Role.id == RoleAssignment.role_id)
            .join(
                Department,
                and_(
                    Department.id == RoleAssignment.scope_id,
                    Department.tenant_id == vice_principal.tenant_id,
                    Department.is_active.is_(True),
                ),
            )
            .where(
                RoleAssignment.user_id == vice_principal.id,
                RoleAssignment.tenant_id == vice_principal.tenant_id,
                Role.name == "VICE_PRINCIPAL",
                func.upper(RoleAssignment.scope_type) == "DEPARTMENT",
                PrincipalService._active_role_clause(),
            )
            .order_by(Department.name)
        )
        by_id = {department_id: name for department_id, name in rows.all()}
        if not by_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=(
                    "No active department delegation is assigned to this Vice Principal. "
                    "Ask an Institution Admin to assign the VICE_PRINCIPAL role with a department scope."
                ),
            )
        departments = tuple(
            PrincipalTargetOption(id=department_id, name=name)
            for department_id, name in sorted(by_id.items(), key=lambda item: item[1].casefold())
        )
        return VicePrincipalScope(frozenset(by_id), departments)

    @staticmethod
    async def dashboard(db: AsyncSession, vice_principal: User) -> VicePrincipalDashboard:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        dashboard = await PrincipalService.dashboard(
            db, vice_principal.tenant_id, department_ids=scope.department_ids
        )
        return VicePrincipalDashboard(
            **dashboard.model_dump(),
            delegated_departments=list(scope.departments),
        )

    @staticmethod
    async def attendance(
        db: AsyncSession,
        vice_principal: User,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> PrincipalAttendanceOverview:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.attendance(
            db,
            vice_principal.tenant_id,
            from_date,
            to_date,
            department_ids=scope.department_ids,
        )

    @staticmethod
    async def examinations(
        db: AsyncSession,
        vice_principal: User,
        **filters,
    ) -> PrincipalExamPage:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.examinations(
            db,
            vice_principal.tenant_id,
            department_ids=scope.department_ids,
            **filters,
        )

    @staticmethod
    async def results(
        db: AsyncSession, vice_principal: User
    ) -> PrincipalResultsOverview:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.results(
            db, vice_principal.tenant_id, department_ids=scope.department_ids
        )

    @staticmethod
    async def staff(
        db: AsyncSession,
        vice_principal: User,
        **filters,
    ) -> PrincipalStaffPage:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.staff(
            db,
            vice_principal.tenant_id,
            department_ids=scope.department_ids,
            **filters,
        )

    @staticmethod
    async def staff_detail(
        db: AsyncSession, vice_principal: User, user_id: uuid.UUID
    ) -> PrincipalStaffDetail:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.staff_detail(
            db,
            vice_principal.tenant_id,
            user_id,
            department_ids=scope.department_ids,
        )

    @staticmethod
    async def notices(
        db: AsyncSession,
        vice_principal: User,
        **filters,
    ) -> VicePrincipalNoticePage:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        page = await PrincipalService.notices(
            db,
            vice_principal.tenant_id,
            department_ids=scope.department_ids,
            **filters,
        )
        return VicePrincipalNoticePage(
            total=page.total,
            limit=page.limit,
            offset=page.offset,
            items=[
                LeadershipNoticeRow.model_validate(item.model_dump(exclude={"read_count"}))
                for item in page.items
            ],
        )

    @staticmethod
    async def notice_detail(
        db: AsyncSession, vice_principal: User, notice_id: uuid.UUID
    ) -> VicePrincipalNoticeDetail:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        detail = await PrincipalService.notice_detail(
            db,
            vice_principal.tenant_id,
            notice_id,
            department_ids=scope.department_ids,
            include_readers=False,
        )
        return VicePrincipalNoticeDetail.model_validate(
            detail.model_dump(exclude={"read_count", "readers"})
        )

    @staticmethod
    async def create_notice(
        db: AsyncSession,
        vice_principal: User,
        payload: PrincipalNoticeCreate,
    ) -> VicePrincipalNoticeDetail:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        detail = await PrincipalService.create_notice(
            db,
            vice_principal.tenant_id,
            vice_principal,
            payload,
            department_ids=scope.department_ids,
            allow_institution=False,
            actor_role="VICE_PRINCIPAL",
        )
        return VicePrincipalNoticeDetail.model_validate(
            detail.model_dump(exclude={"read_count", "readers"})
        )

    @staticmethod
    async def notice_targets(
        db: AsyncSession, vice_principal: User
    ) -> PrincipalNoticeTargets:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.notice_targets(
            db,
            vice_principal.tenant_id,
            department_ids=scope.department_ids,
        )

    @staticmethod
    async def export_rows(
        db: AsyncSession,
        vice_principal: User,
        kind: str,
        *,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> tuple[str, list[str], list[list[object | None]]]:
        scope = await VicePrincipalService.scope_for_user(db, vice_principal)
        return await PrincipalService.export_rows(
            db,
            vice_principal.tenant_id,
            kind,
            from_date=from_date,
            to_date=to_date,
            department_ids=scope.department_ids,
        )
