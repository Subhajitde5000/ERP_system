import type { ModuleKey } from "@/types/auth";
import type {
  AcademicYearRow,
  FeeHeadRow,
  InstitutionSettings,
  LeavePolicyRow,
  ModuleToggle,
  NotificationPreference,
  NotificationRule,
  SalaryDefaults,
  SettingsData,
  SettingsPermissions,
} from "@/types/settings";
import { CHANNELS, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_ROLE } from "./settings";
import { CORE_MODULES, OPTIONAL_MODULES } from "./session";
import { EVENT_META, eventLabel } from "./notification";

/**
 * Settings data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): replace with the real endpoints (PAGE 16, C-RB-16).
 *
 *   GET   /api/v1/settings                      tenant_settings (§4.3)
 *   PATCH /api/v1/settings                      general + branding
 *   GET   /api/v1/settings/modules              tenant_modules (§5.2)
 *   PATCH /api/v1/settings/modules/:key         C-IA-14 — the toggle
 *   GET   /api/v1/academic-years                §6.1
 *   PATCH /api/v1/academic-years/:id/current    set the current year
 *   GET   /api/v1/settings/notifications        C-IA-16 channel matrix
 *   GET   /api/v1/hr/leave-policies             §8.5
 *   PATCH /api/v1/users/me/preferences          personal channels
 *
 * Toggling a module is not a boolean write: §7 says the associated role is
 * created/revoked and data is retained. The endpoint must do all three in one
 * transaction and emit a `MODULE_TOGGLED` notification.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();

const INSTITUTION: InstitutionSettings = {
  name: "ABC College of Engineering",
  shortName: "ABC College",
  type: "COLLEGE",
  email: "office@abc-college.edu",
  phone: "+91 80 4123 7788",
  address: "12 MG Road, Bengaluru, Karnataka 560001",
  website: "https://abc-college.edu",
  timezone: "Asia/Kolkata",
  attendanceThreshold: 75,
  academicYearStartMonth: 6,
  logoUrl: null,
  primaryColor: "#0F172A",
  accentColor: "#4F46E5",
};

/**
 * Users holding each optional module's role, and the rows that survive a
 * disable. §3 promises data is retained, so the toggle shows what would be
 * mothballed rather than making the admin guess.
 */
const MODULE_IMPACT: Record<string, { users: number; records: number }> = {
  library: { users: 2, records: 5240 },
  hostel: { users: 3, records: 18400 },
  transport: { users: 1, records: 2100 },
  placement: { users: 2, records: 860 },
  hr: { users: 2, records: 1450 },
  admission: { users: 3, records: 3200 },
  inventory: { users: 1, records: 640 },
  finance: { users: 4, records: 9800 },
};

/** When each module was switched on, for the audit line in the UI. */
const ENABLED_AT: Record<string, number> = {
  library: 400,
  hostel: 400,
  transport: 210,
  placement: 30,
  hr: 180,
  admission: 365,
  inventory: 95,
  finance: 400,
};

/**
 * The C-IA-14 checklist.
 *
 * Core modules are always on and not toggleable (§3). `enabledModules` comes
 * from the session, so the `?modules=` preview drives this page too — the
 * toggle reflects the same source the sidebar and every module guard read.
 */
export function getModuleToggles(enabled: ModuleKey[]): ModuleToggle[] {
  const row = (key: ModuleKey, isCore: boolean): ModuleToggle => {
    const impact = MODULE_IMPACT[key];
    const on = isCore || enabled.includes(key);

    return {
      key,
      label: MODULE_LABELS[key],
      description: MODULE_DESCRIPTIONS[key],
      isCore,
      isEnabled: on,
      activatesRole: isCore ? null : (MODULE_ROLE[key] ?? null),
      affectedUsers: impact?.users ?? 0,
      retainedRecords: impact?.records ?? 0,
      enabledAt: on && ENABLED_AT[key] ? at(ENABLED_AT[key]!) : null,
      enabledByName: on && !isCore ? "Meera Krishnan" : null,
    };
  };

  return [
    ...CORE_MODULES.map((k) => row(k, true)),
    ...OPTIONAL_MODULES.map((k) => row(k, false)),
  ];
}

