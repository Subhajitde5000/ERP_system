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
from app.models.platform_owner import PlatformOwner
from app.models.role import Role, RoleAssignment
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


async def get_current_platform_owner(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PlatformOwner:
    """
    Dependency to extract & validate a Platform Owner (customer account) from a
    `type="owner"` JWT. This is the third login system: an owner token is not
    accepted by tenant or staff routes, and vice-versa.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate owner credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        owner_id: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")

        if not owner_id or token_type != "owner":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    stmt = select(PlatformOwner).where(PlatformOwner.id == owner_id)
    res = await db.execute(stmt)
    owner = res.scalar_one_or_none()

    if owner is None or not owner.is_active:
        raise credentials_exception

    return owner


async def get_current_tenant_user_admin(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Require an authenticated tenant user who holds the INSTITUTION_ADMIN role
    for their tenant. Used to guard every institution-management endpoint
    (structure, people, modules, settings, profile).

    RBAC is derived from role_assignments (not the JWT's role string) so an
    admin who was granted the role after login is still recognised, and a user
    whose grant was revoked is blocked even with a still-valid access token.
    """
    stmt = (
        select(RoleAssignment.id)
        .join(Role, RoleAssignment.role_id == Role.id)
        .where(
            RoleAssignment.user_id == current_user.id,
            RoleAssignment.tenant_id == current_user.tenant_id,
            RoleAssignment.is_active == True,  # noqa: E712
            Role.name == "INSTITUTION_ADMIN",
        )
    )
    res = await db.execute(stmt)
    if res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institution admin privileges are required",
        )
    return current_user
