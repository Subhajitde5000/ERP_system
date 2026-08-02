"""
Tests — institution admin API (dashboard, structure, people, modules).

Service-level tests use scripted fake sessions (same pattern as
test_signup_flow.py); router-level tests confirm the admin guard rejects
unauthenticated requests.
"""

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app


class ScriptedResult:
    def __init__(self, scalar=None, scalars=None, rows=None):
        self._scalar = scalar
        self._scalars = scalars or []
        self._rows = rows or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar(self):
        return self._scalar

    def all(self):
        return self._rows if self._rows else self._scalars

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
        obj.id = obj.id or uuid.uuid4()
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def delete(self, obj):
        pass


_STATE: dict = {"db": None}


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        yield _STATE["db"]

    _STATE["db"] = None
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Service-level ────────────────────────────────────────────────────────────

async def test_create_year_success():
    from app.schemas.institution import AcademicYearCreate
    from app.services.institution_service import InstitutionService

    db = FakeDB([])  # is_current=False → no existing-year lookup
    tid = uuid.uuid4()
    out = await InstitutionService.create_year(db, tid, AcademicYearCreate(
        name="2026-27", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31), is_current=False,
    ))
    assert out.name == "2026-27"
    assert out.is_current is False
    from app.models.academic import AcademicYear
    assert any(isinstance(o, AcademicYear) for o in db.added)


async def test_create_year_rejects_inverted_dates():
    from fastapi import HTTPException
    from app.schemas.institution import AcademicYearCreate
    from app.services.institution_service import InstitutionService

    db = FakeDB([])
    with pytest.raises(HTTPException) as exc:
        await InstitutionService.create_year(db, uuid.uuid4(), AcademicYearCreate(
            name="Bad", start_date=date(2027, 1, 1), end_date=date(2026, 1, 1),
        ))
    assert exc.value.status_code == 422


async def test_toggle_module_blocks_non_plan_module():
    """Enabling an optional module not in the plan → 402 Payment Required."""
    from fastapi import HTTPException
    from app.models.catalog import Module, Plan
    from app.models.tenant import Tenant, TenantType
    from app.services.institution_service import InstitutionService

    tenant = Tenant(id=uuid.uuid4(), name="T", slug="t", type=TenantType.COLLEGE, plan_id=uuid.uuid4())
    module = Module(key="hostel", name="Hostel", is_core=False, sort_order=1)
    plan = Plan(name="Starter", slug="starter", allowed_modules=[])  # hostel not allowed
    db = FakeDB([ScriptedResult(scalar=module), ScriptedResult(scalar=plan)])
    with pytest.raises(HTTPException) as exc:
        await InstitutionService.toggle_module(db, tenant, "hostel", True)
    assert exc.value.status_code == 402


async def test_toggle_module_refuses_disabling_core():
    from fastapi import HTTPException
    from app.models.catalog import Module
    from app.models.tenant import Tenant, TenantType
    from app.services.institution_service import InstitutionService

    tenant = Tenant(id=uuid.uuid4(), name="T", slug="t", type=TenantType.COLLEGE)
    module = Module(key="attendance", name="Attendance", is_core=True, sort_order=1)
    db = FakeDB([ScriptedResult(scalar=module)])
    with pytest.raises(HTTPException) as exc:
        await InstitutionService.toggle_module(db, tenant, "attendance", False)
    assert exc.value.status_code == 409


# ── Router-level (auth guard) ────────────────────────────────────────────────

async def test_dashboard_requires_auth(client):
    _STATE["db"] = FakeDB([])
    res = await client.get("/api/v1/institution/dashboard")
    assert res.status_code == 401


async def test_departments_requires_auth(client):
    _STATE["db"] = FakeDB([])
    res = await client.get("/api/v1/institution/departments")
    assert res.status_code == 401


async def test_toggle_module_requires_auth(client):
    _STATE["db"] = FakeDB([])
    res = await client.put("/api/v1/institution/modules/hostel", json={"enabled": True})
    assert res.status_code == 401
