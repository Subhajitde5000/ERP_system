import type { ModuleKey, PlatformRole } from "@/types/auth";
import type {
  BillingCycle,
  PlanRow,
  PlatformAuditEntry,
  PlatformSettings,
  PlatformStats,
  PlatformUserRow,
  SubscriptionRow,
  SubscriptionStatus,
  TenantDetail,
  TenantRow,
  TenantType,
} from "@/types/platform";
import { ALL_MODULES, CORE_MODULES, OPTIONAL_MODULES } from "./session";
import { moduleLabel, ROOT_DOMAIN_LABEL, toMrr } from "./platform-shared";
import { getInstitutionSummary as getAttendanceByDepartment } from "./attendance-data";
import { getStaffDirectory } from "./staff-detail-data";
import { getAuditLog } from "./audit-data";

/**
 * Platform console data source — C-SA-01…C-SA-08.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): the platform API (§2 of the assignment doc):
 *
 *   GET/POST/PATCH/DELETE /api/v1/platform/tenants
 *   GET/POST/PATCH        /api/v1/platform/plans
 *   GET/POST/PATCH        /api/v1/platform/users
 *   GET                   /api/v1/platform/audit-logs
 *   GET                   /api/v1/platform/dashboard-stats
 *
 * **ABC College is the tenant the rest of this app runs as.** Its headcount
 * here is summed from the institution's own department table and staff
 * directory, so the platform's "1,059 users" and the institution's own
 * numbers can't tell different stories — the same one-owner rule that keeps
 * fees, library and hostel consistent across the institution pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();

/* ── §4.1 plans ─────────────────────────────────────────────────────────── */

/** [slug, name, maxStudents, maxTeachers, storageGb, monthly, yearly, modules] */
const PLAN_SEED: [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  ModuleKey[],
][] = [
  ["basic", "Basic", 500, 40, 10, 4999, 49_990, [...CORE_MODULES]],
  [
    "standard",
    "Standard",
    2000,
    150,
    50,
    12_999,
    129_990,
    [...CORE_MODULES, "library", "hostel", "transport", "finance"],
  ],
  // -1 = unlimited (§4.1)
  ["premium", "Premium", -1, -1, 500, 24_999, 249_990, [...ALL_MODULES]],
];

/* ── §4.2 tenants ───────────────────────────────────────────────────────── */

/**
 * The three tenants `lib/tenant.ts` already knows about, plus enough others
 * to make the list, the filters and the plan mix meaningful.
 *
 * `abc-college` is the live one — every institution page in this app renders
 * as that tenant, so its counts are derived rather than typed.
 *
 * [slug, name, type, planSlug, status, isActive, students, teachers,
 *  storageGb, city, state, createdDaysAgo, trialDaysLeft|null]
 */
type TenantSeed = [
  string,
  string,
  TenantType,
  string,
  SubscriptionStatus,
  boolean,
  number,
  number,
  number,
  string,
  string,
  number,
  number | null,
];

