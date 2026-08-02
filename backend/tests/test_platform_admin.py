"""
Tests — Super Admin console (C-SA-01 … C-SA-08)

Covers the five API groups from `complete_webpage_developer_assignment.md`
§2.1 plus settings and subscriptions, using the scripted-fake-session pattern
the other suites use (tests/conftest.py) so no live database is needed.

The focus is the rules that are easy to regress and expensive to get wrong:
  - only SUPER_ADMIN reaches the console (§4.1)
  - reserved and duplicate subdomains are refused
  - a tenant can never enable a module its plan does not include
  - the last active Super Admin cannot be locked out
  - every mutation writes an audit row in the same transaction (§10.3)
  - delete is soft — history survives
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.audit import AuditLog
from app.models.billing import OutboxEmail, Subscription, TenantModule, TenantSetting
from app.models.catalog import Module, Plan
from app.models.platform_user import PlatformRole, PlatformUser
from app.models.role import Role, RoleAssignment, ScopeLevel
from app.models.tenant import Tenant, TenantType
from app.models.user import User
from app.schemas.platform_admin import (
    PlanCreate,
    PlatformSettingsUpdate,
    PlatformUserCreate,
    PlatformUserUpdate,
    TenantCreate,
    TenantUpdate,
)
from app.services.platform_admin_service import (
    RESERVED_SLUGS,
    PlatformAdminService,
    _cycle,
)


# ── Fakes ────────────────────────────────────────────────────────────────────

class Result:
    """Mimics the SQLAlchemy result shapes this service uses."""

    def __init__(self, scalar=None, scalars=None, rows=None):
        self._scalar = scalar
        self._scalars = scalars if scalars is not None else []
        self._rows = rows if rows is not None else []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        if self._scalar is None:
            raise AssertionError("scalar_one() on empty result")
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows

    def scalars(self):
        return MagicMock(all=lambda: self._scalars)


class FakeDB:
    """Scripted async session — results are consumed per execute() call."""

    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.committed = False
        self.execute = AsyncMock(side_effect=self._pop)

    # `created_at` is a server_default: NULL on the Python object until the DB
    # assigns it. The real service always reads back a flushed row, so the fake
    # stamps it on add() — otherwise every row builder fails Pydantic
    # validation for a reason that never occurs in production.

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


def make_admin(role=PlatformRole.SUPER_ADMIN):
    return PlatformUser(
        id=uuid.uuid4(), name="Vikram", email="sa@xyz.com",
        password_hash="x", platform_role=role, is_active=True,
        # server_default in the DB; set here because the fake never flushes.
        created_at=datetime.now(timezone.utc),
    )


def make_plan(slug="standard", modules=None):
    return Plan(
        id=uuid.uuid4(), name=slug.title(), slug=slug,
        max_students=2000, max_teachers=150, max_storage_gb=50,
        price_monthly=Decimal("12999"), price_yearly=Decimal("129990"),
        currency="INR",
        allowed_modules=modules if modules is not None else ["attendance", "library"],
        is_active=True,
    )


def make_tenant(slug="green", active=True, plan_id=None):
    return Tenant(
        id=uuid.uuid4(), name="Green College", slug=slug,
        type=TenantType.COLLEGE, plan_id=plan_id, is_active=active,
        timezone="Asia/Kolkata", country="India",
        created_at=datetime.now(timezone.utc),
    )


def make_modules():
    core = ["attendance", "examination"]
    optional = ["library", "hostel"]
    out = []
    for i, k in enumerate(core + optional):
        out.append(
            Module(id=uuid.uuid4(), key=k, name=k.title(),
                   is_core=k in core, sort_order=i, price_monthly=0)
        )
    return out


def admin_role_row():
    return Role(
        id=uuid.uuid4(), name="INSTITUTION_ADMIN", label="Institution Admin",
        scope_level=ScopeLevel.INSTITUTION, is_platform=False, is_optional=False,
    )


# ── §4.1 — console is Super-Admin-only ───────────────────────────────────────

async def test_non_super_admin_is_refused():
    from app.routers.platform.admin import require_super_admin

    for role in (PlatformRole.SUPPORT, PlatformRole.SALES, PlatformRole.FINANCE):
        with pytest.raises(HTTPException) as exc:
            await require_super_admin(make_admin(role))
        assert exc.value.status_code == 403


async def test_super_admin_is_allowed():
    from app.routers.platform.admin import require_super_admin

    admin = make_admin()
    assert await require_super_admin(admin) is admin


# ── C-SA-04 — create institution ─────────────────────────────────────────────

async def test_reserved_subdomain_is_refused():
    """A tenant must never claim a host the platform answers on."""
    assert "admin" in RESERVED_SLUGS and "app" in RESERVED_SLUGS

    db = FakeDB([])
    payload = TenantCreate(
        name="Reserved College", slug="admin", planSlug="standard",
        adminName="Asha Rao", adminEmail="asha@x.edu",
    )
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.create_tenant(db, payload, make_admin())
    assert exc.value.status_code == 409
    assert "reserved" in exc.value.detail.lower()


async def test_duplicate_subdomain_is_refused():
    db = FakeDB([Result(scalar=uuid.uuid4())])  # slug lookup finds a row
    payload = TenantCreate(
        name="Dup College", slug="green", planSlug="standard",
        adminName="Asha Rao", adminEmail="asha@x.edu",
    )
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.create_tenant(db, payload, make_admin())
    assert exc.value.status_code == 409


async def test_create_tenant_provisions_everything_in_one_transaction():
    plan = make_plan()
    db = FakeDB([
        Result(scalar=None),            # slug free
        Result(scalar=plan),            # plan by slug
        Result(scalars=[]),             # settings (trial length → defaults)
        Result(scalars=[]),             # settings (timezone)
        Result(scalar=admin_role_row()),  # INSTITUTION_ADMIN
        Result(scalars=make_modules()),   # module catalogue
        Result(scalars=[]),               # existing tenant_modules
        Result(scalars=[]),               # settings (currency)
        Result(scalars=[plan]),           # _rows → plans
        Result(rows=[]),                  # _rows → counts
        Result(scalars=[]),               # _rows → subs
        Result(rows=[]),                  # _rows → tenant_modules (tenant_id, key)
    ])
    payload = TenantCreate(
        name="Green College", slug="green", type="COLLEGE", planSlug="standard",
        adminName="Asha Rao", adminEmail="Asha@Green.edu", trial=True,
    )

    result = await PlatformAdminService.create_tenant(db, payload, make_admin())

    assert db.committed is True
    assert len(db.of_type(Tenant)) == 1
    assert len(db.of_type(Subscription)) == 1
    assert db.of_type(Subscription)[0].status == "TRIAL"

    admins = db.of_type(User)
    assert len(admins) == 1
    assert admins[0].email == "asha@green.edu"       # normalised
    assert admins[0].password_hash is None            # set via activation link
    assert admins[0].password_reset_token is not None

    assert len(db.of_type(RoleAssignment)) == 1
    assert len(db.of_type(TenantSetting)) == 3
    assert {m.module_key for m in db.of_type(TenantModule)} >= {
        "attendance", "examination",                  # core always on
    }
    assert db.of_type(OutboxEmail)[0].event == "staff.invited"
    assert db.of_type(AuditLog)[0].action == "TENANT_CREATED"
    assert result.login_url == "https://green.xyz.com/login"


# ── C-SA-03 — update / suspend / delete ──────────────────────────────────────

async def test_module_outside_plan_is_refused():
    """§4.1 — a tenant can only enable what its plan offers."""
    plan = make_plan(modules=["attendance", "library"])
    tenant = make_tenant(plan_id=plan.id)
    db = FakeDB([Result(scalar=tenant), Result(scalar=plan)])

    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.update_tenant(
            db, tenant.id, TenantUpdate(enabledModules=["hostel"]), make_admin()
        )
    assert exc.value.status_code == 400
    assert "hostel" in exc.value.detail


async def test_suspend_writes_audit_and_flips_flag():
    tenant = make_tenant(active=True)
    db = FakeDB([
        Result(scalar=tenant),
        Result(scalars=[]), Result(rows=[]), Result(scalars=[]), Result(rows=[]),
    ])

    await PlatformAdminService.set_tenant_active(db, tenant.id, False, make_admin())

    assert tenant.is_active is False
    entry = db.of_type(AuditLog)[0]
    assert entry.action == "TENANT_SUSPENDED"
    assert entry.tenant_id == tenant.id
    assert db.committed is True


async def test_suspend_is_idempotent():
    """Re-suspending an already suspended tenant writes no second audit row."""
    tenant = make_tenant(active=False)
    db = FakeDB([
        Result(scalar=tenant),
        Result(scalars=[]), Result(rows=[]), Result(scalars=[]), Result(rows=[]),
    ])

    await PlatformAdminService.set_tenant_active(db, tenant.id, False, make_admin())
    assert db.of_type(AuditLog) == []


async def test_delete_is_soft_and_cancels_subscriptions():
    """History must survive — a hard delete would cascade ~100 tables."""
    tenant = make_tenant(active=True)
    sub = Subscription(
        id=uuid.uuid4(), tenant_id=tenant.id, plan_id=uuid.uuid4(),
        status="ACTIVE", starts_at=datetime.now(timezone.utc),
        amount=Decimal("100"), currency="INR",
    )
    db = FakeDB([Result(scalar=tenant), Result(scalars=[sub])])

    await PlatformAdminService.delete_tenant(db, tenant.id, make_admin())

    assert tenant.is_active is False       # deactivated, not removed
    assert sub.status == "CANCELLED"
    assert db.of_type(AuditLog)[0].action == "TENANT_DELETED"


async def test_unknown_tenant_is_404():
    db = FakeDB([Result(scalar=None)])
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.tenant_detail(db, uuid.uuid4())
    assert exc.value.status_code == 404


# ── C-SA-05 — plans ──────────────────────────────────────────────────────────

async def test_plan_with_unknown_module_is_refused():
    db = FakeDB([
        Result(scalar=None),                                   # slug free
        Result(rows=[("attendance",), ("library",)]),          # known keys
    ])
    payload = PlanCreate(
        name="Bad Plan", slug="bad", maxStudents=10, maxTeachers=2,
        priceMonthly=1, priceYearly=2, allowedModules=["teleportation"],
    )
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.create_plan(db, payload, make_admin())
    assert exc.value.status_code == 400
    assert "teleportation" in exc.value.detail


async def test_duplicate_plan_slug_is_refused():
    db = FakeDB([Result(scalar=uuid.uuid4())])
    payload = PlanCreate(
        name="Dup", slug="standard", maxStudents=10, maxTeachers=2,
        priceMonthly=1, priceYearly=2,
    )
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.create_plan(db, payload, make_admin())
    assert exc.value.status_code == 409


async def test_create_plan_audits():
    db = FakeDB([
        Result(scalar=None),
        Result(rows=[("attendance",)]),
    ])
    payload = PlanCreate(
        name="Premium", slug="premium", maxStudents=-1, maxTeachers=-1,
        priceMonthly=24999, priceYearly=249990, allowedModules=["attendance"],
    )
    row = await PlatformAdminService.create_plan(db, payload, make_admin())

    assert row.slug == "premium"
    assert row.max_students == -1          # -1 = unlimited (§4.1)
    assert db.of_type(AuditLog)[0].action == "PLAN_CREATED"


# ── C-SA-06 — platform users ─────────────────────────────────────────────────

async def test_cannot_deactivate_your_own_account():
    admin = make_admin()
    db = FakeDB([Result(scalar=admin)])
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.update_platform_user(
            db, admin.id, PlatformUserUpdate(isActive=False), admin
        )
    assert exc.value.status_code == 400
    assert "your own account" in exc.value.detail


async def test_cannot_remove_the_last_super_admin():
    """Locking the console out of itself is unrecoverable without a DB edit."""
    target = make_admin()
    actor = make_admin()
    db = FakeDB([Result(scalar=target), Result(scalar=0)])  # no others remain

    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.update_platform_user(
            db, target.id, PlatformUserUpdate(isActive=False), actor
        )
    assert exc.value.status_code == 400
    assert "last active Super Admin" in exc.value.detail


async def test_can_deactivate_when_another_super_admin_remains():
    target = make_admin()
    actor = make_admin()
    db = FakeDB([Result(scalar=target), Result(scalar=1)])

    row = await PlatformAdminService.update_platform_user(
        db, target.id, PlatformUserUpdate(isActive=False), actor
    )
    assert row.is_active is False
    assert db.of_type(AuditLog)[0].action == "PLATFORM_USER_UPDATED"


async def test_owner_accounts_are_not_staff():
    owner = make_admin(PlatformRole.OWNER)
    db = FakeDB([Result(scalar=owner)])
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.update_platform_user(
            db, owner.id, PlatformUserUpdate(name="Nope"), make_admin()
        )
    assert exc.value.status_code == 400


async def test_duplicate_staff_email_is_refused():
    db = FakeDB([Result(scalar=uuid.uuid4())])
    payload = PlatformUserCreate(name="Rohit", email="rohit@xyz.com", role="SALES")
    with pytest.raises(HTTPException) as exc:
        await PlatformAdminService.create_platform_user(db, payload, make_admin())
    assert exc.value.status_code == 409


async def test_create_staff_queues_verification_email():
    db = FakeDB([Result(scalar=None)])
    payload = PlatformUserCreate(name="Rohit", email="Rohit@XYZ.com", role="SALES")

    row = await PlatformAdminService.create_platform_user(db, payload, make_admin())

    assert row.email == "rohit@xyz.com"
    assert db.of_type(OutboxEmail)[0].event == "platform_owner.verify_email"
    assert db.of_type(AuditLog)[0].action == "PLATFORM_USER_CREATED"


# ── C-SA-08 — settings ───────────────────────────────────────────────────────

async def test_settings_fall_back_to_defaults_when_unset():
    db = FakeDB([Result(scalars=[])])
    values = await PlatformAdminService._all_settings(db)
    assert values["product_name"] == "xyz.com"
    assert values["trial_length_days"] == "14"


async def test_update_settings_writes_rows_and_audits():
    from app.models.platform_setting import PlatformSetting

    saved: list[PlatformSetting] = []

    class Recording(FakeDB):
        def add(self, obj):
            if isinstance(obj, PlatformSetting):
                saved.append(obj)
            super().add(obj)

    db = Recording([
        Result(scalars=[]),               # _all_settings → before-values
        Result(scalars=[]),               # existing PlatformSetting rows
        Result(scalars=[]),               # get_settings_page → _all_settings
        Result(scalars=make_modules()),   # module master list
        Result(scalars=[]),               # trial-days lookup
    ])
    await PlatformAdminService.update_settings(
        db, PlatformSettingsUpdate(supportEmail="help@xyz.com", trialLengthDays=21),
        make_admin(),
    )

    # The response re-reads settings, and the fake cannot see rows it never
    # persisted — assert on what was written instead.
    written = {r.key: r.value for r in saved}
    assert written["support_email"] == "help@xyz.com"
    assert written["trial_length_days"] == "21"   # coerced to int, stored as text
    assert db.of_type(AuditLog)[0].action == "PLATFORM_SETTINGS_UPDATED"


async def test_empty_settings_patch_is_a_no_op():
    db = FakeDB([
        Result(scalars=[]),
        Result(scalars=make_modules()),
        Result(scalars=[]),
    ])
    await PlatformAdminService.update_settings(db, PlatformSettingsUpdate(), make_admin())
    assert db.of_type(AuditLog) == []


# ── Derived values ───────────────────────────────────────────────────────────

def test_billing_cycle_is_derived_from_period_length():
    """types/platform.ts: derived, never stored, so it cannot disagree."""
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert _cycle(start, start + timedelta(days=30)) == "MONTHLY"
    assert _cycle(start, start + timedelta(days=365)) == "YEARLY"
    assert _cycle(start, None) == "MONTHLY"   # open-ended trial


# ── Audit trail ──────────────────────────────────────────────────────────────

def test_audit_record_joins_the_callers_transaction():
    """No commit here: the action and its trail entry must land together."""
    from app.services.audit_service import AuditService

    db = FakeDB([])
    AuditService.record(
        db, actor=make_admin(), actor_role="SUPER_ADMIN",
        action="TENANT_CREATED", entity="tenant", entity_id=uuid.uuid4(),
    )
    assert len(db.of_type(AuditLog)) == 1
    assert db.committed is False


def test_audit_target_prefers_a_human_label():
    from app.services.audit_service import _target

    row = AuditLog(
        id=uuid.uuid4(), user_id=uuid.uuid4(), user_role="SUPER_ADMIN",
        action="TENANT_CREATED", entity="tenant", entity_id=uuid.uuid4(),
        new_value={"name": "Green College", "slug": "green"},
    )
    assert _target(row) == "Green College"

    bare = AuditLog(
        id=uuid.uuid4(), user_id=uuid.uuid4(), user_role="SUPER_ADMIN",
        action="X", entity="thing", entity_id=None,
    )
    assert _target(bare) == "thing"


# ── Wire contract ────────────────────────────────────────────────────────────
# The TypeScript clients (`fontend/types/platform.ts`, `types/owner.ts`) declare
# camelCase. A snake_case payload does not fail — it reads as `undefined` and
# renders blank fields, which is exactly how the Owner console shipped broken.
# These lock the contract for both consoles.

def test_every_client_facing_schema_serialises_camel_case():
    from app.schemas.common import Wire
    from app.schemas import owner as owner_schemas
    from app.schemas import platform_admin as admin_schemas

    def offenders(module, names):
        bad = []
        for name in names:
            model = getattr(module, name)
            for field in model.model_fields:
                if "_" not in field:
                    continue
                if not issubclass(model, Wire):
                    bad.append(f"{name}.{field}")
        return bad

    admin_models = [
        "TenantRow", "TenantDetail", "PlanRow", "PlatformUserRow",
        "AuditEntry", "AuditPage", "PlatformStats", "PlatformSettingsOut",
        "SubscriptionRow", "TenantCreated",
    ]
    owner_models = [
        "OwnerInfo", "OwnerSignupResponse", "OwnerLoginResponse", "TokenResponse",
        "OwnerInstitution", "BillingSummaryResponse", "OwnerSubscription",
        "OwnerInvoice", "OwnerPayment", "SupportTicketOut", "TicketMessageOut",
    ]

    assert offenders(admin_schemas, admin_models) == []
    assert offenders(owner_schemas, owner_models) == []


def test_owner_billing_summary_emits_camel_case():
    """Regression: this shipped as snake_case and rendered blank in the UI."""
    from decimal import Decimal

    from app.schemas.owner import BillingSummaryResponse

    payload = BillingSummaryResponse(
        total_institutions=2, active_subscriptions=1, trialing=1,
        next_renewal_at=None, lifetime_spend=Decimal("100"),
        currency="INR", outstanding=Decimal("0"),
    ).model_dump(by_alias=True)

    assert "totalInstitutions" in payload
    assert "total_institutions" not in payload


def test_wire_is_defined_once():
    """Both schema modules must share one Wire, not each roll their own."""
    from app.schemas.common import Wire
    from app.schemas.owner import OwnerInfo
    from app.schemas.platform_admin import TenantRow

    assert issubclass(TenantRow, Wire)
    assert issubclass(OwnerInfo, Wire)
