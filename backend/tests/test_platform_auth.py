import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.platform_user import PlatformRole, PlatformUser
from app.services.auth_service import AuthService
from app.utils.security import hash_password, verify_password


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


@pytest.mark.asyncio
async def test_update_platform_profile():
    db = AsyncMock()
    user = PlatformUser(
        id=uuid.uuid4(),
        name="Vikram Admin",
        email="vikram@xyz.com",
        password_hash=hash_password("SuperPass123!"),
        platform_role=PlatformRole.SUPER_ADMIN,
        is_active=True,
    )
    res = await AuthService.update_platform_profile(db, user, "Vikram Malhotra")
    assert res.name == "Vikram Malhotra"
    assert user.name == "Vikram Malhotra"
    db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_change_platform_password():
    db = AsyncMock()
    pw_hash = hash_password("OldPassword123!")
    user = PlatformUser(
        id=uuid.uuid4(),
        name="Vikram Admin",
        email="vikram@xyz.com",
        password_hash=pw_hash,
        platform_role=PlatformRole.SUPER_ADMIN,
        is_active=True,
    )
    # Incorrect password throws 400
    with pytest.raises(HTTPException) as exc:
        await AuthService.change_platform_password(db, user, "WrongPass!", "NewPassword123!")
    assert exc.value.status_code == 400

    # Correct password succeeds and updates hash
    await AuthService.change_platform_password(db, user, "OldPassword123!", "NewPassword123!")
    assert verify_password("NewPassword123!", user.password_hash)
    db.execute.assert_called_once()
