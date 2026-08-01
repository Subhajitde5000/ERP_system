import type { Tone } from "@/types/dashboard";
import type { PlanRow, TenantRow } from "@/types/platform";
import type {
  BillingCycle,
  PlanFit,
  SubscriptionAccount,
  TrialRow,
  TrialUrgency,
} from "@/types/sales";
import { moduleLabel, toMrr } from "./platform-shared";

/** Re-exported so the sales pages import one module, not two. */
export { toMrr };

/**
 * Sales Executive logic — C-SL-01…C-SL-04.
 *
 * `role_based_system_design.md` §4.1, verbatim:
 *   - Manage trial institution accounts
 *   - Upgrade / downgrade subscription plans
 *   - **Cannot access institution academic data**
 *
 * §2.1 adds: "Manage leads, trial accounts, subscription upgrades".
 *
 * So a sales exec owns the *commercial* record — `tenants.trial_ends_at`
 * (§4.2), `plans` (§4.1), `subscriptions` (§4.4) — and nothing academic. This
 * module holds the rules; `lib/sales-data.ts` applies them and decides what
 * the page is even sent. Presentation-only mapping (labels, tones) lives here
 * so all four pages stay consistent without re-deriving it.
 */

/* ── Trial clock ────────────────────────────────────────────────────────── */

/**
 * How urgent a trial is, from days remaining.
 *
 * The bands are a sales-desk convention, not a documented rule — the doc only
 * gives `trial_ends_at`. Kept as one table rather than repeated `< 3` checks
 * across four pages, the same call made for `SLA_HOURS` in `lib/support.ts`.
 * TODO(Dev-A): move to platform settings alongside `trialLengthDays` if the
 * business wants to tune them.
 */
export const TRIAL_CRITICAL_DAYS = 3;
export const TRIAL_SOON_DAYS = 7;

export function trialUrgency(daysLeft: number): TrialUrgency {
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= TRIAL_CRITICAL_DAYS) return "CRITICAL";
  if (daysLeft <= TRIAL_SOON_DAYS) return "SOON";
  return "HEALTHY";
}

export const URGENCY_LABELS: Record<TrialUrgency, string> = {
  EXPIRED: "Expired",
  CRITICAL: "Closing",
  SOON: "Due soon",
  HEALTHY: "Running",
};

export const URGENCY_TONE: Record<TrialUrgency, Tone> = {
  EXPIRED: "danger",
  CRITICAL: "danger",
  SOON: "warning",
  HEALTHY: "success",
};

