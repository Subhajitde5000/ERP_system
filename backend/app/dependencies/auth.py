"""
Dependencies — Auth & Security Dependencies

Provides FastAPI Depends handlers for protecting routes:
- get_current_platform_user: verifies Platform JWT token & returns PlatformUser
- get_current_tenant_user: verifies Tenant JWT token & returns User
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.platform_user import PlatformUser
from app.models.user import User
from app.services.jwt_service import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/tenant/auth/login")


async def get_current_platform_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PlatformUser:
    """Dependency to extract & validate a Platform User from a JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate platform credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")

        if not user_id or token_type != "platform":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(PlatformUser).where(PlatformUser.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_tenant_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Dependency to extract & validate a Tenant User from a JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate tenant user credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub", "")
        tenant_id: str = payload.get("tenant_id", "")
        token_type: str = payload.get("type", "")

        if not user_id or not tenant_id or token_type != "tenant":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(User).where(
        User.id == user_id,
        User.tenant_id == tenant_id,
        User.deleted_at == None,
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user
