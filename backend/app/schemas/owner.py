"""
Pydantic Schemas — platform owner (customer account) API

Covers the AWS/Shopify-style "account-holder" journey: signup, email
verification, login, the platform dashboard (My Institutions, Subscriptions,
Invoices, Payments, Billing summary), Support Tickets and Profile.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import APIResponse

# ── Auth: signup / verification ──────────────────────────────────────────────

EMAIL_VERIFICATION_EXPIRES_HOURS = 24


class OwnerSignupRequest(BaseModel):
    """Body for POST /owner/signup — create a customer account."""

    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class OwnerSignupResponse(BaseModel):
    """Returned after signup. Email is unverified; login is blocked until it is
    confirmed. The verification token is included only so a dev/no-mailer
    environment can complete the flow — production delivers it by email."""

    id: uuid.UUID
    name: str
    email: str
    is_email_verified: bool
    verification_token: str | None = None


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=1)


class OwnerLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class OwnerInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    is_email_verified: bool
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class OwnerLoginResponse(BaseModel):
    tokens: TokenResponse
    owner: OwnerInfo


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


# ── Profile ──────────────────────────────────────────────────────────────────

class OwnerProfileUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6, max_length=128)


# ── Dashboard: institutions ──────────────────────────────────────────────────

class OwnerInstitution(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    type: str
    plan_name: str | None = None
    subscription_status: str | None = None
    is_active: bool
    trial_ends_at: datetime | None = None
    login_url: str
    created_at: datetime


class OwnerInstitutionsResponse(BaseModel):
    institutions: list[OwnerInstitution]


# ── Dashboard: billing ───────────────────────────────────────────────────────

class BillingSummaryResponse(BaseModel):
    total_institutions: int
    active_subscriptions: int
    trialing: int
    next_renewal_at: datetime | None = None
    lifetime_spend: Decimal
    currency: str = "INR"
    outstanding: Decimal


class OwnerSubscription(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tenant_name: str
    plan_name: str
    status: str
    amount: Decimal
    currency: str
    starts_at: datetime
    ends_at: datetime | None = None


class OwnerInvoice(BaseModel):
    id: uuid.UUID
    invoice_number: str
    tenant_id: uuid.UUID
    tenant_name: str
    status: str
    issued_at: datetime
    total: Decimal
    amount_paid: Decimal
    currency: str


class OwnerPayment(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID | None
    tenant_name: str | None
    status: str
    method: str
    amount: Decimal
    currency: str
    gateway: str | None = None
    received_at: datetime | None = None
    created_at: datetime


# ── Support tickets ──────────────────────────────────────────────────────────

class TicketMessageOut(BaseModel):
    id: uuid.UUID
    author_role: str
    body: str
    created_at: datetime


class SupportTicketOut(BaseModel):
    id: uuid.UUID
    subject: str
    category: str
    status: str
    priority: str
    tenant_id: uuid.UUID | None = None
    tenant_name: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[TicketMessageOut] = []


class TicketCreateRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    category: str = Field(default="OTHER")
    priority: str = Field(default="NORMAL")
    tenant_id: uuid.UUID | None = None
    message: str = Field(..., min_length=3, max_length=4000)


class TicketReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)


# ── Typed APIResponse aliases ────────────────────────────────────────────────

APIResponseOwnerSignup = APIResponse[OwnerSignupResponse]
APIResponseOwnerLogin = APIResponse[OwnerLoginResponse]
APIResponseOwner = APIResponse[OwnerInfo]
APIResponseInstitutions = APIResponse[OwnerInstitutionsResponse]
APIResponseBilling = APIResponse[BillingSummaryResponse]
APIResponseAccessToken = APIResponse[AccessTokenResponse]
APIResponseTickets = APIResponse[list[SupportTicketOut]]
APIResponseTicket = APIResponse[SupportTicketOut]
