import type { ModuleKey, PlatformRole } from "@/types/auth";
import type {
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
import { moduleLabel, ROOT_DOMAIN_LABEL } from "./platform-shared";
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
  ["heritage-school", "Heritage School", "SCHOOL", "standard", "ACTIVE", true, 1180, 78, 31, "Kolkata", "West Bengal", 300, null],
  // Suspended: is_active false while the subscription still reads ACTIVE —
  // the two columns are independent (§4.2 vs §4.4).
  ["orchid-college", "Orchid College", "COLLEGE", "basic", "ACTIVE", false, 460, 34, 9, "Kochi", "Kerala", 210, null],
  ["pinnacle-school", "Pinnacle School", "SCHOOL", "basic", "CANCELLED", false, 240, 18, 3, "Indore", "Madhya Pradesh", 470, null],
];

/** Modules each tenant has switched on — capped by its plan (§5.2). */
const TENANT_MODULES: Record<string, ModuleKey[]> = {
  "abc-college": [...ALL_MODULES],
  "dps-school": [...CORE_MODULES, "library", "transport", "finance"],
  "nova-university": [...ALL_MODULES],
  "greenwood-high": [...CORE_MODULES],
  "sunrise-academy": [...CORE_MODULES],
  "metro-institute": [...CORE_MODULES, "library", "hostel", "finance"],
  "heritage-school": [...CORE_MODULES, "library", "transport", "finance"],
  "orchid-college": [...CORE_MODULES],
  "pinnacle-school": [...CORE_MODULES],
};

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

/** Billing history (§4.4), derived so the amount always matches the plan. */
function buildSubscriptions(tenant: TenantRow): SubscriptionRow[] {
  const plan = planFor(tenant.planSlug);
  const years = Math.max(1, Math.round((T0 - Date.parse(tenant.createdAt)) / (365 * DAY)));

  return Array.from({ length: Math.min(3, years) }, (_, i) => ({
    id: `sub-${tenant.slug}-${i + 1}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    planName: plan.name,
    // Only the newest row carries the tenant's current status
    status: i === 0 ? tenant.status : ("ACTIVE" as SubscriptionStatus),
    startsAt: at(365 * (i + 1)),
    endsAt: at(365 * i),
    amount: plan.priceYearly,
    currency: plan.currency,
    paymentReference: tenant.status === "TRIAL" && i === 0 ? null : `PAY-${tenant.slug.toUpperCase().slice(0, 4)}-${2026 - i}`,
  }));
}

export function getTenantDetail(id: string): TenantDetail | undefined {
  const tenant = getTenant(id);
  if (!tenant) return undefined;

  return {
    tenant,
    subscriptions: buildSubscriptions(tenant),
    adminName: tenant.slug === "abc-college" ? "Meera Krishnan" : "Institution Admin",
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

  // MRR counts only tenants actually paying — trials and suspensions don't
  const mrr = tenants
    .filter((t) => t.isActive && (t.status === "ACTIVE" || t.status === "PAST_DUE"))
    .reduce(
      (a, t) => a + (plans.find((p) => p.slug === t.planSlug)?.priceMonthly ?? 0),
      0,
    );

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
