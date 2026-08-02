"""
ERP Backend — Database Seeder Script

Creates default initial data (all idempotent — safe to re-run):
- Platform staff users (Super Admin, Support, Sales, Finance)
- The 16 module catalogue (8 core + 8 optional) with a-la-carte prices
- The 22 roles (4 platform + 18 institution) — same rows as database.sql §6.2
- Subscription plans (Starter / Professional / Enterprise) per the public
  pricing page — professional at ₹7,999/month
- Starter coupons (WELCOME10, LAUNCH500)
- Sample Tenant & Users for local dev & testing

Usage:
  python scripts/seed_data.py
"""

import asyncio
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.billing import Coupon
from app.models.catalog import Module, Plan
from app.models.platform_user import PlatformUser, PlatformRole
from app.models.role import Role, ScopeLevel
from app.models.tenant import Tenant, TenantType
from app.models.user import User, Gender
from app.utils.security import hash_password

# ── Catalogue ────────────────────────────────────────────────────────────────

MODULES = [
    # (key, name, description, is_core, icon, sort, price_monthly)
    ("attendance", "Attendance", "Daily and period-wise attendance marking and reports.", True, "ClipboardCheck", 1, 0),
    ("examination", "Examination", "Online and offline exams, question banks, grading.", True, "FileText", 2, 0),
    ("assignment", "Assignments", "Assignments, milestones, submissions and review.", True, "FilePlus", 3, 0),
    ("notice", "Notice Board", "Institution, department and class notices.", True, "Megaphone", 4, 0),
    ("discussion", "Discussion", "Threaded subject and class discussion forums.", True, "MessagesSquare", 5, 0),
    ("content", "Content", "Study material: notes, videos, documents.", True, "BookOpen", 6, 0),
    ("results", "Results", "Result publication and grade cards.", True, "GraduationCap", 7, 0),
    ("timetable", "Timetable", "Weekly timetable, slots and substitutions.", True, "CalendarDays", 8, 0),
    ("library", "Library", "Catalogue, circulation, fines and e-resources.", False, "Library", 9, 1500),
    ("hostel", "Hostel", "Blocks, rooms, allotments and night roll-call.", False, "Building2", 10, 2000),
    ("transport", "Transport", "Routes, stops, vehicles and student assignment.", False, "Bus", 11, 1500),
    ("placement", "Placement", "Companies, drives, applications and offers.", False, "Handshake", 12, 1500),
    ("hr", "HR", "Staff profiles, leave, payroll and appraisals.", False, "Users", 13, 2000),
    ("admission", "Admission", "Admission cycles, applications and merit lists.", False, "UserRoundPlus", 14, 1500),
    ("inventory", "Inventory", "Items, stock movements, vendors and purchase orders.", False, "Boxes", 15, 1500),
    ("finance", "Finance", "Fee structures, collection, scholarships and dues.", False, "BadgeIndianRupee", 16, 2000),
]

CORE_KEYS = [m[0] for m in MODULES if m[3]]
ALL_KEYS = [m[0] for m in MODULES]

# ── Roles (mirrors database.sql §6.2) ────────────────────────────────────────

ROLES = [
    # (name, label, scope_level, is_platform, is_optional, module_key, description)
    ("SUPER_ADMIN", "Super Admin", "PLATFORM", True, False, None, "Full platform control: tenants, plans, billing, platform users."),
    ("SUPPORT_STAFF", "Support Staff", "PLATFORM", True, False, None, "Reads any institution to resolve tickets."),
    ("SALES_EXECUTIVE", "Sales Executive", "PLATFORM", True, False, None, "Trials, conversions and subscription management."),
    ("FINANCE_MANAGER", "Finance Manager", "PLATFORM", True, False, None, "Platform invoicing and revenue."),
    ("INSTITUTION_ADMIN", "Institution Admin", "INSTITUTION", False, False, None, "Full control of one institution."),
    ("PRINCIPAL", "Principal", "INSTITUTION", False, False, None, "Institution-wide oversight."),
    ("VICE_PRINCIPAL", "Vice Principal", "INSTITUTION", False, False, None, "Institution-wide read access; posts notices."),
    ("HOD", "Head of Department", "DEPARTMENT", False, False, None, "Owns one department."),
    ("TEACHER", "Teacher", "SUBJECT", False, False, None, "Marks attendance, exams, assignments, grades."),
    ("MENTOR", "Mentor", "SELF", False, False, None, "Pastoral care for assigned mentees."),
    ("EXAM_CONTROLLER", "Exam Controller", "INSTITUTION", False, False, None, "Examination across all departments."),
    ("ACADEMIC_COORDINATOR", "Academic Coordinator", "INSTITUTION", False, False, None, "Timetable, substitutions, calendar."),
    ("STUDENT", "Student", "SELF", False, False, None, "Own attendance, exams, assignments, results."),
    ("PARENT", "Parent", "CHILD", False, False, None, "Read-only view of a linked child."),
    ("ACCOUNTANT", "Accountant", "INSTITUTION", False, True, "finance", "Fee structures, collection, receipts."),
    ("LIBRARIAN", "Librarian", "INSTITUTION", False, True, "library", "Catalogue, circulation, fines."),
    ("HOSTEL_WARDEN", "Hostel Warden", "INSTITUTION", False, True, "hostel", "Rooms, allotments, roll-call."),
    ("TRANSPORT_MANAGER", "Transport Manager", "INSTITUTION", False, True, "transport", "Routes, vehicles, assignment."),
    ("PLACEMENT_OFFICER", "Placement Officer", "INSTITUTION", False, True, "placement", "Companies, drives, offers."),
    ("HR_MANAGER", "HR Manager", "INSTITUTION", False, True, "hr", "Staff records, payroll, appraisals."),
    ("ADMISSION_OFFICER", "Admission Officer", "INSTITUTION", False, True, "admission", "Cycles, applications, merit lists."),
    ("STORE_MANAGER", "Store Manager", "INSTITUTION", False, True, "inventory", "Catalogue, stock, vendors."),
]

