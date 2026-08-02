"""
Services — Audit trail (§10.3)

Two responsibilities, kept apart from every other service so nothing
duplicates them:

  `record()` — append one row. Called by each mutating Super Admin endpoint.
  `list_entries()` — the C-SA-07 reader, with the filters that page offers.

Append-only by contract: there is no update and no delete here, and none of
the routers expose one. `tenant_id=None` marks a platform-level action, which
is exactly what the console's "Platform" filter selects on.

`record()` never commits. It joins the caller's transaction, so an action and
its audit row land together or not at all — a suspended tenant with no trail,
or a trail entry for a suspension that rolled back, are both impossible.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.platform_user import PlatformUser
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.platform_admin import AuditEntry, AuditPage


def client_ip(request: Request | None) -> str | None:
    """Real client IP, honouring the proxy header the middleware sets."""
    if request is None:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


class AuditService:
    @staticmethod
    def record(
        db: AsyncSession,
        *,
        actor: PlatformUser | User,
        actor_role: str,
        action: str,
        entity: str,
        entity_id: uuid.UUID | None = None,
        tenant_id: uuid.UUID | None = None,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
        request: Request | None = None,
    ) -> AuditLog:
        """
        Append one entry to the trail, inside the caller's transaction.

        Synchronous on purpose: it only calls `session.add()`, so making it
        async would force an `await` at 12 call sites for no benefit.
        """
        row = AuditLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            user_id=actor.id,
            user_role=actor_role,
            action=action,
            entity=entity,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=client_ip(request),
            user_agent=(request.headers.get("User-Agent") if request else None),
        )
        db.add(row)
        return row

    # ── C-SA-07 reader ───────────────────────────────────────────────────────

    @staticmethod
    async def list_entries(
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID | None = None,
        platform_only: bool = False,
        action: str | None = None,
        entity: str | None = None,
        search: str | None = None,
        since: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> AuditPage:
        """
        Global trail, newest first, with the filters C-SA-07 offers
        ("filter by tenant, user, action, date").

        Actor names are resolved with two batched lookups rather than a join,
        because `audit_logs.user_id` intentionally has no FK: it may point at
        a `platform_users` row or a tenant `users` row, and the trail has to
        survive either being deleted.
        """
        stmt: Select = select(AuditLog)
        count_stmt: Select = select(func.count()).select_from(AuditLog)

        def apply(s: Select) -> Select:
            if platform_only:
                s = s.where(AuditLog.tenant_id.is_(None))
            elif tenant_id is not None:
                s = s.where(AuditLog.tenant_id == tenant_id)
            if action:
                s = s.where(AuditLog.action == action)
            if entity:
                s = s.where(AuditLog.entity == entity)
            if since:
                s = s.where(AuditLog.created_at >= since)
            if search:
                like = f"%{search.lower()}%"
                s = s.where(
                    func.lower(AuditLog.action).like(like)
                    | func.lower(AuditLog.entity).like(like)
                    | func.lower(AuditLog.user_role).like(like)
                )
            return s

        stmt = apply(stmt).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        total = (await db.execute(apply(count_stmt))).scalar() or 0
        rows = list((await db.execute(stmt)).scalars().all())

        return AuditPage(
            entries=await AuditService.to_entries(db, rows),
            total=int(total),
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def to_entries(
        db: AsyncSession, rows: list[AuditLog]
    ) -> list[AuditEntry]:
        """Hydrate raw rows into the wire shape the console renders."""
        if not rows:
            return []

        actor_ids = {r.user_id for r in rows}
        tenant_ids = {r.tenant_id for r in rows if r.tenant_id is not None}

        names: dict[uuid.UUID, str] = {}
        for model in (PlatformUser, User):
            res = await db.execute(
                select(model.id, model.name).where(model.id.in_(actor_ids))
            )
            names.update({i: n for i, n in res.all()})

        tenant_names: dict[uuid.UUID, str] = {}
        if tenant_ids:
            res = await db.execute(
                select(Tenant.id, Tenant.name).where(Tenant.id.in_(tenant_ids))
            )
            tenant_names = {i: n for i, n in res.all()}

        return [
            AuditEntry(
                id=r.id,
                action=r.action,
                entity=r.entity,
                # The console shows what was acted on; fall back to the id when
                # the target no longer has a readable label.
                target=_target(r),
                actor_name=names.get(r.user_id, "Deleted user"),
                actor_role=r.user_role,
                tenant_name=tenant_names.get(r.tenant_id) if r.tenant_id else None,
                ip_address=str(r.ip_address) if r.ip_address else "—",
                created_at=r.created_at,
            )
            for r in rows
        ]


def _target(row: AuditLog) -> str:
    """Best available human label for the affected record."""
    for source in (row.new_value, row.old_value):
        if isinstance(source, dict):
            for key in ("name", "slug", "email", "title", "key"):
                value = source.get(key)
                if value:
                    return str(value)
    return str(row.entity_id) if row.entity_id else row.entity
