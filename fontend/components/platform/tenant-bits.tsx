import { cn } from "@/lib/utils";
import { tenantState, trialDaysLeft } from "@/lib/platform";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { TenantRow } from "@/types/platform";

/** Fixed clock, matching every other fixture. */
const T0 = Date.UTC(2026, 6, 29);

/**
 * A tenant's effective state chip.
 *
 * Suspension beats subscription status: `is_active` (§4.2) and
 * `subscriptions.status` (§4.4) are independent columns, and a suspended
 * tenant is locked out regardless of what it is paying.
 */
export function TenantStateChip({ tenant }: { tenant: TenantRow }) {
  const { label, tone } = tenantState(tenant);
  const days = trialDaysLeft(tenant.trialEndsAt, T0);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        TONE_TEXT[tone],
      )}
    >
      {label}
      {/* An expiring trial is the number the Super Admin actually needs */}
      {tenant.status === "TRIAL" && days !== null && (
        <span className="ml-1 normal-case opacity-80">
          {days > 0 ? `· ${days}d left` : "· expired"}
        </span>
      )}
    </span>
  );
}