const TENANT_SEED: TenantSeed[] = [
  ["abc-college", "ABC College of Engineering", "COLLEGE", "premium", "ACTIVE", true, 0, 0, 182, "Bengaluru", "Karnataka", 640, null],
  ["dps-school", "DPS School", "SCHOOL", "standard", "ACTIVE", true, 1420, 96, 38, "Delhi", "Delhi", 520, null],
  ["nova-university", "Nova University", "COLLEGE", "premium", "ACTIVE", true, 8600, 540, 410, "Pune", "Maharashtra", 880, null],
  ["greenwood-high", "Greenwood High", "SCHOOL", "basic", "TRIAL", true, 310, 22, 4, "Hyderabad", "Telangana", 18, 12],
  ["sunrise-academy", "Sunrise Academy", "SCHOOL", "basic", "TRIAL", true, 180, 14, 2, "Jaipur", "Rajasthan", 6, 24],
  ["metro-institute", "Metro Institute of Technology", "COLLEGE", "standard", "PAST_DUE", true, 1950, 128, 47, "Chennai", "Tamil Nadu", 400, null],
  // Bought Premium and never grew into it: 1,180 students and 31 GB fit
  // Standard comfortably. This is the account a sales desk actually
  // *downgrades* to retain — without one, the downgrade half of §4.1's
  // "upgrade / downgrade subscription plans" is unreachable in the console
  // and reads as broken.
  ["heritage-school", "Heritage School", "SCHOOL", "premium", "ACTIVE", true, 1180, 78, 31, "Kolkata", "West Bengal", 300, null],
  // Suspended: is_active false while the subscription still reads ACTIVE —
  // the two columns are independent (§4.2 vs §4.4).
  ["orchid-college", "Orchid College", "COLLEGE", "basic", "ACTIVE", false, 460, 34, 9, "Kochi", "Kerala", 210, null],
  ["pinnacle-school", "Pinnacle School", "SCHOOL", "basic", "CANCELLED", false, 240, 18, 3, "Indore", "Madhya Pradesh", 470, null],
  // ── Live trial pipeline, for the Sales console (C-SL-01…04) ───────────
  // Spread across every urgency band so an expired trial, a closing one and
  // a healthy one are all reachable: a queue that only ever shows one state
  // hides the actions built for the others.
  ["vidya-college", "Vidya College of Arts & Science", "COLLEGE", "premium", "TRIAL", true, 620, 44, 12, "Coimbatore", "Tamil Nadu", 32, -2],
  ["springfield-school", "Springfield International School", "SCHOOL", "standard", "TRIAL", true, 840, 58, 14, "Nagpur", "Maharashtra", 28, 2],
  ["techno-institute", "Techno Institute of Management", "COLLEGE", "standard", "TRIAL", true, 1150, 74, 22, "Bhubaneswar", "Odisha", 24, 6],
  // Converted inside the conversion window, so the rate has a numerator
  ["crescent-public", "Crescent Public School", "SCHOOL", "standard", "ACTIVE", true, 1020, 68, 26, "Lucknow", "Uttar Pradesh", 95, null],
  // Trialled and never paid — the denominator
  ["lakeview-academy", "Lakeview Academy", "SCHOOL", "basic", "CANCELLED", false, 260, 19, 3, "Nashik", "Maharashtra", 140, null],
];

/** Modules each tenant has switched on — capped by its plan (§5.2). */
const TENANT_MODULES: Record<string, ModuleKey[]> = {
  "abc-college": [...ALL_MODULES],
  "dps-school": [...CORE_MODULES, "library", "transport", "finance"],
  "nova-university": [...ALL_MODULES],
  "greenwood-high": [...CORE_MODULES],
  "sunrise-academy": [...CORE_MODULES],
  "metro-institute": [...CORE_MODULES, "library", "hostel", "finance"],
  // All within Standard's allowance, so a downgrade warns about nothing and
  // is simply the right call — the clean case, next to ABC's blocked one
  "heritage-school": [...CORE_MODULES, "library", "hostel", "transport", "finance"],
  "orchid-college": [...CORE_MODULES],
  "pinnacle-school": [...CORE_MODULES],
  // Vidya trialled Premium and switched Placement on — Standard doesn't
  // license it, so the convert form has a real trade-off to surface.
  "vidya-college": [...CORE_MODULES, "library", "placement", "finance"],
  "springfield-school": [...CORE_MODULES, "library", "transport"],
  "techno-institute": [...CORE_MODULES, "library", "hostel", "finance"],
  "crescent-public": [...CORE_MODULES, "library", "transport", "finance"],
  "lakeview-academy": [...CORE_MODULES],
};

