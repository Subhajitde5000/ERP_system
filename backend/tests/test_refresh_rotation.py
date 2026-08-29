"""
Tests — Refresh-token rotation & reuse detection (audit issue H6).

Real end-to-end against embedded Postgres: login → refresh (token rotates) →
old token dead → replaying the old token revokes the WHOLE session family.
Covers tenant users and platform staff.
"""

import asyncio
import pathlib
import tempfile
import uuid

import pytest
import pytest_asyncio

pgserver = pytest.importorskip("pgserver")

import app.models  # noqa: F401,E402  (register models on Base.metadata)
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.catalog import Plan  # noqa: E402
from app.models.platform_user import PlatformRole, PlatformUser  # noqa: E402
from app.models.role import Role, RoleAssignment, ScopeLevel  # noqa: E402
from app.models.tenant import Tenant, TenantType  # noqa: E402
from app.models.user import User  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

SLUG = "rotateville"
TEACHER_EMAIL = "rita@rotateville.edu"
TEACHER_PASSWORD = "Teach@12345"
PLATFORM_EMAIL = "root@rotateville.edu"
PLATFORM_PASSWORD = "Platf0rm@12345"

TENANT_REFRESH = "/api/v1/tenant/auth/refresh"
PLATFORM_REFRESH = "/api/v1/platform/auth/refresh"


@pytest_asyncio.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="module")
async def backend():
    """Embedded Postgres + schema + one tenant teacher + one platform admin."""
    srv = pgserver.get_server(pathlib.Path(tempfile.mkdtemp()), cleanup_mode="stop")
    srv.ensure_postgres_running()
    async_uri = srv.get_uri().replace("postgresql://", "postgresql+asyncpg://")
    boot_engine = create_async_engine(async_uri)
    async with boot_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    BootSession = async_sessionmaker(boot_engine, expire_on_commit=False)
    async with BootSession() as s:
        plan = Plan(
            id=uuid.uuid4(), name="Professional", slug=f"professional-{SLUG}",
            max_students=5000, max_teachers=500, max_storage_gb=200,
            price_monthly=7999, price_yearly=79990, currency="INR",
            allowed_modules=[], is_active=True,
        )
        s.add(plan)
        teacher_role = Role(
            id=uuid.uuid4(), name="TEACHER", label="Teacher",
            scope_level=ScopeLevel.INSTITUTION, is_platform=False, is_optional=False,
        )
        s.add(teacher_role)
        await s.flush()

        tenant = Tenant(
            id=uuid.uuid4(), name="Rotateville College", slug=SLUG,
            type=TenantType.COLLEGE, plan_id=plan.id, is_active=True,
            country="India", timezone="Asia/Kolkata",
        )
        s.add(tenant)
        await s.flush()

        teacher = User(
            id=uuid.uuid4(), tenant_id=tenant.id, name="Rita Rao",
            email=TEACHER_EMAIL, password_hash=hash_password(TEACHER_PASSWORD),
            is_active=True,
        )
        s.add(teacher)
        await s.flush()
        s.add(RoleAssignment(id=uuid.uuid4(), user_id=teacher.id,
                             role_id=teacher_role.id, tenant_id=tenant.id))

        platform_user = PlatformUser(
            id=uuid.uuid4(), name="Root", email=PLATFORM_EMAIL,
            password_hash=hash_password(PLATFORM_PASSWORD),
            platform_role=PlatformRole.SUPER_ADMIN, is_active=True,
        )
        s.add(platform_user)
        await s.commit()

    # RLS (H3): login/refresh are pre-auth bypass paths — enforce policies to
    # prove they still work when Postgres genuinely checks every row.
    from tests.conftest import enable_rls_enforcement

    app_uri = await enable_rls_enforcement(srv.get_uri())
    await boot_engine.dispose()
    engine = create_async_engine(
        app_uri.replace("postgresql://", "postgresql+asyncpg://")
    )
    Session = async_sessionmaker(engine, expire_on_commit=False)

    # Point the app's get_db at this database for the whole module.
    # Commit-per-request mirrors production get_db — refresh relies on the
    # login request having persisted its session row.
    async def override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


async def _tenant_login(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/tenant/auth/login", json={
        "slug": SLUG, "identifier": TEACHER_EMAIL, "password": TEACHER_PASSWORD,
    })
    assert res.status_code == 200, res.text
    return res.json()["data"]["tokens"]


async def _platform_login(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/platform/auth/login", json={
        "email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD,
    })
    assert res.status_code == 200, res.text
    return res.json()["data"]["tokens"]


# ── Tenant rotation ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tenant_refresh_rotates_token(backend):
    """Refresh returns a NEW refresh token and kills the old one."""
    tokens = await _tenant_login(backend)
    old_refresh = tokens["refresh_token"]

    res = await backend.post(TENANT_REFRESH, json={"refresh_token": old_refresh})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["access_token"]
    assert data["refresh_token"], "refresh response must carry the rotated token"
    assert data["refresh_token"] != old_refresh

    # The pre-rotation token must now be dead.
    res2 = await backend.post(TENANT_REFRESH, json={"refresh_token": old_refresh})
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_tenant_refresh_reuse_revokes_family(backend):
    """Replaying a revoked token revokes every session of the user (H6 kill switch)."""
    tokens = await _tenant_login(backend)
    stolen = tokens["refresh_token"]

    # Legitimate client rotates first…
    res = await backend.post(TENANT_REFRESH, json={"refresh_token": stolen})
    assert res.status_code == 200
    fresh = res.json()["data"]["refresh_token"]

    # …attacker replays the stolen (now revoked) token → reuse detected.
    res2 = await backend.post(TENANT_REFRESH, json={"refresh_token": stolen})
    assert res2.status_code == 401

    # The whole family is revoked: even the legitimate fresh token is dead.
    res3 = await backend.post(TENANT_REFRESH, json={"refresh_token": fresh})
    assert res3.status_code == 401

    # The user can simply log in again to recover.
    tokens2 = await _tenant_login(backend)
    assert tokens2["refresh_token"]


@pytest.mark.asyncio
async def test_tenant_refresh_invalid_token(backend):
    res = await backend.post(TENANT_REFRESH, json={"refresh_token": "nonsense-token"})
    assert res.status_code == 401


# ── Platform rotation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_platform_refresh_rotates_token(backend):
    tokens = await _platform_login(backend)
    old_refresh = tokens["refresh_token"]

    res = await backend.post(PLATFORM_REFRESH, json={"refresh_token": old_refresh})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["refresh_token"] and data["refresh_token"] != old_refresh

    res2 = await backend.post(PLATFORM_REFRESH, json={"refresh_token": old_refresh})
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_platform_refresh_reuse_revokes_family(backend):
    tokens = await _platform_login(backend)
    stolen = tokens["refresh_token"]

    fresh = (await backend.post(PLATFORM_REFRESH, json={"refresh_token": stolen})).json()
    fresh_token = fresh["data"]["refresh_token"]

    # Replay of the revoked token → family kill.
    res2 = await backend.post(PLATFORM_REFRESH, json={"refresh_token": stolen})
    assert res2.status_code == 401
    res3 = await backend.post(PLATFORM_REFRESH, json={"refresh_token": fresh_token})
    assert res3.status_code == 401
