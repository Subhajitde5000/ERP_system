"""
Services — Support Staff console (C-SP-01 … C-SP-04)

`role_based_system_design.md` §4.1, verbatim:
  - View institution data in read-only mode (for debugging)
  - Respond to support tickets
  - **Cannot modify institution data or settings**

That last line is the whole shape of this module. An agent may change a
*ticket* — status, assignee, replies; `support_tickets` rows the platform owns
— but nothing inside a tenant. So C-SP-04 returns a diagnostic snapshot and
has no write counterpart anywhere in this file.

Tenant hydration (headcounts, enabled modules, current subscription) is
delegated to `PlatformAdminService`, which already batches those queries for
the Super Admin console. Re-implementing them here would mean two versions of
the same N+1 fix.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from fastapi import HTTPException, Request, status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.catalog import Plan
from app.models.platform_user import PlatformUser
from app.models.role import Role, RoleAssignment
from app.models.support_ticket import (
    SLA_HOURS,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
    SupportTicket,
    SupportTicketMessage,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.support import (
    HealthCheck,
    InstitutionSnapshot,
    PriorityCount,
    SnapshotActivity,
    SupportStats,
    TicketDetail,
    TicketReply,
    TicketReplyCreate,
    TicketRow,
    TicketUpdate,
)
from app.services.audit_service import AuditService
from app.services.platform_admin_service import PlatformAdminService

# Statuses that still need work. RESOLVED and CLOSED are done.
OPEN_STATUSES = ("OPEN", "IN_PROGRESS")

# Transitions an agent may make. CLOSED is terminal from the support side —
# reopening is the customer raising a new ticket. Encoded once here and
# mirrored by `STATUS_TRANSITIONS` in the client, so the dropdown and the API
# cannot disagree.
STATUS_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "OPEN": ("IN_PROGRESS", "RESOLVED"),
    "IN_PROGRESS": ("RESOLVED", "OPEN"),
    "RESOLVED": ("CLOSED", "IN_PROGRESS"),
    "CLOSED": (),
}

# Author roles, split by side of the conversation.
SUPPORT_ROLES = ("SUPPORT", "STAFF")


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def _bad(msg: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


def _age_hours(created_at: datetime, now: datetime) -> float:
    return round((now - created_at).total_seconds() / 3600, 2)


class SupportService:
    # ══ Shared hydration ═════════════════════════════════════════════════════

    @staticmethod
    async def _rows(db: AsyncSession, tickets: list[SupportTicket]) -> list[TicketRow]:
        """
        Turn tickets into wire rows in a fixed number of queries.

        Four batched lookups regardless of ticket count — tenants, raisers,
        agents and reply counts — because the queue routinely renders 200 rows
        and a per-row join would be the classic N+1.
        """
        if not tickets:
            return []

        now = datetime.now(timezone.utc)
        ids = [t.id for t in tickets]

        tenant_ids = {t.tenant_id for t in tickets if t.tenant_id}
        tenants: dict[uuid.UUID, Tenant] = {}
        if tenant_ids:
            res = await db.execute(select(Tenant).where(Tenant.id.in_(tenant_ids)))
            tenants = {t.id: t for t in res.scalars().all()}

        # A ticket is raised either by a tenant user or by a platform owner.
        raiser_ids = {t.raised_by for t in tickets if t.raised_by}
        raisers: dict[uuid.UUID, str] = {}
        if raiser_ids:
            res = await db.execute(
                select(User.id, User.name).where(User.id.in_(raiser_ids))
            )
            raisers = dict(res.all())

        owner_ids = {t.owner_id for t in tickets if t.owner_id}
        owners: dict[uuid.UUID, str] = {}
        if owner_ids:
            from app.models.platform_owner import PlatformOwner

            res = await db.execute(
                select(PlatformOwner.id, PlatformOwner.name).where(
                    PlatformOwner.id.in_(owner_ids)
                )
            )
            owners = dict(res.all())

        agent_ids = {t.assigned_to for t in tickets if t.assigned_to}
        agents: dict[uuid.UUID, str] = {}
        if agent_ids:
            res = await db.execute(
                select(PlatformUser.id, PlatformUser.name).where(
                    PlatformUser.id.in_(agent_ids)
                )
            )
            agents = dict(res.all())

        res = await db.execute(
            select(SupportTicketMessage.ticket_id, func.count())
            .where(SupportTicketMessage.ticket_id.in_(ids))
            .group_by(SupportTicketMessage.ticket_id)
        )
        replies = {tid: int(c) for tid, c in res.all()}

        rows: list[TicketRow] = []
        for t in tickets:
            tenant = tenants.get(t.tenant_id) if t.tenant_id else None
            if t.owner_id:
                raised_by_name = owners.get(t.owner_id, "Account owner")
                raised_by_role = "Account Owner"
            else:
                raised_by_name = raisers.get(t.raised_by, "Unknown") if t.raised_by else "Unknown"
                raised_by_role = "Institution Admin"

            rows.append(
                TicketRow(
                    id=t.id,
                    reference=t.reference or str(t.id)[:8].upper(),
                    subject=t.subject,
                    description=t.description or "",
                    priority=t.priority,  # type: ignore[arg-type]
                    status=t.status,  # type: ignore[arg-type]
                    tenant_id=t.tenant_id,
                    # Account-level tickets belong to no institution; label
                    # them rather than showing an empty cell.
                    tenant_name=tenant.name if tenant else "Account-level",
                    tenant_slug=tenant.slug if tenant else "—",
                    raised_by_name=raised_by_name,
                    raised_by_role=raised_by_role,
                    assigned_to_id=t.assigned_to,
                    assigned_to_name=agents.get(t.assigned_to) if t.assigned_to else None,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                    resolved_at=t.resolved_at,
                    reply_count=replies.get(t.id, 0),
                    age_hours=_age_hours(t.created_at, now),
                )
            )
        return rows

    @staticmethod
    async def _ticket(db: AsyncSession, ticket_id: uuid.UUID) -> SupportTicket:
        res = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
        ticket = res.scalar_one_or_none()
        if ticket is None:
            raise _not_found("Ticket")
        return ticket

    # ══ C-SP-02 · Ticket list ════════════════════════════════════════════════

    @staticmethod
    async def list_tickets(
        db: AsyncSession,
        *,
        status_filter: str | None = None,
        priority: str | None = None,
        tenant_id: uuid.UUID | None = None,
        assigned_to: uuid.UUID | None = None,
        unassigned: bool = False,
        search: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[TicketRow]:
        """All tickets, newest first, with the filters C-SP-02 offers."""
        stmt: Select = select(SupportTicket)

        if status_filter == "OPEN_ALL":
            stmt = stmt.where(SupportTicket.status.in_(OPEN_STATUSES))
        elif status_filter and status_filter != "ALL":
            stmt = stmt.where(SupportTicket.status == status_filter)

        if priority and priority != "ALL":
            stmt = stmt.where(SupportTicket.priority == priority)
        if tenant_id is not None:
            stmt = stmt.where(SupportTicket.tenant_id == tenant_id)
        if unassigned:
            stmt = stmt.where(SupportTicket.assigned_to.is_(None))
        elif assigned_to is not None:
            stmt = stmt.where(SupportTicket.assigned_to == assigned_to)
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(SupportTicket.subject).like(like),
                    func.lower(func.coalesce(SupportTicket.description, "")).like(like),
                    func.lower(func.coalesce(SupportTicket.reference, "")).like(like),
                )
            )

        res = await db.execute(
            stmt.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset)
        )
        return await SupportService._rows(db, list(res.scalars().all()))

    # ══ C-SP-03 · Ticket detail ══════════════════════════════════════════════

    @staticmethod
    async def ticket_detail(db: AsyncSession, ticket_id: uuid.UUID) -> TicketDetail:
        ticket = await SupportService._ticket(db, ticket_id)
        row = (await SupportService._rows(db, [ticket]))[0]

        res = await db.execute(
            select(SupportTicketMessage)
            .where(SupportTicketMessage.ticket_id == ticket.id)
            .order_by(SupportTicketMessage.created_at)
        )
        messages = list(res.scalars().all())
        return TicketDetail(
            ticket=row,
            replies=await SupportService._replies(db, messages),
        )

    @staticmethod
    async def _replies(
        db: AsyncSession, messages: list[SupportTicketMessage]
    ) -> list[TicketReply]:
        """Resolve author names in two batched lookups, not one per message."""
        if not messages:
            return []

        author_ids = {m.author_id for m in messages if m.author_id}
        names: dict[uuid.UUID, str] = {}
        if author_ids:
            from app.models.platform_owner import PlatformOwner

            for model in (PlatformUser, User, PlatformOwner):
                res = await db.execute(
                    select(model.id, model.name).where(model.id.in_(author_ids))
                )
                names.update(dict(res.all()))

        out: list[TicketReply] = []
        for m in messages:
            is_support = m.author_role in SUPPORT_ROLES
            out.append(
                TicketReply(
                    id=m.id,
                    author_name=names.get(m.author_id, "Unknown") if m.author_id else "System",
                    author_kind="SUPPORT" if is_support else "INSTITUTION",
                    author_role=(
                        "Support Staff" if is_support
                        else "Account Owner" if m.author_role == "OWNER"
                        else "Institution Admin"
                    ),
                    body=m.body,
                    is_internal=bool(m.is_internal),
                    created_at=m.created_at,
                )
            )
        return out

    @staticmethod
    async def reply(
        db: AsyncSession,
        ticket_id: uuid.UUID,
        payload: TicketReplyCreate,
        agent: PlatformUser,
        request: Request | None = None,
    ) -> TicketDetail:
        ticket = await SupportService._ticket(db, ticket_id)
        if ticket.status == "CLOSED":
            raise _bad("This ticket is closed — reopening is a new ticket")

        db.add(
            SupportTicketMessage(
                id=uuid.uuid4(),
                ticket_id=ticket.id,
                author_role="SUPPORT",
                author_id=agent.id,
                body=payload.body.strip(),
                is_internal=payload.is_internal,
            )
        )
        # A public reply means the agent is working it; an internal note is
        # just a memo and must not change what the customer sees.
        if not payload.is_internal and ticket.status == "OPEN":
            ticket.status = "IN_PROGRESS"
        ticket.updated_at = datetime.now(timezone.utc)

        AuditService.record(
            db,
            actor=agent,
            actor_role=agent.platform_role.value,
            action="TICKET_REPLIED",
            entity="support_ticket",
            entity_id=ticket.id,
            tenant_id=ticket.tenant_id,
            new_value={
                "reference": ticket.reference,
                "internal": payload.is_internal,
                "status": ticket.status,
            },
            request=request,
        )
        await db.flush()
        await db.commit()
        return await SupportService.ticket_detail(db, ticket.id)

    @staticmethod
    async def update_ticket(
        db: AsyncSession,
        ticket_id: uuid.UUID,
        payload: TicketUpdate,
        agent: PlatformUser,
        request: Request | None = None,
    ) -> TicketRow:
        ticket = await SupportService._ticket(db, ticket_id)
        before = {
            "status": ticket.status,
            "priority": ticket.priority,
            "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
        }
        changed: dict[str, object] = {}
        fields = payload.model_fields_set

        if payload.status is not None and payload.status != ticket.status:
            allowed = STATUS_TRANSITIONS.get(ticket.status, ())
            if payload.status not in allowed:
                raise _bad(
                    f"Cannot move a {ticket.status} ticket to {payload.status}"
                    + (f" — allowed: {', '.join(allowed)}" if allowed else " (closed is final)")
                )
            ticket.status = payload.status
            # `resolved_at` is what the dashboard's "resolved today" counts, so
            # it is stamped here rather than inferred from updated_at.
            ticket.resolved_at = (
                datetime.now(timezone.utc) if payload.status in ("RESOLVED", "CLOSED") else None
            )
            changed["status"] = payload.status

        if payload.priority is not None and payload.priority != ticket.priority:
            ticket.priority = payload.priority
            changed["priority"] = payload.priority

        # Explicit null unassigns; omitting the key leaves it alone.
        if "assigned_to_id" in fields or "assignedToId" in fields:
            if payload.assigned_to_id is not None:
                res = await db.execute(
                    select(PlatformUser).where(
                        PlatformUser.id == payload.assigned_to_id,
                        PlatformUser.is_active.is_(True),
                    )
                )
                if res.scalar_one_or_none() is None:
                    raise _not_found("Platform user")
            ticket.assigned_to = payload.assigned_to_id
            changed["assigned_to"] = (
                str(payload.assigned_to_id) if payload.assigned_to_id else None
            )

        if not changed:
            return (await SupportService._rows(db, [ticket]))[0]

        ticket.updated_at = datetime.now(timezone.utc)
        AuditService.record(
            db,
            actor=agent,
            actor_role=agent.platform_role.value,
            action="TICKET_UPDATED",
            entity="support_ticket",
            entity_id=ticket.id,
            tenant_id=ticket.tenant_id,
            old_value=before,
            new_value={"reference": ticket.reference, **changed},
            request=request,
        )
        await db.flush()
        await db.commit()
        return (await SupportService._rows(db, [ticket]))[0]

    # ══ C-SP-01 · Dashboard ══════════════════════════════════════════════════

    @staticmethod
    async def stats(db: AsyncSession, agent: PlatformUser) -> SupportStats:
        res = await db.execute(
            select(SupportTicket).order_by(SupportTicket.created_at.desc())
        )
        tickets = list(res.scalars().all())
        rows = await SupportService._rows(db, tickets)
        by_id = {t.id: t for t in tickets}

        open_rows = [r for r in rows if r.status in OPEN_STATUSES]
        today = date.today()

        counts = {p: 0 for p in TICKET_PRIORITIES}
        for r in open_rows:
            counts[r.priority] = counts.get(r.priority, 0) + 1

        mine = [r for r in open_rows if r.assigned_to_id == agent.id]

        return SupportStats(
            open=sum(1 for r in rows if r.status == "OPEN"),
            in_progress=sum(1 for r in rows if r.status == "IN_PROGRESS"),
            resolved_today=sum(
                1
                for r in rows
                if by_id[r.id].resolved_at and by_id[r.id].resolved_at.date() == today
            ),
            unassigned=sum(1 for r in open_rows if r.assigned_to_id is None),
            mine=len(mine),
            by_priority=[
                PriorityCount(priority=p, count=counts.get(p, 0))  # type: ignore[arg-type]
                for p in TICKET_PRIORITIES
            ],
            # Triage order: breaching SLA first, then oldest.
            oldest_open=sorted(
                open_rows,
                key=lambda r: (not SupportService.is_breaching(r), -r.age_hours),
            )[:5],
            my_queue=sorted(mine, key=lambda r: r.created_at, reverse=True)[:5],
        )

    @staticmethod
    def is_breaching(row: TicketRow) -> bool:
        """Past its response target. Only unresolved tickets can breach."""
        return row.status in OPEN_STATUSES and row.age_hours > SLA_HOURS[row.priority]

    # ══ C-SP-04 · Institution read-only snapshot ═════════════════════════════

    @staticmethod
    async def institution_snapshot(
        db: AsyncSession, tenant_id: uuid.UUID
    ) -> InstitutionSnapshot:
        """
        Diagnostic view — "is their setup broken?".

        Deliberately not the institution app rendered with a support login:
        §4.1 allows read-only debugging, and plan/module/limit facts answer a
        support question without exposing student records, marks or fees,
        none of which an agent needs to debug a login or a module toggle.
        """
        tenant = await PlatformAdminService._tenant(db, tenant_id)

        # Reuse the Super Admin console's batched hydration rather than
        # re-querying headcounts and modules here.
        counts = (await PlatformAdminService._counts_by_role(db, [tenant.id])).get(
            tenant.id, {}
        )
        modules = (await PlatformAdminService._modules_by_tenant(db, [tenant.id])).get(
            tenant.id, []
        )
        subscription = (await PlatformAdminService._latest_subs(db, [tenant.id])).get(
            tenant.id
        )

        plan = None
        if tenant.plan_id:
            res = await db.execute(select(Plan).where(Plan.id == tenant.plan_id))
            plan = res.scalar_one_or_none()

        students = counts.get("STUDENT", 0)
        teachers = counts.get("TEACHER", 0)
        max_students = plan.max_students if plan else -1
        max_teachers = plan.max_teachers if plan else -1

        admin_res = await db.execute(
            select(func.count())
            .select_from(User)
            .join(RoleAssignment, RoleAssignment.user_id == User.id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .where(
                User.tenant_id == tenant.id,
                Role.name == "INSTITUTION_ADMIN",
                RoleAssignment.is_active.is_(True),
                User.is_active.is_(True),
            )
        )
        admin_count = int(admin_res.scalar() or 0)

        sub_status = subscription.status if subscription else "TRIAL"
        checks = SupportService._checks(
            tenant=tenant,
            plan=plan,
            sub_status=sub_status,
            admin_count=admin_count,
            students=students,
            teachers=teachers,
            module_count=len(modules),
        )

        audit_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.tenant_id == tenant.id)
            .order_by(AuditLog.created_at.desc())
            .limit(10)
        )
        entries = await AuditService.to_entries(db, list(audit_res.scalars().all()))

        ticket_res = await db.execute(
            select(SupportTicket)
            .where(
                SupportTicket.tenant_id == tenant.id,
                SupportTicket.status.in_(OPEN_STATUSES),
            )
            .order_by(SupportTicket.created_at.desc())
        )
        open_tickets = await SupportService._rows(db, list(ticket_res.scalars().all()))

        return InstitutionSnapshot(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            tenant_slug=tenant.slug,
            type=tenant.type.value if hasattr(tenant.type, "value") else str(tenant.type),
            plan_name=plan.name if plan else "—",
            is_active=tenant.is_active,
            status=sub_status,
            created_at=tenant.created_at,
            checks=checks,
            enabled_modules=modules,
            allowed_modules=list(plan.allowed_modules or []) if plan else [],
            student_count=students,
            teacher_count=teachers,
            max_students=max_students,
            max_teachers=max_teachers,
            # Not metered yet — reported as 0 rather than invented, so an agent
            # never debugs against a number the platform cannot back up.
            storage_used_gb=0.0,
            max_storage_gb=plan.max_storage_gb if plan else 0,
            recent_activity=[
                SnapshotActivity(
                    id=e.id,
                    action=e.action,
                    target=e.target,
                    actor_name=e.actor_name,
                    created_at=e.created_at,
                )
                for e in entries
            ],
            open_tickets=open_tickets,
        )

    @staticmethod
    def _checks(
        *,
        tenant: Tenant,
        plan: Plan | None,
        sub_status: str,
        admin_count: int,
        students: int,
        teachers: int,
        module_count: int,
    ) -> list[HealthCheck]:
        """
        The handful of facts that explain most support tickets: suspended
        tenant, expired trial, no admin, over the seat cap, no modules.
        """
        checks: list[HealthCheck] = [
            HealthCheck(
                label="Institution active",
                value="Active" if tenant.is_active else "Suspended",
                ok=tenant.is_active,
                hint=None if tenant.is_active else "Suspended tenants cannot sign in at all",
            ),
            HealthCheck(
                label="Subscription",
                value=sub_status,
                ok=sub_status in ("ACTIVE", "TRIAL"),
                hint=None if sub_status in ("ACTIVE", "TRIAL") else "Billing needs attention",
            ),
            HealthCheck(
                label="Institution admin",
                value=f"{admin_count} active",
                ok=admin_count > 0,
                hint=None if admin_count else "Nobody can administer this institution",
            ),
            HealthCheck(
                label="Modules enabled",
                value=str(module_count),
                ok=module_count > 0,
                hint=None if module_count else "No modules on — the app will look empty",
            ),
        ]

        if tenant.trial_ends_at is not None:
            days = (tenant.trial_ends_at - datetime.now(timezone.utc)).days
            checks.append(
                HealthCheck(
                    label="Trial",
                    value=f"{days}d left" if days >= 0 else f"expired {abs(days)}d ago",
                    ok=days >= 0,
                    hint=None if days >= 0 else "Expired trial blocks access until converted",
                )
            )

        # -1 means unlimited (§4.1), so it can never be over cap.
        if plan is not None:
            for label, used, cap in (
                ("Student seats", students, plan.max_students),
                ("Teacher seats", teachers, plan.max_teachers),
            ):
                over = cap != -1 and used > cap
                checks.append(
                    HealthCheck(
                        label=label,
                        value=f"{used} / {'unlimited' if cap == -1 else cap}",
                        ok=not over,
                        hint="Over the plan cap — upgrade required" if over else None,
                    )
                )

        return checks
