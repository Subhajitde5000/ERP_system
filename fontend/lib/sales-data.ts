import type { PlanRow, TenantRow } from "@/types/platform";
import type {
  ConvertContext,
  SalesStats,
  SubscriptionAccount,
  SubscriptionBoard,
  TrialNote,
  TrialRow,
} from "@/types/sales";
import {
  byRenewal,
  byUrgency,
  CONVERSION_WINDOW_DAYS,
  CURRENT_EXEC,
  isRenewingSoon,
  planPrice,
  recommendPlan,
  trialUrgency,
} from "./sales";
import {
  getPlans,
  getSubscriptions,
  getTenant,
  getTenantAdminName,
  getTenantOrigin,
  getTenants,
  tenantMrr,
} from "./platform-data";
import { OPTIONAL_MODULES } from "./session";

/**
 * Sales data source — C-SL-01…C-SL-04.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): the platform sales API (assignment doc §2.3):
 *
 *   GET       /api/v1/platform/trials              list + filters (C-SL-02)
 *   POST      /api/v1/platform/trials/:id/convert  trial → paid (C-SL-03)
 *   GET/PATCH /api/v1/platform/subscriptions       the account board (C-SL-04)
 *
 * Every figure here is derived from `tenants` (§4.2), `plans` (§4.1) and
 * `subscriptions` (§4.4) via `lib/platform-data.ts`. Nothing is re-seeded: a
 * trial the Sales console lists is the same row the Super Admin sees on
 * `/platform/institutions`, priced off the same plan, with the same seat
 * counts. ABC College's 910 students still come from the institution app's
 * own department table.
 *
 * **§4.1: Sales "cannot access institution academic data."**
 * That is enforced here, in the data layer, not in the components — the
 * project's standing rule. `toTrialRow()` and `toAccount()` below are the only
 * two places a `TenantRow` becomes a sales payload, and neither copies
 * anything academic across. There is no `getAuditLog()` import in this file
 * and no path to student, mark, attendance or fee data: the RSC payload the
 * browser receives simply does not contain it. Seats, teachers and storage
 * *are* included, because those are the meters the plan is priced on.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const daysBetween = (iso: string) => Math.round((T0 - Date.parse(iso)) / DAY);
/** Ceil, so "ends later today" reads as 0 days left rather than -1. */
const daysUntil = (iso: string) => Math.ceil((Date.parse(iso) - T0) / DAY);

/* ── Ownership & follow-up notes ────────────────────────────────────────── */

/**
 * Which exec owns which trial — `platform_users.id` (§4.5).
 * A slug missing from this map is deliberately unowned: an unassigned trial
 * is the thing that quietly goes cold, so the dashboard counts it.
 */
const TRIAL_OWNER: Record<string, string> = {
  "greenwood-high": "pu-5", // Aparna Iyer
  "sunrise-academy": "pu-4", // Rohit Bansal — the signed-in exec
  "vidya-college": "pu-4",
  "springfield-school": "pu-4",
  // techno-institute: nobody has picked it up
};

/** `platform_users` ids → names (§4.5). */
const EXECS: Record<string, string> = {
  "pu-4": "Rohit Bansal",
  "pu-5": "Aparna Iyer",
};

/**
 * Follow-up notes against a trial.
 *
 * TODO(Dev-A): `trial_notes` does not exist in §4 — see `types/sales.ts`. The
 * assignment doc's C-SL-02 explicitly asks for "follow-up notes", so the shape
 * is defined rather than the requirement dropped.
 *
 * [daysAgo, authorId, body, nextActionInDays | null]
 */
const NOTES: Record<string, [number, string, string, number | null][]> = {
  "vidya-college": [
    [11, "pu-4", "Demo with the Principal and the HOD of Commerce. They want Placement kept on — it is the reason they are evaluating us at all.", null],
    [5, "pu-4", "Quoted Premium yearly. Finance committee meets Friday; Principal expects sign-off but wants the invoice in the current financial year.", 2],
    [1, "pu-4", "Trial lapsed over the weekend. Data is retained for 30 days — reassured them, and offered a 7-day extension while the committee signs.", 0],
  ],
  "springfield-school": [
    [9, "pu-4", "Imported 840 students without help. Library and Transport switched on in week one — strong engagement signal.", null],
    [3, "pu-4", "Asked for yearly pricing and a comparison against their current vendor. Sent the Standard breakdown.", 1],
  ],
  "greenwood-high": [
    [7, "pu-5", "Small school, 310 students, price-sensitive. Basic covers them comfortably.", null],
    [2, "pu-5", "Wants to see the parent app before committing. Booked a walkthrough for next week.", 4],
  ],
  "sunrise-academy": [
    [2, "pu-4", "Signed up six days ago and still onboarding. No pressure yet — check back once they have imported staff.", 10],
  ],
  // techno-institute has no notes: an unowned trial nobody has called
};