/**
 * How each tenant arrived, and how it is billed.
 *
 * `tenants.trial_ends_at` is documented "NULL = not on trial" (§4.2), so once
 * a trial closes the tenant row remembers nothing about it. The history lives
 * in `subscriptions` (§4.4, "Billing history per tenant") — a TRIAL row
 * followed by an ACTIVE one is a conversion; a TRIAL row with nothing after
 * it lapsed. This seed is what `buildSubscriptions()` writes those rows from,
 * so the Sales console's conversion rate is read out of billing history
 * rather than being a second, hand-typed number.
 *
 * `outcome`:
 *   CONVERTED — trialled, then paid (`daysAgo` = when billing began)
 *   LAPSED    — trialled, never paid (`daysAgo` = when the trial expired)
 *   OPEN      — still on trial; the tenant row's `trial_ends_at` is live
 *   DIRECT    — signed straight onto a paid plan, no trial
 *
 * `cycle` is not a column: §4.4 stores `starts_at`/`ends_at`, so the billing
 * cycle is the length of the period. This decides that length.
 */
type TrialOutcome = "CONVERTED" | "LAPSED" | "OPEN" | "DIRECT";

const TENANT_ORIGIN: Record<
  string,
  { outcome: TrialOutcome; daysAgo: number | null; cycle: BillingCycle }
> = {
  "abc-college": { outcome: "CONVERTED", daysAgo: 610, cycle: "YEARLY" },
  "dps-school": { outcome: "CONVERTED", daysAgo: 490, cycle: "YEARLY" },
  "nova-university": { outcome: "DIRECT", daysAgo: null, cycle: "YEARLY" },
  "metro-institute": { outcome: "DIRECT", daysAgo: null, cycle: "MONTHLY" },
  "heritage-school": { outcome: "CONVERTED", daysAgo: 270, cycle: "YEARLY" },
  "orchid-college": { outcome: "CONVERTED", daysAgo: 176, cycle: "MONTHLY" },
  "pinnacle-school": { outcome: "CONVERTED", daysAgo: 440, cycle: "YEARLY" },
  "crescent-public": { outcome: "CONVERTED", daysAgo: 66, cycle: "MONTHLY" },
  "lakeview-academy": { outcome: "LAPSED", daysAgo: 108, cycle: "MONTHLY" },
  "greenwood-high": { outcome: "OPEN", daysAgo: null, cycle: "MONTHLY" },
  "sunrise-academy": { outcome: "OPEN", daysAgo: null, cycle: "MONTHLY" },
  "vidya-college": { outcome: "OPEN", daysAgo: null, cycle: "YEARLY" },
  "springfield-school": { outcome: "OPEN", daysAgo: null, cycle: "MONTHLY" },
  "techno-institute": { outcome: "OPEN", daysAgo: null, cycle: "MONTHLY" },
};

const DEFAULT_ORIGIN = {
  outcome: "DIRECT" as TrialOutcome,
  daysAgo: null,
  cycle: "YEARLY" as BillingCycle,
};

/**
 * Trial provenance for one tenant, for the Sales console.
 * Exported from here rather than re-seeded in `sales-data` so there is
 * exactly one place that says how a tenant arrived.
 */
export function getTenantOrigin(slug: string) {
  return TENANT_ORIGIN[slug] ?? DEFAULT_ORIGIN;
}

/**
 * The Institution Admin who signed the tenant up — `users` (§5.5), the
 * account with the INSTITUTION_ADMIN role assignment (§5.6).
 *
 * This is a **commercial** contact, not academic data: it is who Sales and
 * Support phone, and it is the same person the Super Admin's tenant detail
 * names. One table, so a trial card, a ticket and a tenant record can't
 * disagree about who to call. Every tenant needs a real name — the fallback
 * rendered five different institutions as "Institution Admin", which reads
 * as missing data and is useless on a call sheet.
 */
