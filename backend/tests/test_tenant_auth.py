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


@pytest.mark.asyncio
async def test_tenant_reset_password_has_rate_limit():
    import inspect
    from app.routers.tenant.auth import tenant_reset_password

    # Check that rate limit decorator was applied to tenant_reset_password
    source = inspect.getsource(tenant_reset_password)
    assert '@limiter.limit("10/hour")' in source
