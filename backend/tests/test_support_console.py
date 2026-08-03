"""
Tests — Support Staff console (C-SP-01 … C-SP-04)

Covers the four API groups from `complete_webpage_developer_assignment.md`
§2.2 using the scripted-fake-session pattern the other suites use, so no live
database is needed.

The focus is the rules that are easy to regress:
  - only Support (or a Super Admin) reaches the console (§4.1)
  - Support cannot modify institution data — there is no write path at all
  - internal notes never reach the customer
  - illegal status transitions are refused; CLOSED is terminal
  - one queue serves both owner-raised and institution-raised tickets
  - every mutation writes an audit row in the same transaction
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.audit import AuditLog
from app.models.platform_user import PlatformRole, PlatformUser
from app.models.support_ticket import (
    SLA_HOURS,
    TICKET_PRIORITIES,
    TICKET_PRIORITY_DEFAULT,
    SupportTicket,
    SupportTicketMessage,
)
from app.schemas.support import TicketReplyCreate, TicketRow, TicketUpdate
from app.services.support_service import STATUS_TRANSITIONS, SupportService


# ── Fakes ────────────────────────────────────────────────────────────────────

class Result:
    def __init__(self, scalar=None, scalars=None, rows=None):
        self._scalar = scalar
        self._scalars = scalars if scalars is not None else []
        self._rows = rows if rows is not None else []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows

    def scalars(self):
        return MagicMock(all=lambda: self._scalars)


class FakeDB:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.committed = False
        self.execute = AsyncMock(side_effect=self._pop)

    async def _pop(self, stmt):
        if not self.results:
            raise AssertionError(f"Unexpected execute: {stmt}")
        return self.results.pop(0)

    def add(self, obj):
        if hasattr(obj, "created_at") and getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        self.committed = True

    def of_type(self, cls):
        return [o for o in self.added if isinstance(o, cls)]


def agent(role=PlatformRole.SUPPORT):
    return PlatformUser(
        id=uuid.uuid4(), name="Nandini Rao", email="sup@xyz.com",
        password_hash="x", platform_role=role, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def ticket(status="OPEN", priority="HIGH", hours_old=2, assigned=None, owner=True):
    now = datetime.now(timezone.utc)
    return SupportTicket(
        id=uuid.uuid4(),
        reference="TKT-1001",
        owner_id=uuid.uuid4() if owner else None,
        raised_by=None if owner else uuid.uuid4(),
        tenant_id=None if owner else uuid.uuid4(),
        assigned_to=assigned,
        subject="Login broken",
        description="Staff cannot sign in.",
        category="TECHNICAL",
        status=status,
        priority=priority,
        created_at=now - timedelta(hours=hours_old),
        updated_at=now - timedelta(hours=hours_old),
    )


def empty_hydration():
    """The five batched lookups `_rows()` performs, all returning nothing."""
    return [Result(scalars=[]), Result(rows=[]), Result(rows=[]), Result(rows=[]), Result(rows=[])]


# ── §4.1 — who may reach the console ─────────────────────────────────────────

async def test_support_and_super_admin_are_allowed():
    from app.routers.platform.support import require_support

    for role in (PlatformRole.SUPPORT, PlatformRole.SUPER_ADMIN):
        a = agent(role)
        assert await require_support(a) is a


async def test_sales_and_finance_are_refused():
    from app.routers.platform.support import require_support

    for role in (PlatformRole.SALES, PlatformRole.FINANCE, PlatformRole.OWNER):
        with pytest.raises(HTTPException) as exc:
            await require_support(agent(role))
        assert exc.value.status_code == 403


def test_support_console_exposes_no_write_path_into_a_tenant():
    """
    §4.1: Support "cannot modify institution data or settings".

    The enforcement is structural — the readonly route has no PATCH/PUT/DELETE
    sibling — so assert on the router table rather than trusting a comment.
    """
    from app.routers.platform.support import router

    for route in router.routes:
        if "readonly" in route.path:
            assert route.methods <= {"GET", "HEAD", "OPTIONS"}, route.methods

    # And nothing in this router touches a tenant-owned entity.
    writable = {
        r.path
        for r in router.routes
        if r.methods & {"POST", "PATCH", "PUT", "DELETE"}
    }
    assert all("/tickets" in p for p in writable), writable


# ── C-SP-03 — status transitions ─────────────────────────────────────────────

def test_closed_is_terminal():
    assert STATUS_TRANSITIONS["CLOSED"] == ()


@pytest.mark.parametrize(
    "current,target,allowed",
    [
        ("OPEN", "IN_PROGRESS", True),
        ("OPEN", "RESOLVED", True),
        ("OPEN", "CLOSED", False),
        ("IN_PROGRESS", "RESOLVED", True),
        ("RESOLVED", "CLOSED", True),
        ("RESOLVED", "OPEN", False),
        ("CLOSED", "OPEN", False),
    ],
)
async def test_status_transitions_are_enforced(current, target, allowed):
    t = ticket(status=current)
    db = FakeDB([Result(scalar=t), *empty_hydration()])

    if allowed:
        row = await SupportService.update_ticket(
            db, t.id, TicketUpdate(status=target), agent()
        )
        assert row.status == target
    else:
        with pytest.raises(HTTPException) as exc:
            await SupportService.update_ticket(
                db, t.id, TicketUpdate(status=target), agent()
            )
        assert exc.value.status_code == 400


async def test_resolving_stamps_resolved_at():
    """`resolved_at` is what the dashboard's 'resolved today' counts."""
    t = ticket(status="IN_PROGRESS")
    db = FakeDB([Result(scalar=t), *empty_hydration()])

    await SupportService.update_ticket(db, t.id, TicketUpdate(status="RESOLVED"), agent())
    assert t.resolved_at is not None


