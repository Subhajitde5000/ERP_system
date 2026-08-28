"""
Create Super Admin User Script

Usage:
  python scripts/create_superadmin.py --email admin@xyz.com --password '<strong password>' --name "Super Admin"

Security notes (audit issue H5):
  * --password is REQUIRED — there is no default. Never bootstrap a platform
    admin with a guessable password.
  * The password is validated for minimal strength and is NEVER echoed to
    stdout or logs.
  * Refuses to run when APP_ENV=production unless --force is passed.
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Allow `python scripts/create_superadmin.py` from the backend/ root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.platform_user import PlatformUser, PlatformRole  # noqa: E402
from app.utils.security import hash_password  # noqa: E402
from scripts.common import refuse_in_production, validate_password_strength  # noqa: E402


async def create_super_admin(email: str, password: str, name: str):
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
        # Deliberately does NOT print the password (H5): stdout and shell
        # history must not carry live credentials.
        print("\nSUCCESS: Super Admin account created/updated successfully!")
        print(f"  • Email: {email}")
        print("  • Role:  SUPER_ADMIN")


def main():
    refuse_in_production("create_superadmin.py")

    parser = argparse.ArgumentParser(description="Create a Super Admin user in database")
    parser.add_argument("--email", default="admin@xyz.com", help="Super admin email")
    parser.add_argument("--password", required=True, help="Super admin password (min 10 chars, 3 character classes)")
    parser.add_argument("--name", default="Super Admin", help="Full name")
    parser.add_argument("--force", action="store_true", help="Allow running with APP_ENV=production (staging only)")

    args = parser.parse_args()
    validate_password_strength(args.password, args.email)
    asyncio.run(create_super_admin(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
