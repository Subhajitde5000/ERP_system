"""
Tests — public signup: quote → order → pay → automatic provisioning

The FastAPI app is exercised through ASGI with a scripted fake DB session
(following tests/conftest.py's mock pattern). The fake returns rows per
statement entity in a deterministic order, which is enough to verify the
pipeline's sequencing, the gapless invoice number, the tenant/admin/module
writes, and the queued welcome email.

Order of `execute` calls inside provision():
  1. select(Order)                     → the order being paid
  2. select(Plan)  (slug)              → the purchased plan
  3. select max(platform_invoices.invoice_number) → next invoice number
  4. select(Plan)  (id)                → plan for the invoice line
  5. select(Role)                      → INSTITUTION_ADMIN + ACCOUNTANT
  6. select(Module)                    → the 16-module catalogue
"""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models.catalog import Module, Plan
from app.models.role import Role, ScopeLevel


class ScriptedResult:
    """Mimics a SQLAlchemy result for the shapes the service uses."""

    def __init__(self, scalar=None, scalars=None, scalar_one=None):
        self._scalar = scalar
        self._scalars = scalars if scalars is not None else []
        self._scalar_one = scalar_one

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        if self._scalar is None:
            raise AssertionError("scalar_one() on empty result")
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._scalars

    def first(self):
        return self._scalar_one

    def scalars(self):
        return MagicMock(all=lambda: self._scalars)


def make_plan(slug="professional", name="Professional", price=Decimal("7999.00")):
    return Plan(
        id=uuid.uuid4(), name=name, slug=slug,
        max_students=5000, max_teachers=500, max_storage_gb=200,
        price_monthly=price, price_yearly=Decimal("79990.00"),
        currency="INR", allowed_modules=[
            "attendance", "examination", "assignment", "notice",
            "discussion", "content", "results", "timetable",
            "library", "hostel", "transport", "placement", "hr", "finance",
        ],
        is_active=True,
    )


def make_modules():
    cores = ["attendance", "examination", "assignment", "notice",
             "discussion", "content", "results", "timetable"]
    optional = [
        ("library", 1500), ("hostel", 2000), ("transport", 1500),
        ("placement", 1500), ("hr", 2000), ("admission", 1500),
        ("inventory", 1500), ("finance", 2000),
    ]
    modules = []
    for i, key in enumerate(cores):
        modules.append(Module(key=key, name=key.title(), is_core=True, sort_order=i + 1, price_monthly=Decimal("0")))
    for i, (key, price) in enumerate(optional):
        modules.append(Module(key=key, name=key.title(), is_core=False, sort_order=10 + i, price_monthly=Decimal(price)))
    return modules


def make_roles():
    return [
        Role(name="INSTITUTION_ADMIN", label="Institution Admin", scope_level=ScopeLevel.INSTITUTION),
        Role(name="ACCOUNTANT", label="Accountant", scope_level=ScopeLevel.INSTITUTION, is_optional=True, module_key="finance"),
    ]


def make_order(mode="PURCHASE", slug="green", plan="professional", module_keys=None, total=Decimal("7999.00")):
    from app.models.billing import Order
    return Order(
        id=uuid.uuid4(), mode=mode, plan_slug=plan,
        module_keys=module_keys or [],
        billing_cycle="MONTHLY", subtotal=total, discount=Decimal("0"),
        total=total, currency="INR", institution_name="Green College",
        institution_type="COLLEGE", contact_email="admin@green.edu",
        url_slug=slug, password_hash="x", status="PENDING",
    )


class FakeDB:
    """Scripted fake AsyncSession — results consumed per execute call."""

    def __init__(self, results: list):
        self.results = list(results)
        self.added: list = []
        self.flushed = 0
        self.committed = False
        self.execute = AsyncMock(side_effect=self._pop)

    async def _pop(self, stmt):
        if not self.results:
            raise AssertionError(f"Unexpected execute: {stmt}")
        return self.results.pop(0)

    def add(self, obj):
        # Real AsyncSession.add is synchronous — the fake must match.
        self.added.append(obj)

    async def flush(self):
        self.flushed += 1

    async def commit(self):
        self.committed = True

    async def rollback(self):
        pass

    async def refresh(self, obj):
        return obj

    def __aiter__(self):
        return iter(()).__aiter__()


# httpx's AsyncClient has no `.app` — the fixture db is stashed here instead.
_STATE: dict = {"db": None}


@pytest_asyncio.fixture
async def client():
    """Client with a replaceable fake db — assign `_STATE["db"]` first."""

    async def override_get_db():
        yield _STATE["db"]

    _STATE["db"] = None
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Quote engine ─────────────────────────────────────────────────────────────

async def test_quote_fixed_plan_with_addon_and_coupon():
    """Fixed plan + out-of-plan add-on + percent coupon = server total.

    Professional bundles library, hostel, transport, placement, hr and
    finance (database.sql §6.3), so of [library, hostel, inventory] only
    inventory is a paid add-on: 7999 + 1500 = 9499, then −10%.
    """
    from app.models.billing import Coupon
    from app.services.signup_service import SignupService

    plan = make_plan()
    coupon = Coupon(
        code="WELCOME10", discount_type="PERCENT", value=Decimal("10"),
        is_active=True, max_uses=0,
    )
    db = FakeDB([
        ScriptedResult(scalar=plan),
        ScriptedResult(scalars=make_modules()),
        ScriptedResult(scalar=coupon),
    ])

    quote = await SignupService.quote(
        db, "PURCHASE", "professional", ["library", "hostel", "inventory"],
        "MONTHLY", "WELCOME10",
    )

    assert quote.subtotal == Decimal("9499.00")
    assert quote.discount == Decimal("949.90")
    assert quote.total == Decimal("8549.10")
    assert quote.coupon is not None
    assert quote.coupon.code == "WELCOME10"
    assert quote.lines[0].label.startswith("Professional plan")
    # bundled modules do not appear as line items
    assert len(quote.lines) == 2


