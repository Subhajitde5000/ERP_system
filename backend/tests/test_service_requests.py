"""Tests for the public consultation request endpoint."""

from datetime import datetime, timezone
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app


class InMemorySession:
    """Small unit-test double for the write path; no production DB is mocked."""

    def __init__(self) -> None:
        self.item = None

    def add(self, item) -> None:
        self.item = item

    async def flush(self) -> None:
        assert self.item is not None
        self.item.id = uuid.uuid4()
        self.item.created_at = datetime.now(timezone.utc)

    async def refresh(self, item) -> None:
        return None


@pytest.mark.asyncio
async def test_public_service_request_is_stored():
    session = InMemorySession()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.post(
                "/api/v1/public/service-requests",
                json={
                    "contact_name": "Aisha Rahman",
                    "institution_name": "Northstar Academy",
                    "work_email": "AISHA@EXAMPLE.EDU",
                    "institution_type": "SCHOOL",
                    "service_interest": "FULL_PLATFORM",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["success"] is True
    assert session.item is not None
    assert session.item.work_email == "aisha@example.edu"


@pytest.mark.asyncio
async def test_public_service_request_rejects_unexpected_fields(client):
    response = await client.post(
        "/api/v1/public/service-requests",
        json={
            "contact_name": "Aisha Rahman",
            "institution_name": "Northstar Academy",
            "work_email": "aisha@example.edu",
            "institution_type": "SCHOOL",
            "service_interest": "FULL_PLATFORM",
            "tenant_id": "must-not-be-accepted",
        },
    )

    assert response.status_code == 422
