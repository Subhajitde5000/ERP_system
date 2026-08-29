import pathlib

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from app.config import get_settings
from app.main import app
from app.database import get_db

# ── Row-Level Security test enforcement (audit issue H3) ─────────────────────
# PostgreSQL superusers ALWAYS bypass RLS, and the embedded test server runs
# as one. To prove tenant isolation end-to-end, integration fixtures call
# enable_rls_enforcement() after seeding: it applies database/update_rls.sql
# and returns a connection URI for a NON-superuser app role, so every request
# in the suite is genuinely checked by Postgres.

_RLS_SQL = pathlib.Path(__file__).resolve().parents[2] / "database" / "update_rls.sql"
_APP_ROLE = "erp_app_test"
_APP_PASSWORD = "erp_app_test_pw"


async def enable_rls_enforcement(superuser_uri: str) -> str:
    """
    Apply ``database/update_rls.sql`` and provision the non-superuser role
    the app should run as. Returns the URI (asyncpg scheme) for that role.

    ``superuser_uri`` is the plain ``postgresql://`` URI from pgserver.
    """
    import asyncpg

    conn = await asyncpg.connect(superuser_uri)
    try:
        await conn.execute(
            "DO $$ BEGIN "
            f"IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{_APP_ROLE}') THEN "
            f"CREATE ROLE {_APP_ROLE} LOGIN PASSWORD '{_APP_PASSWORD}'; "
            "END IF; END $$;"
        )
        await conn.execute(f"GRANT USAGE ON SCHEMA public TO {_APP_ROLE}")
        await conn.execute(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO {_APP_ROLE}")
        await conn.execute(f"GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO {_APP_ROLE}")

        # Only the DO block matters here; the trailing verification SELECT is
        # for human psql sessions.
        rls_sql = _RLS_SQL.read_text().partition("-- Verification:")[0]
        await conn.execute(rls_sql)
    finally:
        await conn.close()

    return superuser_uri.replace(
        "postgresql://postgres:@",
        f"postgresql://{_APP_ROLE}:{_APP_PASSWORD}@",
    )


@pytest.fixture(autouse=True)
def force_console_mailer():
    """
    Never let the suite touch a real mail transport.

    Whatever a developer has in .env (google or klaviyo), tests always run on
    the console provider: no SMTP connection, no Klaviyo HTTP call, and a
    deterministic 'SENT' outcome. Restored afterwards so nothing leaks.
    """
    settings = get_settings()
    original = settings.EMAIL_PROVIDER
    settings.EMAIL_PROVIDER = "console"
    yield
    settings.EMAIL_PROVIDER = original


@pytest.fixture(autouse=True)
def force_test_public_domain():
    """
    Never let a developer's local .env (e.g. PUBLIC_ROOT_DOMAIN=localhost:3000)
    leak into the suite. Provisioned login URLs and subdomain checks must be
    asserted against the canonical production root domain.
    """
    settings = get_settings()
    original = settings.PUBLIC_ROOT_DOMAIN
    settings.PUBLIC_ROOT_DOMAIN = "xyz.com"
    yield
    settings.PUBLIC_ROOT_DOMAIN = original


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    """
    Keep rate limits from making the suite order-dependent.

    Every request in the suite comes from the same "testserver" IP, and the
    login endpoints are limited (e.g. 10/minute) — a test that adds one more
    login can push a later test over the limit and fail it for the wrong
    reason. Reset all slowapi limiters before and after each test.
    """
    import sys

    from slowapi.extension import Limiter

    def reset() -> None:
        for module in list(sys.modules.values()):
            limiter = getattr(module, "limiter", None)
            if isinstance(limiter, Limiter):
                limiter.reset()

    reset()
    yield
    reset()


@pytest_asyncio.fixture
async def client():
    mock_db = AsyncMock()
    # Mock execute result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    mock_result.all.return_value = []
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()

