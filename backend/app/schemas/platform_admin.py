"""
Pydantic Schemas — Super Admin console (C-SA-01 … C-SA-08)

Field names are camelCase on the wire because `fontend/types/platform.ts`
already defines these exact contracts and 20+ components consume them. Rather
than translate in every React file, the alias generator does it once here —
so `TenantRow.planSlug` in TypeScript is `plan_slug` in Python with zero
hand-written mapping.
"""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import APIResponse


def _camel(s: str) -> str:
    head, *rest = s.split("_")
    return head + "".join(w.capitalize() for w in rest)


class Wire(BaseModel):
    """Serialises snake_case fields as camelCase, accepts either on input."""

    model_config = ConfigDict(
        alias_generator=_camel, populate_by_name=True, from_attributes=True
    )


TenantTypeT = Literal["SCHOOL", "COLLEGE"]
SubStatusT = Literal["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"]
PlatformRoleT = Literal["SUPER_ADMIN", "SUPPORT", "SALES", "FINANCE", "OWNER"]


# ── §4.2 tenants ─────────────────────────────────────────────────────────────

class TenantRow(Wire):
    id: uuid.UUID
    name: str
    slug: str
    type: TenantTypeT
    plan_name: str
    plan_slug: str
    status: SubStatusT
    is_active: bool
    student_count: int
    teacher_count: int
    enabled_modules: list[str]
    storage_used_gb: float
    city: str | None = None
    state: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    timezone: str
    trial_ends_at: datetime | None = None
    created_at: datetime


class SubscriptionRow(Wire):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: str
    plan_name: str
    status: SubStatusT
    starts_at: datetime
    ends_at: datetime | None = None
    amount: float
    currency: str
    payment_reference: str | None = None
    cycle: Literal["MONTHLY", "YEARLY"]


class AuditEntry(Wire):
    id: uuid.UUID
    action: str
    entity: str
    target: str
    actor_name: str
    actor_role: str
    tenant_name: str | None = None
    ip_address: str
    created_at: datetime


class TenantDetail(Wire):
    tenant: TenantRow
    subscriptions: list[SubscriptionRow]
    admin_name: str
    admin_email: str
    recent_activity: list[AuditEntry]
    open_tickets: int


class TenantCreate(Wire):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    type: TenantTypeT = "COLLEGE"
    plan_slug: str
    admin_name: str = Field(..., min_length=2, max_length=255)
    admin_email: EmailStr
    trial: bool = True
    city: str | None = None
    state: str | None = None
    phone: str | None = None


class TenantUpdate(Wire):
    """Every field optional — PATCH semantics."""

    name: str | None = Field(default=None, min_length=2, max_length=255)
    plan_slug: str | None = None
    city: str | None = None
    state: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    website: str | None = None
    timezone: str | None = None
    enabled_modules: list[str] | None = None


class TenantCreated(Wire):
    tenant: TenantRow
    admin_email: str
    login_url: str
    # Only returned in debug builds so a no-mailer environment can finish setup.
    activation_token: str | None = None


# ── §4.1 plans ───────────────────────────────────────────────────────────────

class PlanRow(Wire):
    id: uuid.UUID
    name: str
    slug: str
    max_students: int
    max_teachers: int
    max_storage_gb: int
    price_monthly: float
    price_yearly: float
    currency: str
    allowed_modules: list[str]
    is_active: bool
    tenant_count: int


class PlanCreate(Wire):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9][a-z0-9-]*$")
    max_students: int = Field(..., ge=-1)
    max_teachers: int = Field(..., ge=-1)
    max_storage_gb: int = Field(default=10, ge=1)
    price_monthly: float = Field(..., ge=0)
    price_yearly: float = Field(..., ge=0)
    currency: str = "INR"
    allowed_modules: list[str] = Field(default_factory=list)
    is_active: bool = True


class PlanUpdate(Wire):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    max_students: int | None = Field(default=None, ge=-1)
    max_teachers: int | None = Field(default=None, ge=-1)
    max_storage_gb: int | None = Field(default=None, ge=1)
    price_monthly: float | None = Field(default=None, ge=0)
    price_yearly: float | None = Field(default=None, ge=0)
    allowed_modules: list[str] | None = None
    is_active: bool | None = None


# ── §4.5 platform_users ──────────────────────────────────────────────────────

class PlatformUserRow(Wire):
    id: uuid.UUID
    name: str
    email: str
    role: PlatformRoleT
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class PlatformUserCreate(Wire):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    role: Literal["SUPER_ADMIN", "SUPPORT", "SALES", "FINANCE"]
    password: str | None = Field(default=None, min_length=8, max_length=128)


class PlatformUserUpdate(Wire):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    role: Literal["SUPER_ADMIN", "SUPPORT", "SALES", "FINANCE"] | None = None
    is_active: bool | None = None


# ── C-SA-01 dashboard ────────────────────────────────────────────────────────

class TrendPoint(Wire):
    label: str
    amount: float


class PlanMixPoint(Wire):
    plan: str
    count: int


class PlatformStats(Wire):
    total_institutions: int
    active_institutions: int
    trial_institutions: int
    suspended_institutions: int
    total_students: int
    total_teachers: int
    mrr: float
    open_tickets: int
    critical_tickets: int
    revenue_trend: list[TrendPoint]
    plan_mix: list[PlanMixPoint]
    recent_tenants: list[TenantRow]


# ── C-SA-08 settings ─────────────────────────────────────────────────────────

class ModuleFlag(Wire):
    key: str
    label: str
    core: bool


class PlatformSettingsOut(Wire):
    product_name: str
    support_email: str
    root_domain: str
    allowed_modules: list[ModuleFlag]
    default_timezone: str
    default_currency: str
    trial_length_days: int
    brand_primary: str
    brand_accent: str


class PlatformSettingsUpdate(Wire):
    product_name: str | None = Field(default=None, min_length=1, max_length=100)
    support_email: EmailStr | None = None
    default_timezone: str | None = Field(default=None, max_length=50)
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    trial_length_days: int | None = Field(default=None, ge=0, le=365)
    brand_primary: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    brand_accent: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


# ── Paged envelopes ──────────────────────────────────────────────────────────

class AuditPage(Wire):
    entries: list[AuditEntry]
    total: int
    limit: int
    offset: int


# ── Response aliases (FastAPI response_model) ────────────────────────────────

APIResponseStats = APIResponse[PlatformStats]
APIResponseTenants = APIResponse[list[TenantRow]]
APIResponseTenant = APIResponse[TenantRow]
APIResponseTenantDetail = APIResponse[TenantDetail]
APIResponseTenantCreated = APIResponse[TenantCreated]
APIResponsePlans = APIResponse[list[PlanRow]]
APIResponsePlan = APIResponse[PlanRow]
APIResponsePlatformUsers = APIResponse[list[PlatformUserRow]]
APIResponsePlatformUser = APIResponse[PlatformUserRow]
APIResponseAudit = APIResponse[AuditPage]
APIResponseSettings = APIResponse[PlatformSettingsOut]
APIResponseSubscriptions = APIResponse[list[SubscriptionRow]]