/* ── Academic years (§6.1) ──────────────────────────────────────────────── */

/**
 * The institution's academic years — the single owner.
 *
 * Exported because C-IA-04 (`/academic-years`), C-IA-05 (the class year
 * filter) and C-IA-11 (enrolment, which is always *into* a year) all need
 * them. Re-seeding a second list would let the class list filter by a year
 * the settings page has never heard of.
 *
 * §6.1 enforces one `is_current = TRUE` per tenant via a partial unique
 * index, so exactly one row here carries it.
 */
export function getAcademicYears(): AcademicYearRow[] {
  return ACADEMIC_YEARS;
}

const ACADEMIC_YEARS: AcademicYearRow[] = [
  {
    id: "ay-2024",
    name: "2024-25",
    startDate: "2024-06-01",
    endDate: "2025-05-31",
    isCurrent: true,
    classCount: 12,
    studentCount: 1200,
  },
  {
    id: "ay-2023",
    name: "2023-24",
    startDate: "2023-06-01",
    endDate: "2024-05-31",
    isCurrent: false,
    classCount: 11,
    studentCount: 1120,
  },
  {
    id: "ay-2022",
    name: "2022-23",
    startDate: "2022-06-01",
    endDate: "2023-05-31",
    isCurrent: false,
    classCount: 10,
    studentCount: 1040,
  },
];

/* ── Notification rules (C-IA-16, dev doc §12.1) ────────────────────────── */

/**
 * The channel matrix from dev doc §12.1, expressed against the events the
 * notification module already defines — rather than inventing a second list
 * of event names that could drift from `EVENT_META`.
 */
const RULE_CHANNELS: [keyof typeof EVENT_META, ("IN_APP" | "PUSH" | "EMAIL" | "SMS")[]][] = [
  ["ATTENDANCE_MARKED", ["IN_APP", "PUSH", "SMS"]],
  ["CHILD_ABSENT", ["IN_APP", "PUSH", "SMS"]],
  ["EXAM_STARTS_SOON", ["IN_APP", "PUSH"]],
  ["EXAM_RESULT_RELEASED", ["IN_APP", "PUSH", "EMAIL"]],
  ["ASSIGNMENT_DEADLINE_NEAR", ["IN_APP"]],
  ["MILESTONE_UNLOCKED", ["IN_APP", "PUSH"]],
  ["NOTICE_POSTED", ["IN_APP"]],
  ["FEE_DUE", ["IN_APP", "PUSH", "EMAIL"]],
  ["LEAVE_REQUEST_SUBMITTED", ["IN_APP", "EMAIL"]],
  ["MALPRACTICE_FLAGGED", ["IN_APP", "EMAIL"]],
];

function getNotificationRules(): NotificationRule[] {
  return RULE_CHANNELS.map(([event, enabled]) => ({
    event,
    label: eventLabel(event),
    // Every channel is offered; only some are switched on
    channels: [...CHANNELS],
    enabled,
  }));
}

/* ── Fee heads (C-IA-15, §9) ────────────────────────────────────────────── */

const FEE_HEADS: FeeHeadRow[] = [
  { id: "fh1", name: "Tuition fee", amount: 78000, isOptional: false, appliesTo: "All students" },
  { id: "fh2", name: "Laboratory fee", amount: 9000, isOptional: false, appliesTo: "All students" },
  { id: "fh3", name: "Library fee", amount: 3000, isOptional: false, appliesTo: "All students" },
  { id: "fh4", name: "Examination fee", amount: 6000, isOptional: false, appliesTo: "All students" },
  { id: "fh5", name: "Hostel fee", amount: 54000, isOptional: true, appliesTo: "Residents only" },
  { id: "fh6", name: "Transport fee", amount: 18000, isOptional: true, appliesTo: "Route users" },
];