const TENANT_ADMIN: Record<string, string> = {
  "abc-college": "Meera Krishnan",
  "dps-school": "Sunita Pillai",
  "nova-university": "Farah Sheikh",
  "greenwood-high": "Anil Kapoor",
  "sunrise-academy": "Kavya Menon",
  "metro-institute": "Rajesh Verma",
  "heritage-school": "Nikhil Joshi",
  "orchid-college": "Thomas Mathew",
  "pinnacle-school": "Shalini Dubey",
  "vidya-college": "Lakshmi Narayanan",
  "springfield-school": "Gurpreet Singh",
  "techno-institute": "Debashish Panda",
  "crescent-public": "Zoya Ahmed",
  "lakeview-academy": "Prakash Deshmukh",
};

export function getTenantAdminName(slug: string): string {
  return TENANT_ADMIN[slug] ?? "Institution Admin";
}

/**
 * ABC College's real headcount, read from the institution app's own data.
 * Typing a number here would let the platform claim 1,200 students while the
 * Admin dashboard shows 910.
 */
function abcCollegeCounts() {
  const students = getAttendanceByDepartment().reduce(
    (a, d) => a + d.studentCount,
    0,
  );
  const teachers = getStaffDirectory().filter((s) => s.isActive).length;
  return { students, teachers };
}

function planFor(slug: string): PlanRow {
  return getPlans().find((p) => p.slug === slug) ?? getPlans()[0]!;
}

function buildTenants(): TenantRow[] {
  const abc = abcCollegeCounts();

  return TENANT_SEED.map(
    ([
      slug, name, type, planSlug, status, isActive,
      students, teachers, storageGb, city, state, createdDaysAgo, trialLeft,
    ]) => {
      const plan = planFor(planSlug);
      const live = slug === "abc-college";

      return {
        id: `t-${slug}`,
        name,
        slug,
        type,
        planName: plan.name,
        planSlug: plan.slug,
        status,
        isActive,
        studentCount: live ? abc.students : students,
        teacherCount: live ? abc.teachers : teachers,
        enabledModules: TENANT_MODULES[slug] ?? [...CORE_MODULES],
        storageUsedGb: storageGb,
        city,
        state,
        email: `admin@${slug}.edu`,
        phone: "+91 80 4000 1200",
        website: `https://${slug}.edu`,
        timezone: "Asia/Kolkata",
        trialEndsAt: trialLeft === null ? null : at(-trialLeft),
        createdAt: at(createdDaysAgo),
      };
    },
  );
}

/* ── Public reads ───────────────────────────────────────────────────────── */

export function getPlans(): PlanRow[] {
  // Tenant count per plan is derived from the seed, not stored twice
  const counts = new Map<string, number>();
  for (const [, , , planSlug] of TENANT_SEED) {
    counts.set(planSlug, (counts.get(planSlug) ?? 0) + 1);
  }

  return PLAN_SEED.map(
    ([slug, name, maxStudents, maxTeachers, maxStorageGb, priceMonthly, priceYearly, allowedModules]) => ({
      id: `plan-${slug}`,
      name,
      slug,
      maxStudents,
      maxTeachers,
      maxStorageGb,
      priceMonthly,
      priceYearly,
      currency: "INR",
      allowedModules,
      isActive: true,
      tenantCount: counts.get(slug) ?? 0,
    }),
  );
}

export function getTenants(): TenantRow[] {
  return buildTenants().sort((a, b) => a.name.localeCompare(b.name));
}

export function getTenant(id: string): TenantRow | undefined {
  return buildTenants().find((t) => t.id === id || t.slug === id);
}

export function getTenantIds(): string[] {
  return buildTenants().map((t) => t.id);
}

/**
 * Billing history (§4.4), derived so the amount always matches the plan.
 *
 * The oldest row is the **trial**, when the tenant had one: §4.4 is the only
 * place that history survives, because `tenants.trial_ends_at` goes NULL the
 * moment a trial ends (§4.2). Reading conversion out of these rows means the
 * Sales dashboard's rate and the Super Admin's billing table can't disagree.
 *
 * A trial row is priced at 0 — nobody is charged during one — and carries no
 * `payment_reference`, which is exactly what the column means.
 */
