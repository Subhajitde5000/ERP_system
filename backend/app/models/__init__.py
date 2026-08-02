"""ORM models package — import order matters for Alembic autogenerate."""

from app.models.platform_user import PlatformUser
from app.models.platform_session import PlatformSession
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role, Permission, RoleAssignment
from app.models.session import UserSession
from app.models.service_request import ServiceRequest
from app.models.catalog import Plan, Module
from app.models.billing import (
    Coupon,
    Order,
    OutboxEmail,
    PlatformInvoice,
    PlatformInvoiceLine,
    PlatformPayment,
    Subscription,
    TenantModule,
    TenantSetting,
)
from app.models.academic import AcademicYear, Department, SchoolClass, Subject

__all__ = [
    "PlatformUser",
    "PlatformSession",
    "Tenant",
    "User",
    "Role",
    "Permission",
    "RoleAssignment",
    "UserSession",
    "ServiceRequest",
    "Plan",
    "Module",
    "Subscription",
    "TenantModule",
    "TenantSetting",
    "PlatformInvoice",
    "PlatformInvoiceLine",
    "PlatformPayment",
    "Coupon",
    "Order",
    "OutboxEmail",
    "AcademicYear",
    "Department",
    "SchoolClass",
    "Subject",
]
