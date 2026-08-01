"""
Create Super Admin User Script

Usage:
  python scripts/create_superadmin.py --email admin@xyz.com --password mysecretpassword --name "Super Admin"
"""

import argparse
import asyncio
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine, Base
from app.models.platform_user import PlatformUser, PlatformRole
from app.utils.security import hash_password


async def create_super_admin(email: str, password: str, name: str):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).where(PlatformUser.email == email)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            print(f"Updating existing Super Admin user: {email}")
            existing.name = name
            existing.password_hash = hash_password(password)
            existing.platform_role = PlatformRole.SUPER_ADMIN
            existing.is_active = True
        else:
            print(f"Creating new Super Admin user: {email}")
            user = PlatformUser(
                name=name,
                email=email,
                password_hash=hash_password(password),
                platform_role=PlatformRole.SUPER_ADMIN,
                is_active=True,
            )
            session.add(user)

        await session.commit()
        print("\nSUCCESS: Super Admin account created/updated successfully!")
        print(f"  • Email:    {email}")
        print(f"  • Password: {password}")
        print(f"  • Role:     SUPER_ADMIN")


def main():
    parser = argparse.ArgumentParser(description="Create a Super Admin user in database")
    parser.add_argument("--email", default="admin@xyz.com", help="Super admin email")
    parser.add_argument("--password", default="admin123456", help="Super admin password")
    parser.add_argument("--name", default="Super Admin", help="Full name")

    args = parser.parse_args()
    asyncio.run(create_super_admin(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