/** "4 days left" / "ends today" / "expired 2 days ago". */
export function trialCountdown(daysLeft: number): string {
  if (daysLeft < 0) {
    const n = Math.abs(daysLeft);
    return `expired ${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (daysLeft === 0) return "ends today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/** Sort weight, so the desk always works the same order. */
const URGENCY_RANK: Record<TrialUrgency, number> = {
  EXPIRED: 0,
  CRITICAL: 1,
  SOON: 2,
  HEALTHY: 3,
};

/**
 * Pipeline order: most urgent first, then by value, then by name.
 *
 * Value breaks the tie because two trials closing the same day are not equally
 * worth the call. Name last so the order is stable across renders.
 */
export function byUrgency(a: TrialRow, b: TrialRow): number {
  const rank = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (rank !== 0) return rank;
  if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
  if (a.monthlyValue !== b.monthlyValue) return b.monthlyValue - a.monthlyValue;
  return a.name.localeCompare(b.name);
}

/* ── Billing ────────────────────────────────────────────────────────────── */

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

/** The price a plan charges for a cycle (§4.1 holds both columns). */
export function planPrice(plan: PlanRow, cycle: BillingCycle): number {
  return cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
}

/**
 * What a yearly commitment saves against paying monthly.
 * Derived from the two price columns rather than assumed to be "2 months
 * free" — the seed sets Basic at 49,990 vs 59,988, which is not that.
 */
export function yearlySavingPct(plan: PlanRow): number {
  const full = plan.priceMonthly * 12;
  if (full <= 0) return 0;
  return Math.round(((full - plan.priceYearly) / full) * 100);
}

/** Renewals inside this window are "due" on the C-SL-04 board. */
export const RENEWAL_WINDOW_DAYS = 45;

/**
 * Is this account actually going to bill soon?
 *
 * One predicate, used by the C-SL-01 panel, the C-SL-04 KPI and the C-SL-04
 * filter tab, so the three can't report different counts. A suspended or
 * cancelled tenant still carries a period end date, but it is not a renewal
 * — it rendered as "₹0/mo" in a list of real money and pointed the exec at a
 * dead account. Reinstating one is the Super Admin's call (C-SA-03).
 */
export function isRenewingSoon(account: SubscriptionAccount): boolean {
  return (
    account.isActive &&
    account.mrr > 0 &&
    account.daysToRenewal !== null &&
    account.daysToRenewal >= 0 &&
    account.daysToRenewal <= RENEWAL_WINDOW_DAYS
  );
}

/** Conversion rate is measured over this trailing window. */
export const CONVERSION_WINDOW_DAYS = 180;

/* ── Plan fit ───────────────────────────────────────────────────────────── */

/**
 * Can this plan carry the tenant as it stands *today*?
 *
 * Both C-SL-03 (convert) and C-SL-04 (upgrade/downgrade) need this, and
 * getting it wrong means selling a plan whose first act is to reject the
 * customer's enrolments. `issues` block; `notes` inform.
 *
 * `-1` is unlimited in `plans` (§4.1), so it can never be an issue.
 */
export function planFit(
  plan: PlanRow,
  tenant: Pick<
    TenantRow,
    "studentCount" | "teacherCount" | "storageUsedGb" | "enabledModules"
  >,
): PlanFit {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Hard caps. Exceeding one means their next enrolment or upload fails.
  if (plan.maxStudents !== -1 && tenant.studentCount > plan.maxStudents) {
    blockers.push(
      `${tenant.studentCount.toLocaleString("en-IN")} students exceeds the ${plan.maxStudents.toLocaleString("en-IN")} cap`,
    );
  }
  if (plan.maxTeachers !== -1 && tenant.teacherCount > plan.maxTeachers) {
    blockers.push(
      `${tenant.teacherCount} teachers exceeds the ${plan.maxTeachers} cap`,
    );
  }
  if (tenant.storageUsedGb > plan.maxStorageGb) {
    blockers.push(
      `${tenant.storageUsedGb} GB stored exceeds the ${plan.maxStorageGb} GB quota`,
    );
  }

  // Losing a module is a real consequence, but it is a *decision*, not a
  // failure — §4.1 explicitly allows downgrades, and every downgrade drops
  // something. Blocking on it would make the verb unusable.
  const losing = tenant.enabledModules.filter(
    (m) => !plan.allowedModules.includes(m),
  );
  if (losing.length) {
    warnings.push(
      `${losing.map(moduleLabel).join(", ")} ${losing.length === 1 ? "is" : "are"} not in this plan and would switch off — their data is kept and returns if they upgrade again`,
    );
  }

  // Headroom, only where a cap exists to have headroom against
  if (plan.maxStudents !== -1 && tenant.studentCount <= plan.maxStudents) {
    const room = plan.maxStudents - tenant.studentCount;
    notes.push(`${room.toLocaleString("en-IN")} student seats spare`);
  }
  if (plan.maxStudents === -1) notes.push("Unlimited students and teachers");

  const gaining = plan.allowedModules.filter(
    (m) => !tenant.enabledModules.includes(m),
  );
  if (gaining.length) {
    notes.push(
      `Unlocks ${gaining.length} more module${gaining.length === 1 ? "" : "s"}: ${gaining.map(moduleLabel).join(", ")}`,
    );
  }

  return {
    ok: blockers.length === 0,
    needsAck: warnings.length > 0,
    blockers,
    warnings,
    notes,
  };
}

/**
 * The cheapest plan that fits cleanly — what C-SL-03 pre-selects.
 *
 * "Cleanly" means no blockers *and* nothing switching off: recommending a
 * plan that silently drops the module they signed up to evaluate is how a
 * conversion becomes a refund. Falls back to the most capable plan when
 * nothing is clean, so the form still opens somewhere sensible.
 */
export function recommendPlan(
  plans: PlanRow[],
  tenant: Pick<
    TenantRow,
    "studentCount" | "teacherCount" | "storageUsedGb" | "enabledModules"
  >,
): PlanRow {
  const ordered = [...plans].sort((a, b) => a.priceMonthly - b.priceMonthly);
  const clean = ordered.find((p) => {
    const fit = planFit(p, tenant);
    return fit.ok && !fit.needsAck;
  });
  return clean ?? ordered[ordered.length - 1] ?? plans[0]!;
}

/** Upgrade / downgrade / same, by list price. Drives the C-SL-04 wording. */
export function planDirection(
  from: PlanRow | undefined,
  to: PlanRow | undefined,
): "UPGRADE" | "DOWNGRADE" | "SAME" {
  if (!from || !to || from.slug === to.slug) return "SAME";
  return to.priceMonthly > from.priceMonthly ? "UPGRADE" : "DOWNGRADE";
}

/* ── Money ──────────────────────────────────────────────────────────────── */

/**
 * Prorated charge for a part-month, rounded to the rupee.
 * A conversion that starts mid-cycle bills the remainder, which is the number
 * the exec has to be able to quote on the call.
 */
export function prorate(
  amount: number,
  daysRemaining: number,
  daysInPeriod: number,
): number {
  if (daysInPeriod <= 0) return 0;
  const clamped = Math.max(0, Math.min(daysRemaining, daysInPeriod));
  return Math.round((amount * clamped) / daysInPeriod);
}

/** The signed-in exec. TODO(Dev-A): read from the platform JWT. */
export const CURRENT_EXEC = { id: "pu-4", name: "Rohit Bansal" };

/* ── Board helpers ──────────────────────────────────────────────────────── */

/**
 * Renewal order: past due first, then soonest.
 * A cancelled account has no renewal date and sorts last rather than being
 * treated as infinitely far away.
 */
export function byRenewal(a: SubscriptionAccount, b: SubscriptionAccount): number {
  const aDue = a.status === "PAST_DUE" ? 0 : 1;
  const bDue = b.status === "PAST_DUE" ? 0 : 1;
  if (aDue !== bDue) return aDue - bDue;
  if (a.daysToRenewal === null) return 1;
  if (b.daysToRenewal === null) return -1;
  return a.daysToRenewal - b.daysToRenewal;
}
