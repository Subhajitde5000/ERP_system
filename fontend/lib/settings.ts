import type { InstitutionRole, ModuleKey } from "@/types/auth";
import type {
  NotificationChannel,
  SettingsPermissions,
  SettingsSection,
  SettingsSectionKey,
} from "@/types/settings";

/**
 * Settings role logic — role_based_shared_pages.md PAGE 16 (C-RB-16).
 *
 * "One URL. Sections shown/hidden per role." Same section-list shape as the
 * detail pages: the matrix is data, the component never names a role.
 *
 * ── Deviations, flagged in the README ─────────────────────────────────────
 *
 * 1. PAGE 16's last row — "All roles: Change password · Profile update" — is
 *    applied as a floor to *every* role, including the five named above it.
 *    Read strictly, the Institution Admin's row omits "Change password",
 *    which can't be intended.
 *
 * 2. The Principal's row says "Academic Year (view)", so that section renders
 *    read-only rather than being hidden — `readOnly` on the section.
 *
 * 3. HR's row lists only leave policies and salary defaults; the "all roles"
 *    floor still gives them password, profile and notification preferences.
 *
 * 4. Roles not named at all (HOD, Accountant, …) get the floor only. Nobody
 *    is denied the page — everyone can change their own password.
 */

const S = (
  key: SettingsSectionKey,
  label: string,
  description: string,
  extra: Partial<SettingsSection> = {},
): SettingsSection => ({ key, label, description, ...extra });

/**
 * PAGE 16's "All roles" row. Every role gets these, so they're appended
 * rather than repeated in each entry.
 */
const FLOOR: SettingsSection[] = [
  S("PROFILE", "Profile", "Your name, photo and contact details.", {
    href: "/profile",
  }),
  S("PASSWORD", "Password", "Change the password you sign in with."),
  S(
    "NOTIFICATION_PREFS",
    "Notifications",
    "Choose how you want to be notified.",
  ),
];

/** Sections above the floor, per the PAGE 16 matrix. */
const ROLE_SECTIONS: Partial<Record<InstitutionRole, SettingsSection[]>> = {
  // "General · Modules (toggle) · Fee Structure · Notifications ·
  //  Academic Year · Branding"
  INSTITUTION_ADMIN: [
    S("GENERAL", "General", "Institution name, contact details and timezone.", {
      href: "/settings/general",
    }),
    S(
      "MODULES",
      "Modules",
      "Turn optional modules on or off for the whole institution.",
      { href: "/settings/modules" },
    ),
    S("ACADEMIC_YEAR", "Academic year", "Years, and which one is current."),
    S("FEES", "Fee structure", "Fee heads for the current academic year.", {
      module: "finance",
      href: "/settings/fees",
    }),
    S(
      "NOTIFICATIONS",
      "Notification rules",
      "Which events trigger push, email or SMS.",
      { href: "/settings/notifications" },
    ),
    S("BRANDING", "Branding", "Logo and accent colour used across the app."),
  ],

  // "Academic Year (view) · Notification preferences"
  PRINCIPAL: [
    S("ACADEMIC_YEAR", "Academic year", "The institution's academic years.", {
      readOnly: true,
    }),
  ],

  // "Leave policies · Salary structure defaults"
  HR_MANAGER: [
    S("LEAVE_POLICIES", "Leave policies", "Leave types, quotas and carry-over.", {
      module: "hr",
    }),
    S(
      "SALARY_DEFAULTS",
      "Salary defaults",
      "Default components applied to new salary structures.",
      { module: "hr" },
    ),
  ],
};

/**
 * Sections for a set of roles: the union of their matrix entries, then the
 * "all roles" floor. A read-only grant is upgraded if another role has the
 * same section without the flag.
 */
