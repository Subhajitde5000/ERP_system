"""
Super Admin Management Utility CLI

Supports:
  1. Set / Create Super Admin (or any platform admin role)
  2. Change Super Admin / Platform Admin password
  3. Delete Super Admin password (disable/clear password access)
  4. Delete / Deactivate Super Admin account (with safety protections)
  5. List all Super Admins and Platform users
  6. Interactive menu mode (if no arguments provided or via -i / --interactive)

Usage examples:
  # Interactive Menu:
  python scripts/manage_superadmin.py

  # Create or update super admin:
  python scripts/manage_superadmin.py set --email admin@xyz.com --password mysecretpass --name "Super Admin"

  # Change password:
  python scripts/manage_superadmin.py change-password --email admin@xyz.com --password newsecretpass

  # Delete / Clear password (lock out password logins):
  python scripts/manage_superadmin.py delete-password --email admin@xyz.com

  # Delete superadmin account:
  python scripts/manage_superadmin.py delete --email admin@xyz.com --force

  # List all platform users / super admins:
  python scripts/manage_superadmin.py list
"""

import argparse
import asyncio
import getpass
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

# Ensure backend directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# SQLAlchemy & Models
from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from app.database import AsyncSessionLocal, engine, Base
    from app.models.platform_user import PlatformUser, PlatformRole
    from app.models.platform_session import PlatformSession
    from app.utils.security import hash_password
except ImportError as err:
    print(f"[!] Error importing backend app modules: {err}")
    print(f"[!] Please ensure you run this script from the 'backend' folder or workspace root.")
    sys.exit(1)


# ANSI Color formatting
class Color:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    END = "\033[0m"


def print_banner():
    banner = f"""
{Color.CYAN}{Color.BOLD}╔════════════════════════════════════════════════════════════╗
║               SUPER ADMIN MANAGEMENT CLI                   ║
╚════════════════════════════════════════════════════════════╝{Color.END}
"""
    print(banner)


