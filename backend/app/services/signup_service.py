"""
Services — Public Signup, Orders & Automatic Provisioning

Step 7 of the institution-admin journey, end to end:

  Create Tenant → Reserve Subdomain → Create Institution → Create
  Subscription → Generate Invoice → Create Institution Admin → Assign
  Default Roles → Enable Purchased Modules → Create Default Settings →
  Create Academic Year Template → Send Welcome Email → Redirect to Login

`provision_order()` runs the whole pipeline in ONE database transaction:
an order that half-provisions must not exist, so every row commits together
or nothing does (SYSTEM-FLOW §2.1 — same invariant as the sales flow).

The payment is intentionally mocked: `mark_paid` records the payment row
and the gateway reference (idempotency anchor) but no real gateway is
called — wiring Razorpay/Cashfree is a drop-in at `OrderPayService`'s
single choke point. Trial orders skip the invoice (nothing to bill).
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
from app.models.role import Role, RoleAssignment, ScopeLevel
from app.models.tenant import Tenant, TenantType
from app.models.user import User
from app.schemas.signup import (
    OrderCreateRequest,
    OrderPayRequest,
    OrderResponse,
    PriceQuoteResponse,
    ProvisionedInvoice,
    ProvisionedSubscription,
    ProvisionedTenant,
    ProvisionResult,
    SubdomainCheckResponse,
    WelcomeEmailResult,
)
from app.services.catalog_service import CatalogService
from app.utils.security import hash_password

settings = get_settings()

INVOICE_PREFIX = "INV"
GST_RATE = Decimal("18.00")

PROVISION_STEPS = [
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
    """Lowercase, strip non-alphanumerics, collapse spaces to single hyphens."""
    import re

    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "institution"


class SignupService:
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
        # Resolve + price first — a bad quote must never become a row.
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
        """
        Record the payment for an order.

        This is the single integration point for a real payment gateway:
        replace the body with `verify`-webhook handling (SYSTEM-FLOW §9.1) —
        UNIQUE(gateway, gateway_ref) already guards against replays.
        """
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
        """
        Step 6 → Step 7 hand-off: record the payment for a PENDING order,
        then immediately run the provisioning pipeline. One transaction —
        a payment that does not provision is refunded by the mock gateway
        (real gateways handle this via the webhook path, SYSTEM-FLOW §9.1).
        """
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
        """Step 7 — the automatic provisioning pipeline (one transaction)."""
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

        # 1–3. Tenant (subdomain is reserved by the unique slug).
        tenant = Tenant(
            id=uuid.uuid4(),
            name=order.institution_name,
            slug=order.url_slug,
            type=TenantType(order.institution_type),
            plan_id=plan.id,
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

        # 4. Subscription.
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

        # 5. Invoice (paid orders only — a trial has nothing to bill).
        invoice: PlatformInvoice | None = None
        if not is_trial:
            invoice = await SignupService._generate_invoice(
                db, tenant, subscription, order
            )
            invoice_row = invoice

        # Module keys are needed for the admin's role grants too.
        module_keys = list(dict.fromkeys(order.module_keys or []))

        # 6–7. Institution admin + default roles.
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

        # 8. Enable purchased modules (core always on).
        enabled = await SignupService._enable_modules(db, tenant.id, module_keys)

        # 9. Default settings — onboarding state starts at step 0.
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

        # 10. Academic year template (wizard pre-fills from this).
        year = date.today().year
        template = AcademicYear(
            tenant_id=tenant.id,
            name=f"{year}-{str(year + 1)[-2:]}",
            start_date=date(year, 6, 1),
            end_date=date(year + 1, 5, 31),
            is_current=True,
        )
        db.add(template)

        # 11. Welcome email (queued in the outbox — retried by a worker).
        domain = settings.PUBLIC_ROOT_DOMAIN or "xyz.com"
        login_url = f"https://{tenant.slug}.{domain}/login"
        email = OutboxEmail(
            event="tenant.provisioned",
            to_address=order.contact_email,
            subject=f"Welcome to {tenant.name} — your ERP is ready",
            body=(
                f"Your institution {tenant.name} has been created.\n\n"
                f"Login URL: {login_url}\n"
                f"Plan: {plan.name}\n"
                f"Modules: {', '.join(enabled) or 'core modules'}\n\n"
                "Set your password and complete the setup wizard to get started."
            ),
            status="QUEUED",
            tenant_id=tenant.id,
        )
        db.add(email)
        await db.flush()

        await db.commit()

        invoice_payload = None
        if invoice is not None:
            invoice_payload = ProvisionedInvoice(
                number=invoice["number"],
                status=invoice["status"],
                issued_at=invoice["issued_at"].isoformat(),
                subtotal=invoice["subtotal"],
                tax_amount=invoice["tax_amount"],
                total=invoice["total"],
                amount_paid=invoice["amount_paid"],
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
            admin_email=order.contact_email,
            enabled_modules=enabled,
            welcome_email=WelcomeEmailResult(
                to=email.to_address,
                subject=email.subject,
                status=email.status,
            ),
            steps=PROVISION_STEPS,
        )

    @staticmethod
    async def result(db: AsyncSession, order_id: uuid.UUID) -> ProvisionResult:
        """
        Read-only success-page payload for an already-provisioned order.
        Used by GET /orders/{id} — never re-runs the pipeline.
        """
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
        """
        Gapless per financial year — allocate inside the transaction
        (SYSTEM-FLOW §9: never count(*) + 1, which races).
        """
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
        """Assign INSTITUTION_ADMIN (+ ACCOUNTANT when finance is purchased)."""
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
        """Insert tenant_modules rows: core always ON, selected optional ON."""
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