# ── Plans (public pricing page) ──────────────────────────────────────────────

PLANS = [
    # (name, slug, max_students, max_teachers, storage, monthly, yearly, allowed)
    ("Starter", "starter", 500, 50, 10, 4999, 49990, CORE_KEYS),
    (
        "Professional",
        "professional",
        5000,
        500,
        200,
        7999,
        79990,
        CORE_KEYS + ["library", "hostel", "transport", "placement", "hr", "finance"],
    ),
    (
        "Enterprise",
        "enterprise",
        -1,
        -1,
        1000,
        19999,
        199990,
        ALL_KEYS,
    ),
]

COUPONS = [
    ("WELCOME10", "PERCENT", 10, 0, None),
    ("LAUNCH500", "FIXED", 500, 0, None),
]


async def seed_platform_users(db: AsyncSession):
    print("Seeding Platform Users...")
    users_data = [
        {"name": "Super Admin", "email": "admin@xyz.com", "password": "adminpassword123", "role": PlatformRole.SUPER_ADMIN},
        {"name": "Support Lead", "email": "support@xyz.com", "password": "supportpassword123", "role": PlatformRole.SUPPORT},
        {"name": "Sales Executive", "email": "sales@xyz.com", "password": "salespassword123", "role": PlatformRole.SALES},
        {"name": "Finance Manager", "email": "finance@xyz.com", "password": "financepassword123", "role": PlatformRole.FINANCE},
    ]
    for u in users_data:
        stmt = select(PlatformUser).where(PlatformUser.email == u["email"])
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(PlatformUser(
                name=u["name"], email=u["email"],
                password_hash=hash_password(u["password"]),
                platform_role=u["role"], is_active=True,
            ))
            print(f"  + Added platform user: {u['email']} ({u['role'].value})")
        else:
            print(f"  ~ Platform user already exists: {u['email']}")
    await db.commit()


async def seed_modules(db: AsyncSession):
    print("Seeding Modules...")
    for key, name, description, is_core, icon, sort, price in MODULES:
        stmt = select(Module).where(Module.key == key)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Module(
                key=key, name=name, description=description, is_core=is_core,
                icon=icon, sort_order=sort, price_monthly=price,
            ))
            print(f"  + Added module: {key}")
        else:
            existing.price_monthly = price
            existing.name = name
    await db.commit()


async def seed_roles(db: AsyncSession):
    print("Seeding Roles...")
    for name, label, scope, is_platform, is_optional, module_key, desc in ROLES:
        stmt = select(Role).where(Role.name == name)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Role(
                name=name, label=label, scope_level=ScopeLevel(scope),
                is_platform=is_platform, is_optional=is_optional,
                module_key=module_key, description=desc,
            ))
            print(f"  + Added role: {name}")
        else:
            print(f"  ~ Role already exists: {name}")
    await db.commit()


async def seed_plans(db: AsyncSession):
    print("Seeding Plans...")
    for name, slug, students, teachers, storage, monthly, yearly, allowed in PLANS:
        stmt = select(Plan).where(Plan.slug == slug)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Plan(
                name=name, slug=slug, max_students=students, max_teachers=teachers,
                max_storage_gb=storage, price_monthly=monthly, price_yearly=yearly,
                currency="INR", allowed_modules=allowed, is_active=True,
            ))
            print(f"  + Added plan: {slug}")
        else:
            existing.name = name
            existing.max_students = students
            existing.max_teachers = teachers
            existing.max_storage_gb = storage
            existing.price_monthly = monthly
            existing.price_yearly = yearly
            existing.allowed_modules = allowed
            print(f"  ~ Updated plan: {slug}")
    await db.commit()


async def seed_coupons(db: AsyncSession):
    print("Seeding Coupons...")
    for code, kind, value, max_uses, valid_until_days in COUPONS:
        stmt = select(Coupon).where(Coupon.code == code)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Coupon(
                code=code, discount_type=kind, value=value, currency="INR",
                max_uses=max_uses, used_count=0, is_active=True,
                valid_from=date.today(),
                valid_until=date.today() + timedelta(days=365) if valid_until_days is None else date.today() + timedelta(days=valid_until_days),
            ))
            print(f"  + Added coupon: {code}")
    await db.commit()


async def seed_demo_tenant(db: AsyncSession):
    print("\nSeeding Demo Tenant & Users...")
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
        print("  + Added demo tenant: abc-college")
    else:
        print("  ~ Demo tenant already exists: abc-college")

    user_stmt = select(User).where(User.tenant_id == tenant.id, User.email == "admin@abc-college.edu")
    inst_admin = (await db.execute(user_stmt)).scalar_one_or_none()
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
    await db.commit()


async def main():
    async with AsyncSessionLocal() as db:
        try:
            await seed_platform_users(db)
            await seed_modules(db)
            await seed_roles(db)
            await seed_plans(db)
            await seed_coupons(db)
            await seed_demo_tenant(db)
            print("\nDatabase seeding completed successfully!")
        except Exception as e:
            print(f"\nError during database seeding: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
