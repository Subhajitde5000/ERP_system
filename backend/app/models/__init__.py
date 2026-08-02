"""ORM models package — import order matters for Alembic autogenerate."""

from app.models.platform_user import PlatformUser
from app.models.platform_session import PlatformSession
from app.models.platform_owner import PlatformOwner
from app.models.owner_session import OwnerSession
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role, Permission, RoleAssignment
from app.models.session import UserSession
from app.models.service_request import ServiceRequest
from app.models.support_ticket import SupportTicket, SupportTicketMessage
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
from app.models.enrollment import Enrollment, TeacherSubject

__all__ = [
    "PlatformUser",
    "PlatformSession",
    "PlatformOwner",
    "OwnerSession",
    "Tenant",
    "User",
    "Role",
    "Permission",
    "RoleAssignment",
    "UserSession",
    "ServiceRequest",
    "SupportTicket",
    "SupportTicketMessage",
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