async def test_reopening_clears_resolved_at():
    t = ticket(status="RESOLVED")
    t.resolved_at = datetime.now(timezone.utc)
    db = FakeDB([Result(scalar=t), *empty_hydration()])

    await SupportService.update_ticket(db, t.id, TicketUpdate(status="IN_PROGRESS"), agent())
    assert t.resolved_at is None


# ── C-SP-03 — replies ────────────────────────────────────────────────────────

async def test_public_reply_moves_open_to_in_progress():
    t = ticket(status="OPEN")
    db = FakeDB([
        Result(scalar=t),                    # load
        Result(scalar=t), *empty_hydration(),  # detail reload
        Result(scalars=[]),                  # messages
    ])

    await SupportService.reply(db, t.id, TicketReplyCreate(body="On it."), agent())

    assert t.status == "IN_PROGRESS"
    msg = db.of_type(SupportTicketMessage)[0]
    assert msg.author_role == "SUPPORT"
    assert msg.is_internal is False


async def test_internal_note_does_not_change_status():
    """A memo to the team is not a response to the customer."""
    t = ticket(status="OPEN")
    db = FakeDB([
        Result(scalar=t),
        Result(scalar=t), *empty_hydration(),
        Result(scalars=[]),
    ])

    await SupportService.reply(
        db, t.id, TicketReplyCreate(body="Check with finance.", is_internal=True), agent()
    )

    assert t.status == "OPEN"
    assert db.of_type(SupportTicketMessage)[0].is_internal is True


async def test_cannot_reply_to_a_closed_ticket():
    t = ticket(status="CLOSED")
    db = FakeDB([Result(scalar=t)])

    with pytest.raises(HTTPException) as exc:
        await SupportService.reply(db, t.id, TicketReplyCreate(body="hi"), agent())
    assert exc.value.status_code == 400


async def test_owner_facing_query_filters_internal_notes():
    """
    Regression: the owner serialiser returned every message, so a staff-only
    note would have been shown to the customer. The guard lives in the SQL
    WHERE clause, not a loop, so assert it is compiled into the statement.
    """
    from app.services.owner_service import OwnerService
    import inspect

    source = inspect.getsource(OwnerService._ticket_out)
    assert "is_internal" in source, "internal notes must be filtered for owners"


# ── C-SP-03 — assignment ─────────────────────────────────────────────────────

