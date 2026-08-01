"""
Tests — Tenant Auth Endpoints
"""

import pytest


@pytest.mark.asyncio
async def test_tenant_login_nonexistent_slug(client):
    res = await client.post(
        "/api/v1/tenant/auth/login",
        json={
            "slug": "invalid-tenant-slug",
            "identifier": "user@school.com",
            "password": "password123",
        },
    )
    assert res.status_code == 404
