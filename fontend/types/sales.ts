import type { BillingCycle, SubscriptionStatus, TenantType } from "./platform";
import type { ModuleKey } from "./auth";

/** Re-exported so the sales pages import one contract module, not two. */
export type { BillingCycle };

/**
 * Sales Executive contracts — C-SL-01…C-SL-04.
 *
 * `role_based_system_design.md` §4.1, verbatim:
 *   - Manage trial institution accounts
 *   - Upgrade / downgrade subscription plans
 *   - **Cannot access institution academic data**
 *
 * That last line decides the shape of every payload below. A trial is a
 * *commercial* record: `tenants` (§4.2), `plans` (§4.1) and `subscriptions`
 * (§4.4). Seat counts and storage are in here because they are what the plan
 * is priced on — but no student, no mark, no attendance figure and no audit
 * entry from inside the tenant ever reaches this layer. The entitlement is
 * decided in `lib/sales-data.ts`, not in the components, so an unowned field
 * is absent from the RSC payload rather than merely unrendered.
 *
 * ── Gap in the schema, flagged in the README ──────────────────────────────
 * C-SL-02 asks for "days left, contact, **follow-up notes**". §4 has no notes
 * table: `tenants` carries contact columns and `trial_ends_at`, but there is
 * nowhere to record a sales conversation. `TrialNote` below is the shape the
 * page implies —
 *   `trial_notes (id, tenant_id, author_id, body, next_action_at, created_at)`
 * — marked `TODO(Dev-A)` so the table gets added rather than the UI quietly
 * inventing storage. Same call that was made for `ticket_replies` (C-SP-03).
 */

/**
 * Where a trial stands against its clock. Derived from `trial_ends_at`
 * (§4.2) — not a stored column, so it can never disagree with the date.
 */
export type TrialUrgency = "EXPIRED" | "CRITICAL" | "SOON" | "HEALTHY";

/** A follow-up note against a trial. TODO(Dev-A): `trial_notes`, see above. */
export interface TrialNote {
  id: string;
  authorName: string;
  body: string;
  /** When the exec said they'd next make contact; null = no commitment */
  nextActionAt: string | null;
  createdAt: string;
}

/**
 * One trial tenant, as the sales desk sees it.
 * Everything here comes from `tenants`, `plans` and `subscriptions`.
 */
export interface TrialRow {
  tenantId: string;
  name: string;
  slug: string;
  type: TenantType;
  /** Plan they are trialling — `tenants.plan_id` (§4.2) */
  planName: string;
  planSlug: string;
  /** `tenants.trial_ends_at`; never null on a trial row */
  trialEndsAt: string;
  /** Negative once expired */
  daysLeft: number;
  urgency: TrialUrgency;
  createdAt: string;
  /** Days since signup — how long they have had to evaluate */
  ageDays: number;

  /* Contact — `tenants` §4.2 plus the Institution Admin (§5.5) */
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  city: string | null;
  state: string | null;

  /* Usage. Seats and storage price the plan, so they are commercial
     figures — unlike anything about an individual student. */
  studentCount: number;
  teacherCount: number;
  storageUsedGb: number;
  enabledModules: ModuleKey[];
  /** Optional modules switched on — the strongest engagement signal */
  optionalModulesOn: number;

  /** Owning sales exec — `platform_users` (§4.5); null = nobody has it */
  ownerId: string | null;
  ownerName: string | null;

  notes: TrialNote[];
  lastContactedAt: string | null;
  nextActionAt: string | null;

  /** List price of the plan they are on, per month — the pipeline value */
  monthlyValue: number;
}

/** C-SL-01 — dashboard KPIs. */
export interface SalesStats {
  openTrials: number;
  /** Expired or ≤3 days left — the queue that loses money if ignored */
  needsAction: number;
  expired: number;
  unassigned: number;
  /** Trials owned by the signed-in exec */
  mine: number;
  /** Converted ÷ (converted + lapsed), over `CONVERSION_WINDOW_DAYS` */
  conversionRate: number;
  converted: number;
  lapsed: number;
  /** Sum of the list price of every open trial, per month */
  pipelineValue: number;
  /** Signups per month, oldest first */
  signupTrend: { label: string; count: number }[];
  /** Open trials, most urgent first */
  pipeline: TrialRow[];
  /** Newest tenants of any kind — the doc's "recent signups" */
  recentSignups: {
    tenantId: string;
    name: string;
    slug: string;
    planName: string;
    createdAt: string;
    ageDays: number;
    status: SubscriptionStatus;
    isActive: boolean;
    trialEndsAt: string | null;
  }[];
  /** Paid subscriptions renewing inside `RENEWAL_WINDOW_DAYS` */
  renewalsDue: SubscriptionAccount[];
}

/**
 * C-SL-04 — one row per paying institution.
 *
 * Distinct from `SubscriptionRow` in `types/platform.ts`, which is a single
 * *billing-history* row. This is the **account**: the current period, what it
 * renews at, and the headroom that decides whether an upgrade is a sale or a
 * necessity.
 */
export interface SubscriptionAccount {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  type: TenantType;
  planName: string;
  planSlug: string;
  status: SubscriptionStatus;
  /** `tenants.is_active` — suspension is independent of billing (§4.2/§4.4) */
  isActive: boolean;
  cycle: BillingCycle;
  /** Charged per cycle */
  amount: number;
  /** Normalised to a month, so yearly and monthly accounts can be summed */
  mrr: number;
  currency: string;
  /** First paid period's `starts_at` */
  startedAt: string;
  /** Current period's `ends_at`; null once cancelled */
  renewsAt: string | null;
  daysToRenewal: number | null;
  paymentReference: string | null;

  studentCount: number;
  teacherCount: number;
  /** Seats used against the plan cap; null when the plan is unlimited */
  seatPct: number | null;
  storageUsedGb: number;
  enabledModules: ModuleKey[];
}

/** C-SL-04 — the board plus its totals, computed once server-side. */
export interface SubscriptionBoard {
  accounts: SubscriptionAccount[];
  mrr: number;
  arr: number;
  renewalsDue: number;
  pastDue: number;
}

/** C-SL-03 — everything the convert form needs, in one read. */
export interface ConvertContext {
  trial: TrialRow;
  /** Plan the seats actually fit on, pre-selected for the exec */
  recommendedPlanSlug: string;
  /** Default billing start: the day the trial ends, or today if it has */
  defaultBillingStart: string;
  /** Today, from the fixture clock — the earliest legal billing start */
  today: string;
}

/**
 * Whether a plan can carry a tenant as it stands today.
 *
 * Three levels, because they need three different answers:
 *
 * - `blockers` — the tenant is over a cap this plan enforces. Their next
 *   enrolment or upload simply fails, so the change is refused.
 * - `warnings` — a module they currently use isn't licensed by this plan and
 *   would switch off. That is a legitimate thing to sell, but only
 *   deliberately, so the UI makes the exec acknowledge it rather than
 *   refusing outright — otherwise "downgrade" (§4.1) could never be done.
 * - `notes` — headroom and gains, purely informational.
 *
 * Collapsing warnings into blockers made every downgrade impossible; keeping
 * them apart is what lets C-SL-04 do the job the doc names.
 */
export interface PlanFit {
  /** No blockers — the change may proceed, possibly after acknowledgement */
  ok: boolean;
  /** True when `warnings` is non-empty: proceed, but say so out loud */
  needsAck: boolean;
  blockers: string[];
  warnings: string[];
  notes: string[];
}