function buildSubscriptions(tenant: TenantRow): SubscriptionRow[] {
  const plan = planFor(tenant.planSlug);
  const origin = getTenantOrigin(tenant.slug);
  const periodDays = origin.cycle === "YEARLY" ? 365 : 30;
  const amount = origin.cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
  const ageDays = Math.round((T0 - Date.parse(tenant.createdAt)) / DAY);

  const trialRow = (startDaysAgo: number, endDaysAgo: number): SubscriptionRow => ({
    id: `sub-${tenant.slug}-trial`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    planName: plan.name,
    status: "TRIAL",
    startsAt: at(startDaysAgo),
    endsAt: at(endDaysAgo),
    // Nobody is charged during a trial, and there is no payment to reference
    amount: 0,
    currency: plan.currency,
    paymentReference: null,
    cycle: origin.cycle,
  });

  if (tenant.status === "TRIAL") {
    // Still trialling: one open row, ending when `trial_ends_at` says
    const endsIn = tenant.trialEndsAt
      ? Math.round((Date.parse(tenant.trialEndsAt) - T0) / DAY)
      : 0;
    return [trialRow(ageDays, -endsIn)];
  }

  if (origin.outcome === "LAPSED" && origin.daysAgo !== null) {
    // Trialled and walked away — an expired trial row, nothing after it
    return [trialRow(origin.daysAgo + 30, origin.daysAgo)];
  }

  const rows: SubscriptionRow[] = [];

  // When paid billing began: the conversion date, or signup for a direct sale
  const anchor = origin.outcome === "CONVERTED" && origin.daysAgo !== null
    ? origin.daysAgo
    : ageDays;

  if (origin.outcome === "CONVERTED") {
    // The 30-day trial that preceded billing (platform settings §C-SA-08)
    rows.push(trialRow(anchor + 30, anchor));
  }

  /**
   * Periods run from `anchor`, so the current one ends at a real per-tenant
   * date rather than "today" for everybody. Anchoring on `i * periodDays`
   * back from T0 instead made all nine accounts renew on the same day — the
   * per-record rule that is wrong in aggregate.
   */
  const elapsed = Math.max(0, Math.floor(anchor / periodDays));
  const shown = Math.min(3, elapsed + 1);

  for (let i = shown - 1; i >= 0; i--) {
    // 0 = the live period, which ends in the future (negative "days ago")
    const startDaysAgo = anchor - (elapsed - i) * periodDays;
    rows.push({
      id: `sub-${tenant.slug}-${elapsed - i + 1}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      planName: plan.name,
      // Only the live row carries the tenant's current status
      status: i === 0 ? tenant.status : ("ACTIVE" as SubscriptionStatus),
      startsAt: at(startDaysAgo),
      endsAt: at(startDaysAgo - periodDays),
      amount,
      currency: plan.currency,
      // Slug prefix, letters only — `slice(0, 4)` on "abc-college" produced
      // "PAY-ABC--1" with the hyphen baked in.
      paymentReference: `PAY-${paymentPrefix(tenant.slug)}-${elapsed - i + 1}`,
      cycle: origin.cycle,
    });
  }

  return rows;
}

/** First four alphanumerics of a slug, uppercased — "abc-college" → "ABCC". */
function paymentPrefix(slug: string): string {
  return slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4);
}

/** Billing history for one tenant — the single read every console shares. */
export function getSubscriptions(tenantId: string): SubscriptionRow[] {
  const tenant = getTenant(tenantId);
  return tenant ? buildSubscriptions(tenant) : [];
}

/**
 * The live paid period for a tenant, or null if it has never paid.
 * One definition of "what they are on right now", shared by the Super Admin
 * dashboard's MRR and the Sales subscription board (C-SL-04).
 */
export function getCurrentSubscription(
  tenantId: string,
): SubscriptionRow | null {
  const paid = getSubscriptions(tenantId).filter((s) => s.status !== "TRIAL");
  return paid[paid.length - 1] ?? null;
}

/**
 * Monthly recurring revenue for one tenant.
 *
 * Zero unless money is actually being collected: a trial pays nothing, a
 * cancelled subscription has stopped, and a suspended tenant is locked out —
 * `is_active` (§4.2) and `subscriptions.status` (§4.4) are independent, and
 * booking revenue from an institution nobody can sign into would flatter the
 * number. A yearly commitment is divided by 12 so both cycles can be summed.
 */
export function tenantMrr(tenant: TenantRow): number {
  if (!tenant.isActive) return 0;
  if (tenant.status !== "ACTIVE" && tenant.status !== "PAST_DUE") return 0;
  const current = getCurrentSubscription(tenant.id);
  return current ? toMrr(current.amount, current.cycle) : 0;
}

export function getTenantDetail(id: string): TenantDetail | undefined {
  const tenant = getTenant(id);
  if (!tenant) return undefined;

  return {
    tenant,
    subscriptions: buildSubscriptions(tenant),
    adminName: getTenantAdminName(tenant.slug),
    adminEmail: tenant.email ?? "",
    // The institution's own audit trail, surfaced read-only (§4.1 audit-only)
    recentActivity:
      tenant.slug === "abc-college"
        ? getAuditLog()
            .slice(0, 6)
            .map((e) => ({
              id: e.id,
              action: e.action,
              entity: e.entity,
              target: e.target,
              actorName: e.actorName,
              actorRole: e.actorRole,
              tenantName: tenant.name,
              ipAddress: e.ipAddress,
              createdAt: e.createdAt,
            }))
        : [],
    openTickets: tenant.slug === "metro-institute" ? 3 : tenant.slug === "abc-college" ? 1 : 0,
  };
}

/* ── §4.5 platform_users ────────────────────────────────────────────────── */

const PLATFORM_USER_SEED: [string, string, PlatformRole, boolean, number | null][] = [
  ["Vikram Sethi", "vikram.sethi@xyz.com", "SUPER_ADMIN", true, 2],
  ["Nandini Rao", "nandini.rao@xyz.com", "SUPPORT_STAFF", true, 6],
  ["Imtiaz Khan", "imtiaz.khan@xyz.com", "SUPPORT_STAFF", true, 30],
  ["Rohit Bansal", "rohit.bansal@xyz.com", "SALES_EXECUTIVE", true, 12],
  ["Aparna Iyer", "aparna.iyer@xyz.com", "SALES_EXECUTIVE", true, 4],
  ["Sanjay Mehta", "sanjay.mehta@xyz.com", "FINANCE_MANAGER", true, 20],
  // Never signed in, and one deactivated — both real states the admin
  // must be able to spot (§4.5 `last_login_at`, `is_active`).
  ["Preeti Nair", "preeti.nair@xyz.com", "SUPPORT_STAFF", true, null],
  ["Deepak Bose", "deepak.bose@xyz.com", "SALES_EXECUTIVE", false, 180],
];

export function getPlatformUsers(): PlatformUserRow[] {
  return PLATFORM_USER_SEED.map(([name, email, role, isActive, loginDaysAgo], i) => ({
    id: `pu-${i + 1}`,
    name,
    email,
    role,
    isActive,
    lastLoginAt: loginDaysAgo === null ? null : at(loginDaysAgo),
    createdAt: at(300 + i * 40),
  }));
}

/* ── §10.3 global audit log ─────────────────────────────────────────────── */

/** Platform-level actions — `tenant_id` is NULL for these (§10.3). */
const PLATFORM_AUDIT_SEED: [number, string, string, string, string][] = [
  [3, "TENANT_SUSPENDED", "Tenant", "Orchid College", "Vikram Sethi"],
  [9, "PLAN_UPDATED", "Plan", "Standard · ₹12,999/mo", "Vikram Sethi"],
  [16, "TENANT_CREATED", "Tenant", "Sunrise Academy", "Rohit Bansal"],
  [28, "PLATFORM_USER_CREATED", "PlatformUser", "Preeti Nair · Support Staff", "Vikram Sethi"],
  [44, "TENANT_CREATED", "Tenant", "Greenwood High", "Aparna Iyer"],
  [61, "PLAN_CREATED", "Plan", "Premium", "Vikram Sethi"],
];

/**
 * The global trail: platform actions plus every tenant's own audit rows.
 * The institution entries are read from `audit-data`, so the platform view
 * and the tenant's own `/audit-logs` page show the same history.
 */
export function getPlatformAudit(): PlatformAuditEntry[] {
  const platform: PlatformAuditEntry[] = PLATFORM_AUDIT_SEED.map(
    ([hoursAgo, action, entity, target, actorName], i) => ({
      id: `pa-${i + 1}`,
      action,
      entity,
      target,
      actorName,
      actorRole: actorName === "Vikram Sethi" ? "Super Admin" : "Sales Executive",
      tenantName: null,
      ipAddress: `52.66.${10 + i}.${40 + i}`,
      createdAt: new Date(T0 - hoursAgo * 60 * 60 * 1000).toISOString(),
    }),
  );

  const tenant: PlatformAuditEntry[] = getAuditLog().map((e) => ({
    id: `t-${e.id}`,
    action: e.action,
    entity: e.entity,
    target: e.target,
    actorName: e.actorName,
    actorRole: e.actorRole,
    tenantName: "ABC College of Engineering",
    ipAddress: e.ipAddress,
    createdAt: e.createdAt,
  }));

  return [...platform, ...tenant].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/* ── C-SA-01 dashboard ──────────────────────────────────────────────────── */

export function getPlatformStats(): PlatformStats {
  const tenants = getTenants();
  const plans = getPlans();

  const active = tenants.filter((t) => t.isActive && t.status === "ACTIVE");
  const trial = tenants.filter((t) => t.status === "TRIAL");
  const suspended = tenants.filter((t) => !t.isActive);

  // MRR counts only tenants actually paying — trials and suspensions don't.
  // `tenantMrr` is the one definition, shared with the Sales board (C-SL-04),
  // and reads each tenant's real billing cycle rather than assuming monthly.
  const mrr = tenants.reduce((a, t) => a + tenantMrr(t), 0);

  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const revenueTrend = months.map((label, i) => ({
    label: `${label} 26`,
    // Grows toward the current MRR rather than being hand-typed
    amount: Math.round(mrr * (0.72 + i * 0.056)),
  }));

  const planMix = plans.map((p) => ({ plan: p.name, count: p.tenantCount }));

  return {
    totalInstitutions: tenants.length,
    activeInstitutions: active.length,
    trialInstitutions: trial.length,
    suspendedInstitutions: suspended.length,
    totalStudents: tenants.reduce((a, t) => a + t.studentCount, 0),
    totalTeachers: tenants.reduce((a, t) => a + t.teacherCount, 0),
    mrr,
    openTickets: 7,
    criticalTickets: 2,
    revenueTrend,
    planMix,
    recentTenants: [...tenants]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}

/* ── C-SA-08 settings ───────────────────────────────────────────────────── */

export function getPlatformSettings(): PlatformSettings {
  return {
    productName: "xyz.com",
    supportEmail: "support@xyz.com",
    rootDomain: ROOT_DOMAIN_LABEL,
    allowedModules: [
      ...CORE_MODULES.map((key) => ({ key, label: moduleLabel(key), core: true })),
      ...OPTIONAL_MODULES.map((key) => ({ key, label: moduleLabel(key), core: false })),
    ],
    defaultTimezone: "Asia/Kolkata",
    defaultCurrency: "INR",
    trialLengthDays: 30,
    brandPrimary: "#0F172A",
    brandAccent: "#4F46E5",
  };
}
