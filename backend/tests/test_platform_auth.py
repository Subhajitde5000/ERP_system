"""
Tests — Platform Auth Endpoints
"""

import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_platform_login_invalid_credentials(client):
    res = await client.post(
        "/api/v1/platform/auth/login",
        json={"email": "nonexistent@xyz.com", "password": "wrongpassword"},
    )
    assert res.status_code == 401
