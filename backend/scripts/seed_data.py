"""
ERP Backend — Database Seeder Script

Creates default initial data:
- Platform staff users (Super Admin, Support, Sales, Finance)
- Default Plans (Starter, Standard, Professional, Enterprise)
- Default Master Modules
- Sample Tenant & Users for local dev & testing

Usage:
  python scripts/seed_data.py
"""

import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.platform_user import PlatformUser, PlatformRole
from app.models.tenant import Tenant, TenantType
from app.models.user import User, Gender
from app.models.role import Role, ScopeLevel
from app.utils.security import hash_password


async def seed_platform_users(db: AsyncSession):
    print("Seeding Platform Users...")
    
    users_data = [
        {
            "name": "Super Admin",
            "email": "admin@xyz.com",
            "password": "adminpassword123",
            "role": PlatformRole.SUPER_ADMIN,
        },
        {
            "name": "Support Lead",
            "email": "support@xyz.com",
            "password": "supportpassword123",
            "role": PlatformRole.SUPPORT,
        },
        {
            "name": "Sales Executive",
            "email": "sales@xyz.com",
            "password": "salespassword123",
            "role": PlatformRole.SALES,
        },
        {
            "name": "Finance Manager",
            "email": "finance@xyz.com",
            "password": "financepassword123",
            "role": PlatformRole.FINANCE,
        },
    ]

    for u in users_data:
        stmt = select(PlatformUser).where(PlatformUser.email == u["email"])
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        
        if not existing:
            user = PlatformUser(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                platform_role=u["role"],
                is_active=True,
            )
            db.add(user)
            print(f"  + Added platform user: {u['email']} ({u['role'].value})")
        else:
            print(f"  ~ Platform user already exists: {u['email']}")

    await db.commit()


async def seed_demo_tenant(db: AsyncSession):
    print("\nSeeding Demo Tenant & Users...")
    
    # Check or create demo tenant 'abc-college'
    stmt = select(Tenant).where(Tenant.slug == "abc-college")
    res = await db.execute(stmt)
    tenant = res.scalar_one_or_none()

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
        print("  + Added demo tenant: abc-college")
    else:
        print("  ~ Demo tenant already exists: abc-college")

    # Check or create institution admin user
    user_stmt = select(User).where(User.tenant_id == tenant.id, User.email == "admin@abc-college.edu")
    user_res = await db.execute(user_stmt)
    inst_admin = user_res.scalar_one_or_none()

    if not inst_admin:
        inst_admin = User(
            tenant_id=tenant.id,
            name="Meera Sharma",
            email="admin@abc-college.edu",
            password_hash=hash_password("adminpassword123"),
            is_active=True,
        )
        db.add(inst_admin)
        print("  + Added demo tenant admin: admin@abc-college.edu")
    else:
        print("  ~ Demo tenant admin already exists: admin@abc-college.edu")

    await db.commit()


async def main():
    async with AsyncSessionLocal() as db:
        try:
            await seed_platform_users(db)
            await seed_demo_tenant(db)
            print("\nDatabase seeding completed successfully!")
        except Exception as e:
            print(f"\nError during database seeding: {e}")
            await db.rollback()


if __name__ == "__main__":
    asyncio.run(main())