function buildNotes(slug: string): TrialNote[] {
  return (NOTES[slug] ?? [])
    .map(([daysAgo, authorId, body, nextIn], i) => ({
      id: `tn-${slug}-${i + 1}`,
      authorName: EXECS[authorId] ?? "Sales",
      body,
      nextActionAt: nextIn === null ? null : at(-nextIn),
      createdAt: at(daysAgo),
    }))
    // Newest first — the last thing said is the thing you need
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ── Mapping ────────────────────────────────────────────────────────────── */

function planBySlug(slug: string): PlanRow | undefined {
  return getPlans().find((p) => p.slug === slug);
}

/**
 * `TenantRow` → `TrialRow`.
 *
 * The entitlement boundary for §4.1's "cannot access institution academic
 * data": this function names every field that crosses into the sales payload,
 * so anything academic would have to be added here deliberately.
 */
function toTrialRow(tenant: TenantRow): TrialRow | null {
  if (tenant.status !== "TRIAL" || !tenant.trialEndsAt) return null;

  const plan = planBySlug(tenant.planSlug);
  const daysLeft = daysUntil(tenant.trialEndsAt);
  const notes = buildNotes(tenant.slug);
  const ownerId = TRIAL_OWNER[tenant.slug] ?? null;

  // The most recent commitment that hasn't already passed
  const nextAction = notes
    .filter((n) => n.nextActionAt !== null)
    .sort((a, b) => a.nextActionAt!.localeCompare(b.nextActionAt!))[0];

  return {
    tenantId: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type,
    planName: tenant.planName,
    planSlug: tenant.planSlug,
    trialEndsAt: tenant.trialEndsAt,
    daysLeft,
    urgency: trialUrgency(daysLeft),
    createdAt: tenant.createdAt,
    ageDays: daysBetween(tenant.createdAt),

    contactName: getTenantAdminName(tenant.slug),
    contactEmail: tenant.email ?? "",
    contactPhone: tenant.phone,
    city: tenant.city,
    state: tenant.state,

    studentCount: tenant.studentCount,
    teacherCount: tenant.teacherCount,
    storageUsedGb: tenant.storageUsedGb,
    enabledModules: tenant.enabledModules,
    optionalModulesOn: tenant.enabledModules.filter((m) =>
      OPTIONAL_MODULES.includes(m),
    ).length,

    ownerId,
    ownerName: ownerId ? (EXECS[ownerId] ?? null) : null,

    notes,
    lastContactedAt: notes[0]?.createdAt ?? null,
    nextActionAt: nextAction?.nextActionAt ?? null,

    monthlyValue: plan?.priceMonthly ?? 0,
  };
}

/**
 * `TenantRow` → `SubscriptionAccount`, using the tenant's real billing rows.
 * Same entitlement boundary as `toTrialRow`: commercial fields only.
 */
function toAccount(tenant: TenantRow): SubscriptionAccount | null {
  // A tenant still on trial is not a subscription account — it is a lead
  if (tenant.status === "TRIAL") return null;

  const plan = planBySlug(tenant.planSlug);
  const history = getSubscriptions(tenant.id);
  const paid = history.filter((s) => s.status !== "TRIAL");
  const current = paid[paid.length - 1];
  if (!current) return null;

  const cycle = current.cycle;
  const renewsAt = tenant.status === "CANCELLED" ? null : current.endsAt;

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    type: tenant.type,
    planName: tenant.planName,
    planSlug: tenant.planSlug,
    status: tenant.status,
    isActive: tenant.isActive,
    cycle,
    amount: current.amount,
    // `tenantMrr` is the one definition, shared with the Super Admin
    // dashboard. Computing it locally as "cancelled ? 0 : amount/12" booked
    // ₹4,999 from suspended Orchid College here while the platform overview
    // correctly counted zero — two MRR numbers on one platform.
    mrr: tenantMrr(tenant),
    currency: current.currency,
    startedAt: paid[0]!.startsAt,
    renewsAt,
    daysToRenewal: renewsAt ? daysUntil(renewsAt) : null,
    paymentReference: current.paymentReference,

    studentCount: tenant.studentCount,
    teacherCount: tenant.teacherCount,
    seatPct:
      plan && plan.maxStudents !== -1
        ? Math.min(100, Math.round((tenant.studentCount / plan.maxStudents) * 100))
        : null,
    storageUsedGb: tenant.storageUsedGb,
    enabledModules: tenant.enabledModules,
  };
}

/* ── C-SL-02 Trial Institutions ─────────────────────────────────────────── */

/** Every open trial, most urgent first. */
export function getTrials(): TrialRow[] {
  return getTenants()
    .map(toTrialRow)
    .filter((t): t is TrialRow => t !== null)
    .sort(byUrgency);
}

export function getTrial(tenantId: string): TrialRow | undefined {
  const tenant = getTenant(tenantId);
  return tenant ? (toTrialRow(tenant) ?? undefined) : undefined;
}

export function getTrialIds(): string[] {
  return getTrials().map((t) => t.tenantId);
}

