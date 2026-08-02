"""
Services — Public Signup, Orders & Automatic Provisioning

Step 7 of the institution-admin journey, end to end:

  Create Tenant → Reserve Subdomain → Create Institution → Create
  Subscription → Generate Invoice → Create Institution Admin → Assign
  Default Roles → Enable Purchased Modules → Create Default Settings →
  Create Academic Year Template → Send Welcome Email → Redirect to Login

provision_order() runs the whole pipeline in ONE database transaction.
Email sending is now handled by EmailService which attempts SMTP delivery
and falls back to console logging in dev.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.academic import AcademicYear
from app.models.billing import (
    Order,
    OutboxEmail,
    PlatformInvoice,
    PlatformInvoiceLine,
    PlatformPayment,
    Subscription,
    TenantModule,
    TenantSetting,
)
from app.models.catalog import Module, Plan
from app.models.platform_user import PlatformRole, PlatformUser
from app.models.role import Role, RoleAssignment, ScopeLevel
from app.models.tenant import Tenant, TenantType
from app.models.user import User
from app.schemas.signup import (
    OrderCreateRequest,
    PlatformAccountCreateRequest,
    PlatformAccountResponse,
    OrderPayRequest,
    OrderResponse,
    PriceQuoteResponse,
    ProvisionedInvoice,
    ProvisionedSubscription,
    ProvisionedTenant,
    ProvisionResult,
    SubdomainCheckResponse,
    VerifyEmailResponse,
    WelcomeEmailResult,
)
from app.services.catalog_service import CatalogService
from app.utils.security import generate_secure_token, hash_password, hash_token

settings = get_settings()

INVOICE_PREFIX = "INV"
GST_RATE = Decimal("18.00")

PROVISION_STEPS = [
    "Link Platform Owner Account",
    "Create Tenant",
    "Reserve Subdomain",
    "Create Institution",
    "Create Subscription",
    "Generate Invoice",
    "Create Institution Admin",
    "Assign Default Roles",
    "Enable Purchased Modules",
    "Create Default Settings",
    "Create Academic Year Template",
    "Send Welcome Email",
]

SUGGESTION_SUFFIXES = ["-campus", "", "-edu", "-academy", "-school", "-college"]


def _slugify(name: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "institution"


class SignupService:
    # ── Platform owner account ────────────────────────────────────────────────

    @staticmethod
    async def create_platform_account(
        db: AsyncSession, payload: PlatformAccountCreateRequest
    ) -> PlatformAccountResponse:
        email = str(payload.email).lower()
        existing_res = await db.execute(
            select(PlatformUser).where(PlatformUser.email == email)
        )
        existing = existing_res.scalar_one_or_none()
        if existing is not None:
            if existing.platform_role != PlatformRole.OWNER:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A platform staff account already uses this email",
                )
            if not existing.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This platform account is inactive",
                )
            return PlatformAccountResponse(
                id=existing.id,
                name=existing.name,
                email=existing.email,
                role=existing.platform_role.value,
                email_verified=existing.email_verified_at is not None,
                verification_sent_to=existing.email,
            )

        token = generate_secure_token()
        user = PlatformUser(
            id=uuid.uuid4(),
            name=payload.name.strip(),
            email=email,
            password_hash=hash_password(payload.password),
            platform_role=PlatformRole.OWNER,
            is_active=True,
            email_verification_token_hash=hash_token(token),
        )
        db.add(user)
        await db.flush()

        # FIXED: use EmailService for real delivery
        from app.services.email_service import EmailService
        try:
            await EmailService.send_platform_owner_verification(db, email, token)
        except Exception:
            # still record outbox as FAILED for retry
            db.add(
                OutboxEmail(
                    event="platform_owner.verify_email",
                    to_address=email,
                    subject="Verify your xyz.com platform account",
                    body=f"Verification token: {token}\nVerify at {settings.FRONTEND_URL}/verify-email?token={token}",
                    status="FAILED",
                    tenant_id=None,
                )
            )
            await db.flush()
        await db.commit()

        return PlatformAccountResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.platform_role.value,
            email_verified=False,
            verification_sent_to=user.email,
        )

    @staticmethod
    async def verify_platform_account(
        db: AsyncSession, token: str
    ) -> VerifyEmailResponse:
        token_hash = hash_token(token)
        res = await db.execute(
            select(PlatformUser).where(
                PlatformUser.platform_role == PlatformRole.OWNER,
                PlatformUser.email_verification_token_hash == token_hash,
            )
        )
        user = res.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token",
            )
        user.email_verified_at = datetime.now(timezone.utc)
        user.email_verification_token_hash = None
        await db.flush()
        await db.commit()
        return VerifyEmailResponse(email=user.email, verified=True)

    @staticmethod
    async def _ensure_owner_account(
        db: AsyncSession, payload: OrderCreateRequest
    ) -> PlatformUser:
        owner_email = str(
            payload.owner.email if payload.owner else payload.institution.email
        ).lower()
        owner_name = (
            payload.owner.name.strip()
            if payload.owner
            else f"{payload.institution.name.strip()} Owner"
        )
        res = await db.execute(select(PlatformUser).where(PlatformUser.email == owner_email))
        user = res.scalar_one_or_none()
        if user is not None:
            if user.platform_role != PlatformRole.OWNER:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A platform staff account already uses the owner email",
                )
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Owner platform account is inactive",
                )
            return user

        token = generate_secure_token()
        user = PlatformUser(
            id=uuid.uuid4(),
            name=owner_name,
            email=owner_email,
            password_hash=hash_password(payload.password),
            platform_role=PlatformRole.OWNER,
            is_active=True,
            email_verification_token_hash=hash_token(token),
        )
        db.add(user)
        await db.flush()

        from app.services.email_service import EmailService
        try:
            await EmailService.send_platform_owner_verification(db, owner_email, token)
        except Exception:
            db.add(
                OutboxEmail(
                    event="platform_owner.verify_email",
                    to_address=owner_email,
                    subject="Verify your xyz.com platform account",
                    body=f"Verify your xyz.com owner account.\n\nVerification token: {token}",
                    status="FAILED",
                    tenant_id=None,
                )
            )
            await db.flush()

        return user

    # ── Catalogue ────────────────────────────────────────────────────────────

    @staticmethod
    async def catalog(db: AsyncSession) -> dict:
        plans_res = await db.execute(select(Plan).where(Plan.is_active == True).order_by(Plan.price_monthly))  # noqa: E712
        plans = list(plans_res.scalars().all())
        modules = await CatalogService.get_modules(db)
        return {
            "plans": [
                {
                    "id": p.id,
                    "name": p.name,
                    "slug": p.slug,
                    "max_students": p.max_students,
                    "max_teachers": p.max_teachers,
                    "max_storage_gb": p.max_storage_gb,
                    "price_monthly": p.price_monthly,
                    "price_yearly": p.price_yearly,
                    "currency": p.currency,
                    "allowed_modules": p.allowed_modules or [],
                    "is_active": p.is_active,
                }
                for p in plans
            ],
            "modules": [
                {
                    "key": m.key,
                    "name": m.name,
                    "description": m.description,
                    "is_core": m.is_core,
                    "price_monthly": m.price_monthly,
                }
                for m in modules
            ],
        }

    # ── Subdomain availability ───────────────────────────────────────────────

    @staticmethod
    def normalize_slug(raw: str) -> str:
        import re
        slug = re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower()).strip("-")
        return slug[:100]

    @staticmethod
    async def check_subdomain(db: AsyncSession, raw: str) -> SubdomainCheckResponse:
        slug = SignupService.normalize_slug(raw)
        reserved = {"app", "www", "api", "admin", "mail", "billing", "support", "docs"}

        suggestions: list[str] = []
        taken = False
        if not slug:
            taken = True
        else:
            res = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
            taken = res.scalar_one_or_none() is not None or slug in reserved

        if not taken:
            suggestions = []
        else:
            base = slug or "institution"
            seen = set()
            for suffix in SUGGESTION_SUFFIXES:
                candidate = f"{base}{suffix}"[:100]
                if candidate in seen:
                    continue
                seen.add(candidate)
                res = await db.execute(select(Tenant.id).where(Tenant.slug == candidate))
                if res.scalar_one_or_none() is None and candidate not in reserved:
                    suggestions.append(candidate)
                if len(suggestions) >= 3:
                    break

        domain = settings.PUBLIC_ROOT_DOMAIN or "xyz.com"
        return SubdomainCheckResponse(
            slug=slug or "institution",
            available=not taken,
            url=f"https://{slug or 'institution'}.{domain}" if slug else f"https://{domain}",
            suggestions=suggestions,
        )

    # ── Quotes ───────────────────────────────────────────────────────────────

    @staticmethod
    async def quote(
        db: AsyncSession,
        mode: str,
        plan_slug: str,
        module_keys: list[str],
        billing_cycle: str,
        coupon_code: str | None,
    ) -> PriceQuoteResponse:
        data = await CatalogService.quote(
            db, mode, plan_slug, module_keys, billing_cycle, coupon_code
        )
        coupon = data.get("coupon")
        return PriceQuoteResponse(
            mode=mode,
            plan_slug=plan_slug,
            billing_cycle=billing_cycle,
            module_keys=list(dict.fromkeys(module_keys)),
            currency=data["currency"],
            lines=data["lines"],
            subtotal=data["subtotal"],
            discount=data["discount"],
            total=data["total"],
            coupon=(
                {
                    "code": coupon.code,
                    "discount_type": coupon.discount_type,
                    "value": coupon.value,
                    "message": f"Coupon {coupon.code} applied",
                }
                if coupon
                else None
            ),
        )

    # ── Orders ───────────────────────────────────────────────────────────────

    @staticmethod
    async def create_order(
        db: AsyncSession, payload: OrderCreateRequest
    ) -> OrderResponse:
        data = await CatalogService.quote(
            db,
            payload.mode,
            payload.plan_slug,
            payload.module_keys,
            payload.billing_cycle,
            payload.coupon_code,
        )

        slug = SignupService.normalize_slug(payload.url_slug)
        if len(slug) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="URL slug must be at least 2 characters",
            )
        res = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
        if res.scalar_one_or_none() is not None or slug in {
            "app", "www", "api", "admin", "mail", "billing", "support", "docs",
        }:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subdomain '{slug}' is already taken",
            )

        owner = await SignupService._ensure_owner_account(db, payload)

        order = Order(
            id=uuid.uuid4(),
            mode=payload.mode,
            plan_slug=payload.plan_slug,
            module_keys=list(dict.fromkeys(payload.module_keys)),
            billing_cycle=payload.billing_cycle,
            subtotal=data["subtotal"],
            discount=data["discount"],
            total=data["total"],
            currency=data["currency"],
            coupon_code=(
                data["coupon"].code if data.get("coupon") else None
            ),
            institution_name=payload.institution.name.strip(),
            institution_type=payload.institution.type,
            contact_email=str(payload.institution.email).lower(),
            owner_name=owner.name,
            owner_email=owner.email,
            owner_platform_user_id=owner.id,
            contact_phone=payload.institution.phone,
            country=payload.institution.country or "India",
            state=payload.institution.state,
            city=payload.institution.city,
            address=payload.institution.address,
            url_slug=slug,
            owner_id=payload.owner_id,
            password_hash=hash_password(payload.password),
        )
        db.add(order)
        await db.flush()
        await db.commit()

        return SignupService._order_response(order)

    @staticmethod
    def _order_response(order: Order) -> OrderResponse:
        domain = settings.PUBLIC_ROOT_DOMAIN or "xyz.com"
        return OrderResponse(
            id=order.id,
            mode=order.mode,
            plan_slug=order.plan_slug,
            module_keys=order.module_keys or [],
            billing_cycle=order.billing_cycle,
            subtotal=order.subtotal,
            discount=order.discount,
            total=order.total,
            currency=order.currency,
            coupon_code=order.coupon_code,
            status=order.status,
            institution_name=order.institution_name,
            url_slug=order.url_slug,
            login_url=f"https://{order.url_slug}.{domain}/login",
            created_at=order.created_at,
        )

    # ── Payment + provisioning ───────────────────────────────────────────────

    @staticmethod
    async def _load_order(db: AsyncSession, order_id: uuid.UUID) -> Order:
        res = await db.execute(select(Order).where(Order.id == order_id))
        order = res.scalar_one_or_none()
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )
        return order

    @staticmethod
    async def mark_paid(
        db: AsyncSession, order: Order, method: str, gateway_ref: str | None
    ) -> None:
        payment = PlatformPayment(
            tenant_id=None,
            order_id=order.id,
            status="SUCCEEDED",
            method=method,
            amount=order.total,
            currency=order.currency,
            gateway="mock",
            gateway_ref=gateway_ref or f"mock-{order.id}",
            received_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        order.status = "PAID" if order.mode == "PURCHASE" else "TRIAL_STARTED"
        order.payment_method = method
        order.gateway_ref = gateway_ref or f"mock-{order.id}"
        order.paid_at = datetime.now(timezone.utc)

    @staticmethod
    async def provision_with_payment(
        db: AsyncSession, order_id: uuid.UUID, payload: OrderPayRequest
    ) -> ProvisionResult:
        order = await SignupService._load_order(db, order_id)
        if order.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Order is {order.status}; cannot pay",
            )
        await SignupService.mark_paid(db, order, payload.method, payload.gateway_ref)
        await db.flush()
        return await SignupService.provision(db, order_id)

    @staticmethod
    async def provision(db: AsyncSession, order_id: uuid.UUID) -> ProvisionResult:
        order = await SignupService._load_order(db, order_id)
        if order.status not in ("PAID", "TRIAL_STARTED"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Order is {order.status}; cannot provision",
            )
        if order.tenant_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order has already been provisioned",
            )

        plan = await CatalogService.get_plan(db, order.plan_slug)

        tenant = Tenant(
            id=uuid.uuid4(),
            name=order.institution_name,
            slug=order.url_slug,
            type=TenantType(order.institution_type),
            plan_id=plan.id,
            owner_platform_user_id=order.owner_platform_user_id,
            email=order.contact_email,
            phone=order.contact_phone,
            country=order.country,
            state=order.state,
            city=order.city,
            address=order.address,
            is_active=True,
            timezone=settings.TENANT_DEFAULT_TIMEZONE,
        )
        db.add(tenant)
        await db.flush()

        now = datetime.now(timezone.utc)
        trial_days = int(settings.TRIAL_DAYS or 14)
        is_trial = order.mode == "TRIAL"
        if is_trial:
            tenant.trial_ends_at = now + timedelta(days=trial_days)
        order.tenant_id = tenant.id

        starts_at = now
        ends_at = (
            None
            if is_trial
            else (now + timedelta(days=365) if order.billing_cycle == "YEARLY" else now + timedelta(days=30))
        )
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            status="TRIAL" if is_trial else "ACTIVE",
            starts_at=starts_at,
            ends_at=ends_at,
            amount=order.total,
            currency=order.currency,
            payment_reference=order.gateway_ref,
        )
        db.add(subscription)
        await db.flush()

        invoice_data: dict | None = None
        if not is_trial:
            invoice_data = await SignupService._generate_invoice(
                db, tenant, subscription, order
            )

        module_keys = list(dict.fromkeys(order.module_keys or []))

        admin = User(
            tenant_id=tenant.id,
            name=order.institution_name + " Admin",
            email=order.contact_email,
            phone=order.contact_phone,
            password_hash=order.password_hash,
            is_active=True,
        )
        db.add(admin)
        await db.flush()
        await SignupService._assign_default_roles(
            db, admin, tenant.id, has_finance=("finance" in module_keys)
        )

        enabled = await SignupService._enable_modules(db, tenant.id, module_keys)

        onboarding = (
            '{"completed": false, "step": 0, "profile": null, "logo": null, '
            '"academic_year": null, "departments": [], "programs": [], '
            '"classes": [], "subjects": [], "staff": [], "students": [], '
            '"modules": [], "branding": null, "meta": {}}'
        )
        defaults = {
            "onboarding": onboarding,
            "currency": order.currency,
            "timezone": settings.TENANT_DEFAULT_TIMEZONE,
        }
        for key, value in defaults.items():
            db.add(
                TenantSetting(tenant_id=tenant.id, key=key, value=value)
            )

        year = date.today().year
        template = AcademicYear(
            tenant_id=tenant.id,
            name=f"{year}-{str(year + 1)[-2:]}",
            start_date=date(year, 6, 1),
            end_date=date(year + 1, 5, 31),
            is_current=True,
        )
        db.add(template)
        await db.flush()

        # FIXED: welcome email via EmailService (real SMTP + outbox tracking)
        domain = settings.PUBLIC_ROOT_DOMAIN or "xyz.com"
        login_url = f"https://{tenant.slug}.{domain}/login"
        from app.services.email_service import EmailService

        outbox_email: OutboxEmail
        try:
            outbox_email = await EmailService.send_welcome_email(
                db,
                to_address=order.contact_email,
                institution_name=tenant.name,
                login_url=login_url,
                plan_name=plan.name,
                modules=enabled,
                tenant_id=tenant.id,
            )
        except Exception:
            outbox_email = OutboxEmail(
                event="tenant.provisioned",
                to_address=order.contact_email,
                subject=f"Welcome to {tenant.name} — your ERP is ready",
                body=(
                    f"Your institution {tenant.name} has been created.\n\n"
                    f"Platform dashboard: https://{domain}/platform/dashboard\n"
                    f"Institution login URL: {login_url}\n"
                    f"Plan: {plan.name}\n"
                    f"Modules: {', '.join(enabled) or 'core modules'}\n\n"
                    "Set your password and complete the setup wizard to get started."
                ),
                status="FAILED",
                tenant_id=tenant.id,
            )
            db.add(outbox_email)
            await db.flush()

        await db.commit()

        invoice_payload = None
        if invoice_data is not None:
            invoice_payload = ProvisionedInvoice(
                number=invoice_data["number"],
                status=invoice_data["status"],
                issued_at=invoice_data["issued_at"].isoformat(),
                subtotal=invoice_data["subtotal"],
                tax_amount=invoice_data["tax_amount"],
                total=invoice_data["total"],
                amount_paid=invoice_data["amount_paid"],
            )

        return ProvisionResult(
            order_id=order.id,
            mode=order.mode,
            tenant=ProvisionedTenant(
                id=tenant.id,
                slug=tenant.slug,
                name=tenant.name,
                login_url=login_url,
            ),
            subscription=ProvisionedSubscription(
                status=subscription.status,
                amount=subscription.amount,
                currency=subscription.currency,
                starts_at=subscription.starts_at,
                ends_at=subscription.ends_at,
                trial_ends_at=tenant.trial_ends_at,
            ),
            invoice=invoice_payload,
            owner_email=order.owner_email or order.contact_email,
            platform_dashboard_url=f"https://{domain}/platform/dashboard",
            admin_email=order.contact_email,
            enabled_modules=enabled,
            welcome_email=WelcomeEmailResult(
                to=outbox_email.to_address,
                subject=outbox_email.subject,
                status=outbox_email.status,
            ),
            steps=PROVISION_STEPS,
        )

    @staticmethod
    async def result(db: AsyncSession, order_id: uuid.UUID) -> ProvisionResult:
        order = await SignupService._load_order(db, order_id)
        if order.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Order has not been provisioned yet",
            )

        tenant_res = await db.execute(select(Tenant).where(Tenant.id == order.tenant_id))
        tenant = tenant_res.scalar_one_or_none()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
            )

        sub_res = await db.execute(
            select(Subscription)
            .where(Subscription.tenant_id == tenant.id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        subscription = sub_res.scalar_one_or_none()

        invoice_res = await db.execute(
            select(PlatformInvoice)
            .where(PlatformInvoice.tenant_id == tenant.id)
            .order_by(PlatformInvoice.created_at.desc())
            .limit(1)
        )
        invoice = invoice_res.scalar_one_or_none()

        email_res = await db.execute(
            select(OutboxEmail)
            .where(OutboxEmail.tenant_id == tenant.id)
            .order_by(OutboxEmail.created_at.desc())
            .limit(1)
        )
        email = email_res.scalar_one_or_none()

        domain = settings.PUBLIC_ROOT_DOMAIN or "xyz.com"
        return ProvisionResult(
            order_id=order.id,
            mode=order.mode,
            tenant=ProvisionedTenant(
                id=tenant.id,
                slug=tenant.slug,
                name=tenant.name,
                login_url=f"https://{tenant.slug}.{domain}/login",
            ),
            subscription=ProvisionedSubscription(
                status=subscription.status if subscription else "ACTIVE",
                amount=subscription.amount if subscription else order.total,
                currency=subscription.currency if subscription else order.currency,
                starts_at=subscription.starts_at if subscription else order.paid_at or order.created_at,
                ends_at=subscription.ends_at if subscription else None,
                trial_ends_at=tenant.trial_ends_at,
            ),
            invoice=(
                ProvisionedInvoice(
                    number=invoice.invoice_number,
                    status=invoice.status,
                    issued_at=invoice.issued_at.isoformat(),
                    subtotal=invoice.subtotal,
                    tax_amount=invoice.tax_amount,
                    total=invoice.total,
                    amount_paid=invoice.amount_paid,
                )
                if invoice
                else None
            ),
            owner_email=order.owner_email or order.contact_email,
            platform_dashboard_url=f"https://{domain}/platform/dashboard",
            admin_email=order.contact_email,
            enabled_modules=order.module_keys or [],
            welcome_email=WelcomeEmailResult(
                to=email.to_address if email else order.contact_email,
                subject=email.subject if email else "Welcome",
                status=email.status if email else "QUEUED",
            ),
            steps=PROVISION_STEPS,
        )

    # ── Pipeline internals ───────────────────────────────────────────────────

    @staticmethod
    async def _generate_invoice(
        db: AsyncSession, tenant: Tenant, subscription: Subscription, order: Order
    ) -> dict:
        from decimal import Decimal
        today = date.today()
        number = await SignupService._next_invoice_number(db)
        subtotal = order.total.quantize(Decimal("0.01"))
        tax_amount = (subtotal * GST_RATE / Decimal("100")).quantize(Decimal("0.01"))
        total = (subtotal + tax_amount).quantize(Decimal("0.01"))

        invoice = PlatformInvoice(
            tenant_id=tenant.id,
            subscription_id=subscription.id,
            invoice_number=number,
            status="PAID",
            issued_at=today,
            due_at=today,
            currency=order.currency,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            amount_paid=total,
            place_of_supply=None,
        )
        db.add(invoice)
        await db.flush()

        plan_res = await db.execute(select(Plan).where(Plan.id == subscription.plan_id))
        plan = plan_res.scalar_one()
        period = "yearly" if order.billing_cycle == "YEARLY" else "monthly"
        db.add(
            PlatformInvoiceLine(
                invoice_id=invoice.id,
                description=f"{plan.name} plan · {period} · {tenant.name}",
                hsn_sac="998314",
                quantity=1,
                unit_price=subtotal,
                tax_rate=GST_RATE,
                line_total=total,
            )
        )
        await db.flush()

        return {
            "number": number,
            "status": invoice.status,
            "issued_at": today,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "total": total,
            "amount_paid": total,
        }

    @staticmethod
    async def _next_invoice_number(db: AsyncSession) -> str:
        year = date.today().year
        prefix = f"{INVOICE_PREFIX}-{year}-"
        res = await db.execute(
            select(func.max(PlatformInvoice.invoice_number)).where(
                PlatformInvoice.invoice_number.like(f"{prefix}%")
            )
        )
        last = res.scalar()
        seq = int(last.split("-")[-1]) + 1 if last else 1
        return f"{prefix}{seq:06d}"

    @staticmethod
    async def _assign_default_roles(
        db: AsyncSession, admin: User, tenant_id: uuid.UUID, has_finance: bool = False
    ) -> None:
        res = await db.execute(
            select(Role).where(
                Role.name.in_(["INSTITUTION_ADMIN", "ACCOUNTANT"]),
                Role.is_platform == False,  # noqa: E712
            )
        )
        roles = list(res.scalars().all())
        for role in roles:
            if role.name == "ACCOUNTANT" and not has_finance:
                continue
            db.add(
                RoleAssignment(
                    user_id=admin.id,
                    role_id=role.id,
                    tenant_id=tenant_id,
                    is_active=True,
                )
            )
        await db.flush()

    @staticmethod
    async def _enable_modules(
        db: AsyncSession, tenant_id: uuid.UUID, module_keys: list[str]
    ) -> list[str]:
        res = await db.execute(
            select(Module).order_by(Module.sort_order)
        )
        modules = list(res.scalars().all())
        enabled: list[str] = []
        now = datetime.now(timezone.utc)
        for module in modules:
            is_core = module.is_core
            wanted = is_core or module.key in module_keys
            if wanted:
                db.add(
                    TenantModule(
                        tenant_id=tenant_id,
                        module_key=module.key,
                        is_enabled=True,
                        enabled_at=now,
                    )
                )
                enabled.append(module.key)
        await db.flush()
        return enabled