export function settingsPermissions(
  roles: InstitutionRole[],
): SettingsPermissions {
  const sections: SettingsSection[] = [];

  for (const role of roles) {
    for (const section of ROLE_SECTIONS[role] ?? []) {
      const at = sections.findIndex((s) => s.key === section.key);
      if (at === -1) sections.push(section);
      // A writable grant supersedes a read-only one
      else if (!section.readOnly) sections[at] = section;
    }
  }

  // PAGE 16: "All roles — Change password · Profile update"
  for (const section of FLOOR) {
    if (!sections.some((s) => s.key === section.key)) sections.push(section);
  }

  const canToggleModules = sections.some(
    (s) => s.key === "MODULES" && !s.readOnly,
  );
  const canManageInstitution = sections.some((s) =>
    (["GENERAL", "MODULES", "FEES", "NOTIFICATIONS", "BRANDING"] as const).includes(
      s.key as "GENERAL",
    ),
  );

  return {
    sections,
    canManageInstitution,
    canToggleModules,
    note: canManageInstitution
      ? "Institution configuration and your own preferences."
      : "Your account and notification preferences.",
  };
}

/** Drop sections whose backing module is switched off for the tenant (§3). */
export function visibleSections(
  perms: SettingsPermissions,
  enabledModules: ModuleKey[],
): SettingsSection[] {
  return perms.sections.filter(
    (s) => !s.module || enabledModules.includes(s.module as ModuleKey),
  );
}

/* ── Module metadata (§3 + §7) ──────────────────────────────────────────── */

/**
 * Which role each optional module activates (§3).
 *
 * ⚠ Doc conflict: §3's checklist lists **7** optional modules and omits
 * `finance`, and the dashboard doc says "11/15". But `packages/shared-types/
 * modules.ts` and §6's permission matrix both treat finance as a real module
 * with the Accountant attached, and the sidebar already gates `/fees` on it.
 * We keep **8 optional + 8 core = 16**, which is the count PROJECT_MEMORY
 * records as canonical. TODO(Dev-A): reconcile §3's checklist.
 */
export const MODULE_ROLE: Record<string, InstitutionRole> = {
  library: "LIBRARIAN",
  hostel: "HOSTEL_WARDEN",
  transport: "TRANSPORT_MANAGER",
  placement: "PLACEMENT_OFFICER",
  hr: "HR_MANAGER",
  admission: "ADMISSION_OFFICER",
  inventory: "STORE_MANAGER",
  finance: "ACCOUNTANT",
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  attendance: "Attendance",
  examination: "Examination",
  assignment: "Assignments & Milestones",
  notice: "Notice Board",
  discussion: "Discussion Forum",
  content: "Content / Notes",
  results: "Results & Analytics",
  timetable: "Timetable",
  library: "Library",
  hostel: "Hostel",
  transport: "Transport",
  placement: "Placement",
  hr: "HR",
  admission: "Admission",
  inventory: "Inventory",
  finance: "Finance & Fees",
};

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  attendance: "Session marking, reports and leave requests.",
  examination: "Online and offline exams, halls, malpractice logs.",
  assignment: "Assignments, milestones and submission review.",
  notice: "Institution, department and class notices.",
  discussion: "Scoped Q&A threads with moderation.",
  content: "Lecture notes, slides and video uploads.",
  results: "Result compilation, approval and grade cards.",
  timetable: "Weekly class and teacher schedules.",
  library: "Catalogue, copies, issue and return.",
  hostel: "Blocks, rooms, allotments and night attendance.",
  transport: "Routes, stops and student assignments.",
  placement: "Companies, drives and student applications.",
  hr: "Staff records, leave, payroll and appraisals.",
  admission: "Applications, merit lists and enrolment.",
  inventory: "Stock, issue requests and purchase orders.",
  finance: "Fee structures, collection and receipts.",
};

/* ── Notification channels (dev doc §12.1) ──────────────────────────────── */

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: "In-app",
  PUSH: "Push",
  EMAIL: "Email",
  SMS: "SMS",
};

export const CHANNEL_DESCRIPTIONS: Record<NotificationChannel, string> = {
  IN_APP: "Shown in your notification inbox.",
  PUSH: "Sent to your phone or browser.",
  EMAIL: "Sent to your registered email address.",
  SMS: "Text message — used sparingly, for urgent alerts.",
};

/** Order channels consistently everywhere they're listed. */
export const CHANNELS: NotificationChannel[] = [
  "IN_APP",
  "PUSH",
  "EMAIL",
  "SMS",
];