async def test_quote_included_modules_are_free():
    from app.services.signup_service import SignupService

    plan = make_plan()
    db = FakeDB([
        ScriptedResult(scalar=plan),
        ScriptedResult(scalars=make_modules()),
        ScriptedResult(scalar=None),
    ])
    quote = await SignupService.quote(
        db, "PURCHASE", "professional", ["library", "finance"], "MONTHLY", None
    )
    # library + finance are already bundled in Professional → no add-on lines
    assert quote.subtotal == Decimal("7999.00")
    assert quote.total == Decimal("7999.00")


async def test_quote_trial_is_free():
    from app.services.signup_service import SignupService

    db = FakeDB([])
    quote = await SignupService.quote(
        db, "TRIAL", "professional", [], "MONTHLY", None
    )
    assert quote.total == Decimal("0")
    assert quote.subtotal == Decimal("0")


# ── Order → payment → provisioning ───────────────────────────────────────────

async def test_provision_pipeline_creates_tenant_invoice_admin_email():
    from app.schemas.signup import OrderPayRequest
    from app.services.signup_service import SignupService

    order = make_order()
    plan = make_plan()
    db = FakeDB([
        ScriptedResult(scalar=order),   # provision_with_payment → _load_order
        ScriptedResult(scalar=order),   # provision → _load_order
        ScriptedResult(scalar=plan),    # get_plan
        ScriptedResult(scalar=None),    # max invoice number → first of year
        ScriptedResult(scalar=plan),    # invoice line plan
        ScriptedResult(scalars=make_roles()),
        ScriptedResult(scalars=make_modules()),
    ])

    result = await SignupService.provision_with_payment(
        db, order.id, OrderPayRequest(method="UPI", gateway_ref="pay_abc")
    )

    assert result.tenant.slug == "green"
    assert result.tenant.login_url == "https://green.xyz.com/login"
    assert result.invoice is not None
    assert result.invoice.number.startswith("INV-2026-")
    assert result.invoice.status == "PAID"
    assert result.subscription.status == "ACTIVE"
    assert result.admin_email == "admin@green.edu"
    assert "attendance" in result.enabled_modules
    assert result.welcome_email.status == "QUEUED"
    assert len(result.steps) == 11
    assert db.committed is True

    # The writes the pipeline performed
    from app.models.billing import (
        OutboxEmail, PlatformInvoice, PlatformInvoiceLine, PlatformPayment,
        Subscription, TenantModule, TenantSetting,
    )
    from app.models.academic import AcademicYear
    from app.models.role import RoleAssignment
    from app.models.tenant import Tenant
    from app.models.user import User

    types = {type(obj) for obj in db.added}
    assert Tenant in types
    assert Subscription in types
    assert PlatformInvoice in types
    assert PlatformInvoiceLine in types
    assert User in types
    assert RoleAssignment in types
    assert TenantModule in types
    assert TenantSetting in types
    assert AcademicYear in types
    assert OutboxEmail in types


async def test_provision_trial_skips_invoice():
    from app.schemas.signup import OrderPayRequest
    from app.services.signup_service import SignupService

    order = make_order(mode="TRIAL", total=Decimal("0"))
    plan = make_plan()
    db = FakeDB([
        ScriptedResult(scalar=order),   # provision_with_payment → _load_order
        ScriptedResult(scalar=order),   # provision → _load_order
        ScriptedResult(scalar=plan),
        ScriptedResult(scalars=make_roles()),
        ScriptedResult(scalars=make_modules()),
    ])

    result = await SignupService.provision_with_payment(
        db, order.id, OrderPayRequest(method="TRIAL")
    )

    assert result.mode == "TRIAL"
    assert result.invoice is None
    assert result.subscription.status == "TRIAL"
    assert result.subscription.trial_ends_at is not None
    assert result.tenant.login_url == "https://green.xyz.com/login"


async def test_pay_endpoint_provisions_and_returns_success(client):
    from app.models.billing import Order

    order = make_order()
    plan = make_plan()
    db = FakeDB([
        ScriptedResult(scalar=order),   # provision_with_payment → _load_order
        ScriptedResult(scalar=order),   # provision → _load_order
        ScriptedResult(scalar=plan),
        ScriptedResult(scalar=None),
        ScriptedResult(scalar=plan),
        ScriptedResult(scalars=make_roles()),
        ScriptedResult(scalars=make_modules()),
    ])
    _STATE["db"] = db

    res = await client.post(
        f"/api/v1/public/orders/{order.id}/pay",
        json={"method": "UPI", "gateway_ref": "pay_123"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["tenant"]["name"] == "Green College"
    assert data["tenant"]["login_url"] == "https://green.xyz.com/login"
    assert data["invoice"]["number"].startswith("INV-2026-")
    assert data["welcome_email"]["status"] == "QUEUED"

    # The payment row was recorded with the idempotency anchor
    from app.models.billing import PlatformPayment
    payments = [obj for obj in db.added if isinstance(obj, PlatformPayment)]
    assert len(payments) == 1
    assert payments[0].gateway_ref == "pay_123"
    assert order.status == "PAID"