async def init_db():
    """Ensure database tables exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def set_super_admin(
    email: str,
    password: str,
    name: str = "Super Admin",
    role: str = "SUPER_ADMIN"
) -> bool:
    """Create a new Super Admin or update an existing user to Super Admin."""
    await init_db()
    email = email.strip().lower()
    
    try:
        platform_role = PlatformRole(role.upper())
    except ValueError:
        print(f"{Color.RED}[ERROR] Invalid role '{role}'. Valid roles: {[r.value for r in PlatformRole]}{Color.END}")
        return False

    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).where(func.lower(PlatformUser.email) == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            print(f"{Color.YELLOW}[*] User '{email}' already exists. Updating credentials and role...{Color.END}")
            user.name = name or user.name
            user.password_hash = hash_password(password)
            user.platform_role = platform_role
            user.is_active = True
            
            # Invalidate previous sessions
            await session.execute(
                delete(PlatformSession).where(PlatformSession.user_id == user.id)
            )
            await session.commit()
            print(f"{Color.GREEN}[✓] SUCCESS: Super Admin user updated successfully!{Color.END}")
        else:
            print(f"{Color.CYAN}[*] Creating new Super Admin user: {email}{Color.END}")
            user = PlatformUser(
                id=uuid.uuid4(),
                name=name,
                email=email,
                password_hash=hash_password(password),
                platform_role=platform_role,
                is_active=True,
            )
            session.add(user)
            await session.commit()
            print(f"{Color.GREEN}[✓] SUCCESS: Super Admin user created successfully!{Color.END}")

        print(f"  • Email:    {Color.BOLD}{email}{Color.END}")
        print(f"  • Name:     {name}")
        print(f"  • Role:     {platform_role.value}")
        print(f"  • Status:   Active")
        return True


async def change_password(email: str, new_password: str) -> bool:
    """Change the password of an existing Super Admin or Platform User."""
    await init_db()
    email = email.strip().lower()

    if not new_password:
        print(f"{Color.RED}[ERROR] Password cannot be empty.{Color.END}")
        return False

    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).where(func.lower(PlatformUser.email) == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            print(f"{Color.RED}[ERROR] Platform user with email '{email}' was not found.{Color.END}")
            return False

        user.password_hash = hash_password(new_password)
        user.is_active = True

        # Invalidate active sessions to require new login
        await session.execute(
            delete(PlatformSession).where(PlatformSession.user_id == user.id)
        )
        await session.commit()

        print(f"{Color.GREEN}[✓] SUCCESS: Password changed successfully for '{email}'!{Color.END}")
        print(f"  • Name:     {user.name}")
        print(f"  • Role:     {user.platform_role.value}")
        print(f"  • Status:   Active (all previous sessions terminated)")
        return True


async def delete_superadmin_password(email: str) -> bool:
    """
    Delete/clear the Super Admin's password.
    Sets a disabled un-matchable hash and invalidates active sessions.
    """
    await init_db()
    email = email.strip().lower()

    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).where(func.lower(PlatformUser.email) == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            print(f"{Color.RED}[ERROR] Platform user with email '{email}' was not found.{Color.END}")
            return False

        # Set an invalid hash that cannot be matched by any bcrypt password attempt
        # and deactivate active sessions
        user.password_hash = "!DISABLED_PASSWORD_NO_LOGIN!"
        user.is_active = False

        await session.execute(
            delete(PlatformSession).where(PlatformSession.user_id == user.id)
        )
        await session.commit()

        print(f"{Color.GREEN}[✓] SUCCESS: Password deleted / login disabled for '{email}'.{Color.END}")
        print(f"  • User '{email}' can no longer log in with any password until reset.")
        return True


async def delete_super_admin(email: str, force: bool = False) -> bool:
    """Delete a Super Admin or Platform User account entirely."""
    await init_db()
    email = email.strip().lower()

    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).where(func.lower(PlatformUser.email) == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            print(f"{Color.RED}[ERROR] Platform user with email '{email}' was not found.{Color.END}")
            return False

        # Safety check: count how many active SUPER_ADMIN users exist
        if user.platform_role == PlatformRole.SUPER_ADMIN and not force:
            count_stmt = select(func.count(PlatformUser.id)).where(
                PlatformUser.platform_role == PlatformRole.SUPER_ADMIN,
                PlatformUser.is_active == True,
            )
            count_res = await session.execute(count_stmt)
            active_superadmins = count_res.scalar() or 0

            if active_superadmins <= 1:
                print(
                    f"{Color.RED}[WARNING] '{email}' is the ONLY active SUPER_ADMIN on the platform!{Color.END}"
                )
                print(f"If you delete this user, you may lose platform admin access.")
                confirm = input("Type 'DELETE' to confirm deletion anyway: ").strip()
                if confirm != "DELETE":
                    print(f"{Color.YELLOW}[*] Deletion cancelled.{Color.END}")
                    return False

        # Delete user's active sessions first
        await session.execute(
            delete(PlatformSession).where(PlatformSession.user_id == user.id)
        )
        # Delete user
        await session.delete(user)
        await session.commit()

        print(f"{Color.GREEN}[✓] SUCCESS: Super Admin user '{email}' has been completely deleted.{Color.END}")
        return True


async def list_super_admins() -> None:
    """List all platform users and super admins."""
    await init_db()
    async with AsyncSessionLocal() as session:
        stmt = select(PlatformUser).order_by(PlatformUser.created_at.desc())
        res = await session.execute(stmt)
        users = res.scalars().all()

        if not users:
            print(f"{Color.YELLOW}[*] No platform users found in database.{Color.END}")
            return

        print(f"\n{Color.BOLD}{'NAME':<25} {'EMAIL':<30} {'ROLE':<16} {'ACTIVE':<8} {'CREATED'}{Color.END}")
        print("-" * 95)
        for u in users:
            role_color = Color.GREEN if u.platform_role == PlatformRole.SUPER_ADMIN else Color.CYAN
            active_str = f"{Color.GREEN}Yes{Color.END}" if u.is_active else f"{Color.RED}No{Color.END}"
            created_str = u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "N/A"
            print(f"{u.name:<25} {u.email:<30} {role_color}{u.platform_role.value:<16}{Color.END} {active_str:<17} {created_str}")
        print("-" * 95 + "\n")


async def interactive_menu():
    """Interactive CLI menu for Super Admin management."""
    print_banner()
    while True:
        print(f"{Color.BOLD}Select an action:{Color.END}")
        print("  1. List all Platform Users & Super Admins")
        print("  2. Create or Update Super Admin (Set role/password)")
        print("  3. Change Super Admin / Platform User Password")
        print("  4. Delete / Clear Super Admin Password (Disable login)")
        print("  5. Delete Super Admin Account (Remove from database)")
        print("  6. Exit")
        
        choice = input(f"\n{Color.CYAN}Enter choice [1-6]: {Color.END}").strip()

        if choice == "1":
            await list_super_admins()
        elif choice == "2":
            email = input("Enter email [e.g. admin@xyz.com]: ").strip()
            name = input("Enter full name [default: Super Admin]: ").strip() or "Super Admin"
            password = getpass.getpass("Enter new password: ").strip()
            if not password:
                print(f"{Color.RED}[ERROR] Password cannot be empty.{Color.END}")
                continue
            await set_super_admin(email=email, password=password, name=name, role="SUPER_ADMIN")
        elif choice == "3":
            email = input("Enter email of user to change password: ").strip()
            password = getpass.getpass("Enter new password: ").strip()
            if not password:
                print(f"{Color.RED}[ERROR] Password cannot be empty.{Color.END}")
                continue
            await change_password(email=email, new_password=password)
        elif choice == "4":
            email = input("Enter email of Super Admin to delete password: ").strip()
            confirm = input(f"Are you sure you want to delete/disable password for '{email}'? (y/N): ").strip().lower()
            if confirm in ("y", "yes"):
                await delete_superadmin_password(email=email)
            else:
                print("Cancelled.")
        elif choice == "5":
            email = input("Enter email of Super Admin to delete: ").strip()
            confirm = input(f"Are you sure you want to delete user '{email}' completely? (y/N): ").strip().lower()
            if confirm in ("y", "yes"):
                await delete_super_admin(email=email, force=False)
            else:
                print("Cancelled.")
        elif choice == "6" or choice.lower() in ("q", "quit", "exit"):
            print("Goodbye!")
            break
        else:
            print(f"{Color.RED}Invalid selection. Please choose 1-6.{Color.END}\n")


def parse_args():
    parser = argparse.ArgumentParser(
        description="ERP Super Admin & Platform User Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Command: set
    set_parser = subparsers.add_parser("set", help="Create or update a Super Admin")
    set_parser.add_argument("--email", required=True, help="Super admin email")
    set_parser.add_argument("--password", required=True, help="Super admin password")
    set_parser.add_argument("--name", default="Super Admin", help="Full name (default: Super Admin)")
    set_parser.add_argument(
        "--role",
        default="SUPER_ADMIN",
        choices=["SUPER_ADMIN", "SUPPORT", "SALES", "FINANCE", "OWNER"],
        help="Platform role (default: SUPER_ADMIN)",
    )

    # Command: change-password
    pw_parser = subparsers.add_parser("change-password", aliases=["passwd"], help="Change Super Admin password")
    pw_parser.add_argument("--email", required=True, help="User email")
    pw_parser.add_argument("--password", required=False, help="New password (will prompt if omitted)")

    # Command: delete-password
    del_pw_parser = subparsers.add_parser("delete-password", aliases=["clear-password"], help="Delete/clear user password")
    del_pw_parser.add_argument("--email", required=True, help="User email")

    # Command: delete
    del_parser = subparsers.add_parser("delete", aliases=["remove"], help="Delete Super Admin account")
    del_parser.add_argument("--email", required=True, help="User email")
    del_parser.add_argument("--force", action="store_true", help="Force deletion without confirmation prompt")

    # Command: list
    subparsers.add_parser("list", help="List all Super Admins and Platform Users")

    # Optional interactive flag
    parser.add_argument("-i", "--interactive", action="store_true", help="Launch interactive menu")

    return parser.parse_args()


def main():
    args = parse_args()

    if args.interactive or not args.command:
        asyncio.run(interactive_menu())
        return

    if args.command == "set":
        asyncio.run(set_super_admin(args.email, args.password, args.name, args.role))
    elif args.command in ("change-password", "passwd"):
        password = args.password
        if not password:
            password = getpass.getpass("Enter new password: ").strip()
        asyncio.run(change_password(args.email, password))
    elif args.command in ("delete-password", "clear-password"):
        asyncio.run(delete_superadmin_password(args.email))
    elif args.command in ("delete", "remove"):
        asyncio.run(delete_super_admin(args.email, force=args.force))
    elif args.command == "list":
        asyncio.run(list_super_admins())


if __name__ == "__main__":
    main()
