"""
Tests — platform owner (customer account) flow.

signup → verify-email → login → dashboard data → support ticket, exercised
through scripted fake sessions (same pattern as test_signup_flow.py).
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app


# ── Test doubles (compact copy of test_signup_flow's ScriptedResult/FakeDB) ──

class ScriptedResult:
    def __init__(self, scalar=None, scalars=None, scalar_one=None, rows=None):
        self._scalar = scalar
        self._scalars = scalars if scalars is not None else []
        self._scalar_one = scalar_one
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows if self._rows else self._scalars

    def first(self):
        return self._scalar_one

    def scalars(self):
        return MagicMock(all=lambda: self._scalars)


class FakeDB:
    def __init__(self, results):
        self.results = list(results)
        self.added = []
        self.execute = AsyncMock(side_effect=self._pop)

    async def _pop(self, stmt):
        if not self.results:
            raise AssertionError(f"Unexpected execute: {stmt}")
        return self.results.pop(0)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def rollback(self):
        pass


_STATE: dict = {"db": None}


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        yield _STATE["db"]

    _STATE["db"] = None
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Service-level ────────────────────────────────────────────────────────────

def _make_owner(verified=False):
    from app.models.platform_owner import PlatformOwner

    owner = PlatformOwner(
        id=uuid.uuid4(),
        name="Rahul Sharma",
        email="rahul@gmail.com",
        password_hash="$2b$12$" + "x" * 53,  # syntactically valid bcrypt stub
        is_email_verified=verified,
        is_active=True,
    )
    # created_at has a server default; set it so the schema serializes.
    owner.created_at = datetime.now(timezone.utc)
    return owner


async def test_signup_creates_unverified_owner_with_token(monkeypatch):
    from app.config import get_settings
    from app.services.owner_service import OwnerService

    # In dev / no-mailer mode the raw verification token is returned so the
    # flow can be completed end-to-end.
    monkeypatch.setattr(get_settings(), "APP_DEBUG", True)
    db = FakeDB([ScriptedResult(scalar=None)])  # no existing owner
    res = await OwnerService.signup(db, "Rahul Sharma", "rahul@gmail.com", "secret123")

    assert res.email == "rahul@gmail.com"
    assert res.is_email_verified is False
    assert res.verification_token  # returned in dev so the flow is completable

    from app.models.billing import OutboxEmail
    from app.models.platform_owner import PlatformOwner

    added_types = {type(o) for o in db.added}
    assert PlatformOwner in added_types
    assert OutboxEmail in added_types  # verification email queued


async def test_signup_production_omits_verification_token(monkeypatch):
    """In production the raw token is never returned — it goes only by email."""
    from app.config import get_settings
    from app.services.owner_service import OwnerService

    monkeypatch.setattr(get_settings(), "APP_DEBUG", False)
    db = FakeDB([ScriptedResult(scalar=None)])
    res = await OwnerService.signup(db, "Rahul", "x@y.com", "secret123")
    assert res.verification_token is None


async def test_signup_duplicate_email_conflicts():
    from fastapi import HTTPException
    from app.services.owner_service import OwnerService

    db = FakeDB([ScriptedResult(scalar=uuid.uuid4())])  # existing id
    with pytest.raises(HTTPException) as exc:
        await OwnerService.signup(db, "Rahul", "rahul@gmail.com", "secret123")
    assert exc.value.status_code == 409


async def test_verify_email_marks_verified_and_clears_token():
    from app.services.owner_service import OwnerService

    owner = _make_owner(verified=False)
    owner.email_verification_token = "hashed"
    owner.email_verification_expires = datetime.now(timezone.utc)
    db = FakeDB([ScriptedResult(scalar=owner)])
    info = await OwnerService.verify_email(db, "raw-token")
    assert info.is_email_verified is True
    assert owner.is_email_verified is True
    assert owner.email_verification_token is None


async def test_verify_email_invalid_token_raises():
    from fastapi import HTTPException
    from app.services.owner_service import OwnerService

    db = FakeDB([ScriptedResult(scalar=None)])
    with pytest.raises(HTTPException) as exc:
        await OwnerService.verify_email(db, "bad")
    assert exc.value.status_code == 400


async def test_login_unverified_is_blocked():
    from fastapi import HTTPException
    from app.services.owner_service import OwnerService

    owner = _make_owner(verified=False)
    # verify_password will run against the stub hash and return False, but the
    # unverified check fires first only when the password matches. Patch verify.
    import app.services.owner_service as svc

    db = FakeDB([ScriptedResult(scalar=owner)])
    original = svc.verify_password
    svc.verify_password = lambda *_a, **_k: True
    try:
        with pytest.raises(HTTPException) as exc:
            await OwnerService.login(db, "rahul@gmail.com", "secret123", _req())
        assert exc.value.status_code == 403
    finally:
        svc.verify_password = original


async def test_login_verified_issues_owner_token():
    from app.services.owner_service import OwnerService

    owner = _make_owner(verified=True)
    import app.services.owner_service as svc

    db = FakeDB([ScriptedResult(scalar=owner)])
    original = svc.verify_password
    svc.verify_password = lambda *_a, **_k: True
    try:
        res = await OwnerService.login(db, "rahul@gmail.com", "secret123", _req())
    finally:
        svc.verify_password = original

    assert res.owner.is_email_verified is True
    assert res.tokens.access_token
    # The token must be an owner token — decoded type is "owner".
    from app.services.jwt_service import decode_access_token

    assert decode_access_token(res.tokens.access_token)["type"] == "owner"


async def test_billing_summary_no_institutions_is_zero():
    from decimal import Decimal

    from app.services.owner_service import OwnerService

    owner = _make_owner(verified=True)
    db = FakeDB([ScriptedResult(scalars=[])])  # no tenants
    summary = await OwnerService.billing_summary(db, owner)
    assert summary.total_institutions == 0
    assert summary.active_subscriptions == 0
    assert summary.lifetime_spend == Decimal("0")
    assert summary.outstanding == Decimal("0")


async def test_create_and_list_ticket():
    from app.schemas.owner import TicketCreateRequest
    from app.services.owner_service import OwnerService

    owner = _make_owner(verified=True)
    # create_ticket: tenant_id None → no execute; then _ticket_out: no execute.
    db = FakeDB([])
    payload = TicketCreateRequest(
        subject="Billing question", category="BILLING", message="Help with my invoice"
    )
    ticket = await OwnerService.create_ticket(db, owner, payload)
    assert ticket.subject == "Billing question"
    assert ticket.category == "BILLING"
    assert ticket.status == "OPEN"

    from app.models.support_ticket import SupportTicketMessage

    assert any(isinstance(o, SupportTicketMessage) for o in db.added)


# ── Router-level (uses the conftest-style client with scripted db) ────────────

def _req():
    """A minimal stand-in for fastapi.Request used by the service login path."""
    req = MagicMock()
    req.headers = {"User-Agent": "test"}
    req.client = None
    return req


async def test_owner_signup_endpoint_returns_201(client):
    _STATE["db"] = FakeDB([ScriptedResult(scalar=None)])
    res = await client.post(
        "/api/v1/owner/signup",
        json={"name": "Rahul Sharma", "email": "rahul@gmail.com", "password": "secret123"},
    )
    assert res.status_code == 201, res.text
    body = res.json()["data"]
    assert body["email"] == "rahul@gmail.com"
    assert body["is_email_verified"] is False


async def test_owner_login_invalid_returns_401(client):
    # conftest-free: scripted db returns no owner → 401
    _STATE["db"] = FakeDB([ScriptedResult(scalar=None)])
    res = await client.post(
        "/api/v1/owner/login",
        json={"email": "nope@gmail.com", "password": "secret123"},
    )
    assert res.status_code == 401


async def test_owner_protected_route_requires_token(client):
    _STATE["db"] = FakeDB([])
    res = await client.get("/api/v1/owner/institutions")
    assert res.status_code == 401


async def test_owner_verify_email_bad_token_returns_400(client):
    _STATE["db"] = FakeDB([ScriptedResult(scalar=None)])
    res = await client.post(
        "/api/v1/owner/verify-email", json={"token": "garbage"}
    )
    assert res.status_code == 400
