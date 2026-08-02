"""
Services — Catalogue & Pricing

Plan/module catalogue reads, module-price lookup, and the quote engine
that powers the "live price calculation" in the Build-Your-Own checkout
and the order totals on the review step.

Pricing rules (mirrored 1:1 by the frontend quote, so the server is always
the source of truth):

  PURCHASE, fixed plan   — plan.price_{monthly|yearly} × quantity (1 year
                           for YEARLY). Optional add-on modules not bundled
                           in the plan are billed a-la-carte.
  PURCHASE, custom plan  — sum of selected module prices (core modules are
                           priced at 0 — always included), × cycle.
  TRIAL                  — always ₹0; the trial period is fixed at
                           settings.TRIAL_DAYS.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Coupon
from app.models.catalog import Module, Plan


class PricingError(ValueError):
    """Raised for any quote the server refuses (unknown plan/module/coupon)."""


class CatalogService:
    CORE_PRICE = Decimal("0")

    @staticmethod
    def module_price(modules: list[Module], key: str) -> Decimal:
        for m in modules:
            if m.key == key:
                return m.price_monthly if not m.is_core else CatalogService.CORE_PRICE
        return CatalogService.CORE_PRICE

    @staticmethod
    async def get_plan(db: AsyncSession, slug: str) -> Plan:
        res = await db.execute(select(Plan).where(Plan.slug == slug))
        plan = res.scalar_one_or_none()
        if plan is None or not plan.is_active:
            raise PricingError(f"Unknown or inactive plan '{slug}'")
        return plan

    @staticmethod
    async def get_modules(db: AsyncSession) -> list[Module]:
        res = await db.execute(select(Module).order_by(Module.sort_order))
        return list(res.scalars().all())

    @staticmethod
    async def get_module(db: AsyncSession, key: str) -> Module | None:
        res = await db.execute(select(Module).where(Module.key == key))
        return res.scalar_one_or_none()

    @staticmethod
    async def get_coupon(db: AsyncSession, code: str | None) -> Coupon | None:
        """Fetch a valid coupon, or None when absent/inactive/expired/used-up."""
        if not code:
            return None
        res = await db.execute(select(Coupon).where(Coupon.code == code.strip().upper()))
        coupon = res.scalar_one_or_none()
        if coupon is None:
            return None
        if not coupon.is_active:
            return None
        from datetime import date

        today = date.today()
        if coupon.valid_from and coupon.valid_from > today:
            return None
        if coupon.valid_until and coupon.valid_until < today:
            return None
        if coupon.max_uses and coupon.used_count >= coupon.max_uses:
            return None
        return coupon

    @staticmethod
    def apply_coupon(total: Decimal, coupon: Coupon | None) -> Decimal:
        """Return the discounted total (never negative)."""
        if coupon is None:
            return total
        if coupon.discount_type == "PERCENT":
            discount = (total * coupon.value / Decimal("100")).quantize(Decimal("0.01"))
        else:
            discount = min(coupon.value, total)
        return max(total - discount, Decimal("0"))

    @classmethod
    async def quote(
        cls,
        db: AsyncSession,
        mode: str,
        plan_slug: str,
        module_keys: list[str],
        billing_cycle: str,
        coupon_code: str | None = None,
    ) -> dict:
        """
        Compute the authoritative price for an order.

        Returns a dict with lines/subtotal/discount/total/currency and the
        resolved coupon (used to persist the order).
        """
        if mode == "TRIAL":
            return {
                "lines": [{"label": "Free trial", "amount": Decimal("0")}],
                "subtotal": Decimal("0"),
                "discount": Decimal("0"),
                "total": Decimal("0"),
                "currency": "INR",
                "coupon": None,
            }

        if mode not in ("PURCHASE",):
            raise PricingError(f"Unknown order mode '{mode}'")

        if billing_cycle not in ("MONTHLY", "YEARLY"):
            raise PricingError(f"Unknown billing cycle '{billing_cycle}'")

        plan = await cls.get_plan(db, plan_slug)
        modules = await cls.get_modules(db)
        module_by_key = {m.key: m for m in modules}

        lines: list[dict] = []
        subtotal = Decimal("0")
        currency = plan.currency or "INR"

        def add_line(label: str, unit: Decimal, quantity: Decimal = Decimal("1")) -> None:
            nonlocal subtotal
            amount = (unit * quantity).quantize(Decimal("0.01"))
            lines.append({"label": label, "amount": amount})
            subtotal += amount

        cycle_multiplier = Decimal("12" if billing_cycle == "YEARLY" else "1")
        price = (plan.price_yearly if billing_cycle == "YEARLY" else plan.price_monthly).quantize(
            Decimal("0.01")
        )
        add_line(f"{plan.name} plan · {'yearly' if billing_cycle == 'YEARLY' else 'monthly'}", price)

        plan_modules = set(plan.allowed_modules or [])
        selected = list(dict.fromkeys(module_keys))  # dedupe, keep order
        for key in selected:
            if key in plan_modules:
                continue
            module = module_by_key.get(key)
            if module is None:
                raise PricingError(f"Unknown module '{key}'")
            if module.is_core:
                continue  # core modules are always included at no charge
            module_price = (module.price_monthly * cycle_multiplier).quantize(Decimal("0.01"))
            add_line(f"{module.name} module", module_price)
            plan_modules.add(key)

        coupon = await cls.get_coupon(db, coupon_code)
        discount = Decimal("0")
        if coupon is not None and subtotal > 0:
            if coupon.discount_type == "PERCENT":
                discount = (subtotal * coupon.value / Decimal("100")).quantize(Decimal("0.01"))
            else:
                discount = min(coupon.value, subtotal)
        total = max(subtotal - discount, Decimal("0"))

        return {
            "lines": lines,
            "subtotal": subtotal,
            "discount": discount,
            "total": total,
            "currency": currency,
            "coupon": coupon,
        }
