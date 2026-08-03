"""
Dependencies — Auth & Security Dependencies

Provides FastAPI Depends handlers for protecting routes:
- get_current_platform_user: verifies Platform JWT token & returns PlatformUser
- get_current_tenant_user: verifies Tenant JWT token & returns User
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import or_, select
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


async def _require_current_tenant_roles(
    current_user: User,
    db: AsyncSession,
    allowed_roles: set[str],
    denial_message: str,
) -> User:
    """Resolve tenant roles from the database, not a stale JWT claim.

    A role grant may be revoked or have an expiry after an access token was
    issued.  Every privileged tenant dependency therefore shares this one
    query and honours both flags before allowing a request through.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(RoleAssignment.id)
        .join(Role, RoleAssignment.role_id == Role.id)
        .where(
            RoleAssignment.user_id == current_user.id,
            RoleAssignment.tenant_id == current_user.tenant_id,
            RoleAssignment.is_active.is_(True),
            or_(RoleAssignment.expires_at.is_(None), RoleAssignment.expires_at > now),
            Role.name.in_(allowed_roles),
        )
        .limit(1)
    )
    res = await db.execute(stmt)
    if res.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=denial_message)
    return current_user


async def get_current_tenant_user_admin(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live ``INSTITUTION_ADMIN`` assignment for this tenant."""
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"INSTITUTION_ADMIN"},
        "Institution admin privileges are required",
    )


async def get_current_tenant_user_principal(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live Principal assignment for the institution-wide console.

    The Vice Principal intentionally does not satisfy this guard: the role
    design explicitly withholds final schedule/result approval.  Its delegated
    read surface can be added as a separate, scoped dependency later without
    weakening the Principal approval boundary.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"PRINCIPAL"},
        "Principal privileges are required",
    )


async def get_current_tenant_user_vice_principal(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live Vice Principal role before resolving delegated scope.

    The route service then resolves department assignments separately and fails
    closed when the role has no active delegation. Keeping those checks apart
    makes the role check reusable while preserving the strict scope boundary.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"VICE_PRINCIPAL"},
        "Vice Principal privileges are required",
    )


async def get_current_tenant_user_hod(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live HOD role; department reach is resolved fail-closed later."""
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"HOD"},
        "HOD privileges are required",
    )


async def get_current_tenant_user_coordinator(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live ACADEMIC_COORDINATOR role; the C-AC console is institution-wide.

    §4.5 grants the coordinator a build grant on the timetable and the only
    ``canSubstitute`` permission.  Read access is separately given to HOD,
    Principal, Teacher and Student by the timetable permission matrix, but
    those roles do not satisfy this guard; they have their own consoles.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"ACADEMIC_COORDINATOR"},
        "Academic Coordinator privileges are required",
    )


async def get_current_tenant_user_teacher(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live teaching role; subject/class reach is resolved fail-closed later.

    §4.5 scopes a Teacher to *assigned classes and subjects only*, and that
    fence is a row-level question the role check cannot answer — it is applied
    by ``TeacherScopeService`` on every read and write.  MENTOR and HOD satisfy
    this guard because both are teaching staff who also carry ``teacher_subjects``
    rows; their reach is still exactly the subjects they are assigned to, so
    admitting them here widens nothing.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"TEACHER", "MENTOR", "HOD"},
        "Teacher privileges are required",
    )


async def get_current_tenant_user_student(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live STUDENT role; §4.9 scopes every read to the caller's own enrolment.

    No other role satisfies this guard.  A Teacher wanting a student's data
    uses the teacher console, which applies the subject fence; letting staff
    call the student endpoints would hand them an unscoped read of any learner
    who shares the tenant.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"STUDENT"},
        "Student privileges are required",
    )


async def get_current_tenant_user_exam_controller(
    current_user: Annotated[User, Depends(get_current_tenant_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Require a live EXAM_CONTROLLER role; the C-EC console is institution-wide.

    §4.6 grants the controller full authority over the examination module
    across all departments.  No department fence is applied here; the
    service queries filter on tenant and reach every class.
    """
    return await _require_current_tenant_roles(
        current_user,
        db,
        {"EXAM_CONTROLLER"},
        "Exam Controller privileges are required",
    )
