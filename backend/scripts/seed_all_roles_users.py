"""
ERP Backend — Seed 1 User for Every Role in DB
"""

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.platform_user import PlatformUser, PlatformRole
from app.models.role import Role, RoleAssignment
from app.models.tenant import Tenant, TenantType
from app.models.user import User
from app.utils.security import hash_password

DEFAULT_PASSWORD = "Password123!"

PLATFORM_USERS_DATA = [
    {"name": "Super Admin User", "email": "superadmin@xyz.com", "role": PlatformRole.SUPER_ADMIN},
    {"name": "Support Staff User", "email": "support@xyz.com", "role": PlatformRole.SUPPORT},
    {"name": "Sales Executive User", "email": "sales@xyz.com", "role": PlatformRole.SALES},
    {"name": "Finance Manager User", "email": "finance@xyz.com", "role": PlatformRole.FINANCE},
    {"name": "Platform Owner User", "email": "owner@xyz.com", "role": PlatformRole.OWNER},
]

async def seed_platform_users(db: AsyncSession):
    print("Creating/Updating Platform Users...")
    pw_hash = hash_password(DEFAULT_PASSWORD)
    created_list = []
    
    for u_data in PLATFORM_USERS_DATA:
        stmt = select(PlatformUser).where(PlatformUser.email == u_data["email"])
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            user = PlatformUser(
                id=uuid.uuid4(),
                name=u_data["name"],
                email=u_data["email"],
                password_hash=pw_hash,
                platform_role=u_data["role"],
                is_active=True
            )
            db.add(user)
            created_list.append((u_data["role"].value, u_data["email"], DEFAULT_PASSWORD, "Platform"))
            print(f"  + Added platform user: {u_data['email']} ({u_data['role'].value})")
        else:
            existing.password_hash = pw_hash
            existing.is_active = True
            created_list.append((u_data["role"].value, u_data["email"], DEFAULT_PASSWORD, "Platform (Updated PW)"))
            print(f"  ~ Updated platform user: {u_data['email']}")
            
    await db.commit()
    return created_list

async def seed_tenant_role_users(db: AsyncSession):
    print("\nCreating/Updating Institution Users for All Roles...")
    pw_hash = hash_password(DEFAULT_PASSWORD)
    
    # 1. Get or create demo tenant
    stmt = select(Tenant).where(Tenant.slug == "abc-college")
    tenant = (await db.execute(stmt)).scalar_one_or_none()
    if not tenant:
        tenant = Tenant(
            id=uuid.uuid4(),
            name="ABC Engineering College",
            slug="abc-college",
            type=TenantType.COLLEGE,
            email="admin@abc-college.edu",
            is_active=True,
        )
        db.add(tenant)
        await db.flush()
        print("  + Created demo tenant: abc-college")
        
    # 2. Get all roles from DB
    stmt_roles = select(Role)
    all_roles = (await db.execute(stmt_roles)).scalars().all()
    
    created_institution_users = []
    
    for role in all_roles:
        role_slug = role.name.lower()
        email = f"{role_slug}@abc-college.edu"
        student_roll = f"ROLL_{role_slug.upper()}" if role.name == "STUDENT" else None
        
        # Find existing user by email or tenant
        u_stmt = select(User).where(User.tenant_id == tenant.id, User.email == email)
        user = (await db.execute(u_stmt)).scalar_one_or_none()
        
        if not user:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name=f"Test {role.label}",
                email=email,
                student_roll_no=student_roll,
                password_hash=pw_hash,
                is_active=True,
            )
            db.add(user)
            await db.flush()
            print(f"  + Added tenant user: {email} for role {role.name}")
        else:
            user.password_hash = pw_hash
            user.is_active = True
            await db.flush()
            print(f"  ~ Updated tenant user: {email} for role {role.name}")
            
        # Ensure RoleAssignment exists
        ra_stmt = select(RoleAssignment).where(
            RoleAssignment.user_id == user.id,
            RoleAssignment.role_id == role.id,
            RoleAssignment.tenant_id == tenant.id
        )
        ra = (await db.execute(ra_stmt)).scalar_one_or_none()
        if not ra:
            ra = RoleAssignment(
                id=uuid.uuid4(),
                user_id=user.id,
                role_id=role.id,
                tenant_id=tenant.id,
                is_active=True
            )
            db.add(ra)
            print(f"    -> Assigned role {role.name} to {email}")
            
        created_institution_users.append((role.name, role.label, email, DEFAULT_PASSWORD, tenant.slug))
        
    await db.commit()
    return created_institution_users

async def main():
    async with AsyncSessionLocal() as db:
        platform_users = await seed_platform_users(db)
        tenant_users = await seed_tenant_role_users(db)
        
        print("\n" + "="*80)
        print("SUMMARY OF CREATED TEST USERS & LOGINS")
        print("="*80)
        print("\n--- PLATFORM USERS (Login at /api/v1/platform/auth/login) ---")
        for role, email, password, type_str in platform_users:
            print(f"Role: {role:<20} Email: {email:<25} Password: {password}")
            
        print("\n--- INSTITUTION USERS (Tenant: abc-college | Login at /api/v1/tenant/auth/login) ---")
        for role_name, label, email, password, slug in tenant_users:
            print(f"Role: {role_name:<22} ({label:<22}) Email: {email:<30} Password: {password}")
            
        print("="*80)

if __name__ == "__main__":
    asyncio.run(main())