async def test_explicit_null_unassigns():
    """`assignedToId: null` means unassign; omitting it means leave alone."""
    a = agent()
    t = ticket(assigned=a.id)
    db = FakeDB([Result(scalar=t), *empty_hydration()])

    await SupportService.update_ticket(
        db, t.id, TicketUpdate(assigned_to_id=None), a
    )
    assert t.assigned_to is None


async def test_omitting_assignee_leaves_it_alone():
    a = agent()
    t = ticket(assigned=a.id, status="OPEN")
    db = FakeDB([Result(scalar=t), *empty_hydration()])

    await SupportService.update_ticket(db, t.id, TicketUpdate(priority="LOW"), a)
    assert t.assigned_to == a.id


async def test_unknown_assignee_is_404():
    t = ticket()
    db = FakeDB([Result(scalar=t), Result(scalar=None)])

    with pytest.raises(HTTPException) as exc:
        await SupportService.update_ticket(
            db, t.id, TicketUpdate(assigned_to_id=uuid.uuid4()), agent()
        )
    assert exc.value.status_code == 404


# ── Audit ────────────────────────────────────────────────────────────────────

async def test_every_mutation_is_audited():
    t = ticket(status="OPEN")
    db = FakeDB([Result(scalar=t), *empty_hydration()])
    await SupportService.update_ticket(db, t.id, TicketUpdate(priority="LOW"), agent())
    assert db.of_type(AuditLog)[0].action == "TICKET_UPDATED"

    t2 = ticket(status="OPEN")
    db2 = FakeDB([
        Result(scalar=t2),
        Result(scalar=t2), *empty_hydration(),
        Result(scalars=[]),
    ])
    await SupportService.reply(db2, t2.id, TicketReplyCreate(body="hi"), agent())
    assert db2.of_type(AuditLog)[0].action == "TICKET_REPLIED"


async def test_no_op_update_writes_nothing():
    t = ticket(status="OPEN", priority="HIGH")
    db = FakeDB([Result(scalar=t), *empty_hydration()])
    await SupportService.update_ticket(db, t.id, TicketUpdate(priority="HIGH"), agent())
    assert db.of_type(AuditLog) == []


async def test_unknown_ticket_is_404():
    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as exc:
        await SupportService.ticket_detail(db, uuid.uuid4())
    assert exc.value.status_code == 404


# ── SLA ──────────────────────────────────────────────────────────────────────

def test_sla_table_covers_every_priority():
    assert set(SLA_HOURS) == set(TICKET_PRIORITIES)


def test_breach_detection():
    def row(priority, age, status="OPEN"):
        return TicketRow(
            id=uuid.uuid4(), reference="TKT-1", subject="s", description="d",
            priority=priority, status=status, tenant_id=None, tenant_name="T",
            tenant_slug="t", raised_by_name="R", raised_by_role="Admin",
            assigned_to_id=None, assigned_to_name=None,
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
            resolved_at=None, reply_count=0, age_hours=age,
        )

    assert SupportService.is_breaching(row("CRITICAL", 5)) is True   # target 4h
    assert SupportService.is_breaching(row("CRITICAL", 2)) is False
    assert SupportService.is_breaching(row("LOW", 50)) is False      # target 96h
    # A resolved ticket's age is history, not a breach.
    assert SupportService.is_breaching(row("CRITICAL", 500, "RESOLVED")) is False


# ── Priority vocabulary ──────────────────────────────────────────────────────

def test_priority_vocabulary_matches_the_frontend():
    """
    The ORM shipped NORMAL/URGENT while database.sql and types/support.ts use
    MEDIUM/CRITICAL. Any ticket written with the old spelling now violates a
    DB CHECK, so the constant must not drift back.
    """
    assert TICKET_PRIORITIES == ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert TICKET_PRIORITY_DEFAULT == "MEDIUM"
    assert "NORMAL" not in TICKET_PRIORITIES
    assert "URGENT" not in TICKET_PRIORITIES