/* ── C-SL-03 Convert Trial to Paid ──────────────────────────────────────── */

/**
 * Everything the convert form needs, resolved server-side.
 *
 * Billing defaults to the day the trial ends — converting early shouldn't cost
 * the customer the days they were promised — and to today once it already has,
 * because you cannot start billing in the past.
 */
export function getConvertContext(tenantId: string): ConvertContext | undefined {
  const trial = getTrial(tenantId);
  if (!trial) return undefined;

  const today = new Date(T0).toISOString().slice(0, 10);
  const trialEnd = trial.trialEndsAt.slice(0, 10);

  return {
    trial,
    recommendedPlanSlug: recommendPlan(getPlans(), trial).slug,
    defaultBillingStart: trial.daysLeft > 0 ? trialEnd : today,
    today,
  };
}

/* ── C-SL-04 Subscription Management ────────────────────────────────────── */

export function getSubscriptionBoard(): SubscriptionBoard {
  const accounts = getTenants()
    .map(toAccount)
    .filter((a): a is SubscriptionAccount => a !== null)
    .sort(byRenewal);

  const mrr = accounts.reduce((a, s) => a + s.mrr, 0);

  return {
    accounts,
    mrr,
    arr: mrr * 12,
    renewalsDue: accounts.filter(isRenewingSoon).length,
    pastDue: accounts.filter((s) => s.status === "PAST_DUE").length,
  };
}

/* ── C-SL-01 Sales Dashboard ────────────────────────────────────────────── */

/**
 * Conversion rate, read out of billing history.
 *
 * A tenant that trialled and then paid is a conversion; one whose trial row
 * has nothing after it lapsed. Both come from `subscriptions` (§4.4) via
 * `getTenantOrigin`, which is also what writes those rows — so the rate can't
 * drift from the billing table the Super Admin sees. Open trials are excluded:
 * they haven't decided yet, and counting them as losses would make the number
 * worse every time sales generated a lead.
 */
function conversionWindow() {
  let converted = 0;
  let lapsed = 0;

  for (const tenant of getTenants()) {
    const origin = getTenantOrigin(tenant.slug);
    if (origin.daysAgo === null) continue;
    if (origin.daysAgo > CONVERSION_WINDOW_DAYS) continue;
    if (origin.outcome === "CONVERTED") converted++;
    else if (origin.outcome === "LAPSED") lapsed++;
  }

  const decided = converted + lapsed;
  return {
    converted,
    lapsed,
    rate: decided === 0 ? 0 : Math.round((converted / decided) * 100),
  };
}

/** Signups per month over the last six, oldest first. */
function signupTrend(tenants: TenantRow[]) {
  const months: { key: string; label: string; count: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(T0);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push({
      // Sort on a sortable key, never on the formatted label
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", {
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      count: 0,
    });
  }

  for (const t of tenants) {
    const d = new Date(t.createdAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const hit = months.find((m) => m.key === key);
    if (hit) hit.count++;
  }

  return months.map(({ label, count }) => ({ label, count }));
}

export function getSalesStats(): SalesStats {
  const tenants = getTenants();
  const trials = getTrials();
  const board = getSubscriptionBoard();
  const conversion = conversionWindow();

  return {
    openTrials: trials.length,
    needsAction: trials.filter(
      (t) => t.urgency === "EXPIRED" || t.urgency === "CRITICAL",
    ).length,
    expired: trials.filter((t) => t.urgency === "EXPIRED").length,
    unassigned: trials.filter((t) => t.ownerId === null).length,
    mine: trials.filter((t) => t.ownerId === CURRENT_EXEC.id).length,

    conversionRate: conversion.rate,
    converted: conversion.converted,
    lapsed: conversion.lapsed,

    pipelineValue: trials.reduce((a, t) => a + t.monthlyValue, 0),
    signupTrend: signupTrend(tenants),
    pipeline: trials,

    // "Recent signups" (C-SL-01) — any tenant, not just trials. Commercial
    // fields only, same boundary as everywhere else in this file.
    recentSignups: [...tenants]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((t) => ({
        tenantId: t.id,
        name: t.name,
        slug: t.slug,
        planName: t.planName,
        createdAt: t.createdAt,
        ageDays: daysBetween(t.createdAt),
        status: t.status,
        isActive: t.isActive,
        trialEndsAt: t.trialEndsAt,
      })),

    renewalsDue: board.accounts.filter(isRenewingSoon).slice(0, 5),
  };
}

/* ── Quote helper, shared by C-SL-03 and C-SL-04 ────────────────────────── */

/**
 * What a plan costs on a cycle, plus the prorated first charge when billing
 * starts mid-period. Lives here rather than in the client so both pages quote
 * the same number.
 */
export function quote(
  planSlug: string,
  cycle: "MONTHLY" | "YEARLY",
): { plan: PlanRow | undefined; amount: number } {
  const plan = planBySlug(planSlug);
  return { plan, amount: plan ? planPrice(plan, cycle) : 0 };
}