/* ── HR (§8.5) ──────────────────────────────────────────────────────────── */

const LEAVE_POLICIES: LeavePolicyRow[] = [
  { id: "lp1", name: "Casual Leave", code: "CL", daysPerYear: 12, isCarryForward: false, maxCarryForwardDays: 0, appliesTo: ["FULL_TIME", "PART_TIME"], isActive: true },
  { id: "lp2", name: "Sick Leave", code: "SL", daysPerYear: 10, isCarryForward: false, maxCarryForwardDays: 0, appliesTo: ["FULL_TIME", "PART_TIME", "CONTRACT"], isActive: true },
  { id: "lp3", name: "Earned Leave", code: "EL", daysPerYear: 15, isCarryForward: true, maxCarryForwardDays: 30, appliesTo: ["FULL_TIME"], isActive: true },
  { id: "lp4", name: "Maternity Leave", code: "ML", daysPerYear: 182, isCarryForward: false, maxCarryForwardDays: 0, appliesTo: ["FULL_TIME"], isActive: true },
];

/**
 * Percentages the staff-detail salary builder already applies — quoted here
 * rather than re-typed, so the defaults page and the payslips agree.
 */
const SALARY_DEFAULTS: SalaryDefaults = {
  hraPercent: 40,
  daPercent: 20,
  pfPercent: 12,
  professionalTax: 200,
  payrollDay: 28,
};

/* ── Personal preferences ───────────────────────────────────────────────── */

const PREFERENCE_LABELS: Record<string, { label: string; description: string }> =
  {
    IN_APP: {
      label: "In-app",
      description: "Shown in your notification inbox.",
    },
    PUSH: { label: "Push", description: "Sent to your phone or browser." },
    EMAIL: {
      label: "Email",
      description: "Sent to your registered email address.",
    },
    SMS: {
      label: "SMS",
      description: "Text message — urgent alerts only.",
    },
  };

/**
 * A user cannot opt into a channel the institution has switched off for every
 * event — offering the switch would be a lie. `IN_APP` is always on: it is
 * the inbox, not a delivery channel.
 */
function getPreferences(rules: NotificationRule[]): NotificationPreference[] {
  const institutionUses = new Set(rules.flatMap((r) => r.enabled));

  return CHANNELS.map((channel) => ({
    channel,
    label: PREFERENCE_LABELS[channel]!.label,
    description: PREFERENCE_LABELS[channel]!.description,
    enabled: channel !== "SMS",
    lockedByInstitution:
      channel !== "IN_APP" && !institutionUses.has(channel),
  }));
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * Mirrors `GET /api/v1/settings` with the caller's entitlements applied.
 *
 * Sections the role doesn't own are omitted, so an institution's contact
 * details and fee structure never reach a student's payload.
 */
export function getSettingsData(
  perms: SettingsPermissions,
  enabledModules: ModuleKey[],
): SettingsData {
  const keys = new Set(perms.sections.map((s) => s.key));
  const rules = getNotificationRules();

  const data: SettingsData = {
    // The floor — every role has personal preferences
    preferences: getPreferences(rules),
  };

  if (keys.has("GENERAL") || keys.has("BRANDING")) {
    data.institution = INSTITUTION;
  }
  if (keys.has("MODULES")) data.modules = getModuleToggles(enabledModules);
  if (keys.has("ACADEMIC_YEAR")) data.academicYears = ACADEMIC_YEARS;
  if (keys.has("NOTIFICATIONS")) data.notificationRules = rules;
  if (keys.has("FEES")) data.feeHeads = FEE_HEADS;
  if (keys.has("LEAVE_POLICIES")) data.leavePolicies = LEAVE_POLICIES;
  if (keys.has("SALARY_DEFAULTS")) data.salaryDefaults = SALARY_DEFAULTS;

  return data;
}
