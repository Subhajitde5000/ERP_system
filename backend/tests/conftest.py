import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from app.config import get_settings
from app.main import app
from app.database import get_db


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