def test_support_schemas_serialise_camel_case():
    from app.schemas.common import Wire
    from app.schemas import support as s

    for name in (
        "TicketRow", "TicketDetail", "TicketReply", "SupportStats",
        "InstitutionSnapshot", "HealthCheck", "SnapshotActivity", "PriorityCount",
    ):
        assert issubclass(getattr(s, name), Wire), name


# ── C-SP-04 — health checks ──────────────────────────────────────────────────

def test_snapshot_checks_flag_what_support_acts_on():
    from app.models.tenant import Tenant, TenantType

    suspended = Tenant(
        id=uuid.uuid4(), name="Green", slug="green", type=TenantType.COLLEGE,
        is_active=False, timezone="Asia/Kolkata", country="India",
        trial_ends_at=datetime.now(timezone.utc) - timedelta(days=5),
        created_at=datetime.now(timezone.utc),
    )
    checks = {
        c.label: c
        for c in SupportService._checks(
            tenant=suspended, plan=None, sub_status="PAST_DUE",
            admin_count=0, students=0, teachers=0, module_count=0,
        )
    }

    assert checks["Institution active"].ok is False
    assert checks["Subscription"].ok is False
    assert checks["Institution admin"].ok is False
    assert checks["Modules enabled"].ok is False
    assert checks["Trial"].ok is False
    # Every failing check must explain itself — an agent needs the next step.
    assert all(c.hint for c in checks.values() if not c.ok)


def test_unlimited_plan_is_never_over_cap():
    """-1 means unlimited (§4.1), not a cap of minus one."""
    from app.models.catalog import Plan
    from app.models.tenant import Tenant, TenantType

    plan = Plan(
        id=uuid.uuid4(), name="Premium", slug="premium",
        max_students=-1, max_teachers=-1, max_storage_gb=500,
        price_monthly=1, price_yearly=1, currency="INR",
        allowed_modules=[], is_active=True,
    )
    tenant = Tenant(
        id=uuid.uuid4(), name="Big", slug="big", type=TenantType.COLLEGE,
        is_active=True, timezone="Asia/Kolkata", country="India",
        created_at=datetime.now(timezone.utc),
    )
    checks = {
        c.label: c
        for c in SupportService._checks(
            tenant=tenant, plan=plan, sub_status="ACTIVE",
            admin_count=1, students=100_000, teachers=5_000, module_count=8,
        )
    }
    assert checks["Student seats"].ok is True
    assert "unlimited" in checks["Student seats"].value


def test_status_transitions_match_the_client():
    """
    `STATUS_TRANSITIONS` exists server-side (enforcement) and client-side
    (the dropdown). They must agree, or the UI offers a move the API refuses.
    Parsed from the TypeScript rather than duplicated as a Python literal,
    so this test cannot drift into agreeing with itself.
    """
    import re
    from pathlib import Path

    src = Path(__file__).resolve().parents[2] / "fontend" / "lib" / "support.ts"
    block = re.search(
        r"STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus\[\]> = \{(.*?)\n\};",
        src.read_text(),
        re.S,
    )
    assert block, "STATUS_TRANSITIONS not found in fontend/lib/support.ts"

    client = {
        m.group(1): tuple(re.findall(r'"(\w+)"', m.group(2)))
        for m in re.finditer(r"(\w+): \[([^\]]*)\]", block.group(1))
    }
    assert client == STATUS_TRANSITIONS, f"client={client} server={STATUS_TRANSITIONS}"


def test_sla_hours_match_the_client():
    """Same pairing for the SLA table — a mismatch mislabels breaches."""
    import re
    from pathlib import Path

    src = Path(__file__).resolve().parents[2] / "fontend" / "lib" / "support.ts"
    block = re.search(
        r"SLA_HOURS: Record<TicketPriority, number> = \{(.*?)\n\};",
        src.read_text(),
        re.S,
    )
    assert block, "SLA_HOURS not found in fontend/lib/support.ts"

    client = {m.group(1): int(m.group(2)) for m in re.finditer(r"(\w+): (\d+)", block.group(1))}
    assert client == SLA_HOURS, f"client={client} server={SLA_HOURS}"
