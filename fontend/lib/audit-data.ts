import type { InstitutionRole } from "@/types/auth";

/**
 * Audit log — `complete_webpage_developer_assignment.md` C-IA-18
 * (`/audit-logs`), backed by `audit_logs` (DB §10.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): `GET /api/v1/audit-logs?entity=&actor=&from=&to=&page=`.
 *
 * The table is **append-only** (§10.3) — no UPDATE or DELETE ever runs on it,
 * and there is no write path from the UI. That is the whole point of an audit
 * trail, so this page is read-only for everyone including the Admin.
 *
 * These rows previously lived inside `search-data.ts`, which meant the audit
 * page and global search would have carried two different histories. The log
 * owns them now and search reads from here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (hoursAgo: number) =>
  new Date(T0 - hoursAgo * 60 * 60 * 1000).toISOString();

/** `audit_logs.entity` — what kind of record the action touched. */
export type AuditEntity =
  | "User"
  | "TenantModule"
  | "RoleAssignment"
  | "Result"
  | "Exam"
  | "Notice"
  | "FeePayment"
  | "LeaveRequest";

export interface AuditEntry {
  id: string;
  /** `action` — verb in SCREAMING_SNAKE (§10.3) */
  action: string;
  entity: AuditEntity;
  /** Human label for `entity_id` — what was acted on */
  target: string;
  actorName: string;
  /** `user_role` — the role held at the time, which may since have changed */
  actorRole: InstitutionRole;
  ipAddress: string;
  createdAt: string;
}

/**
 * [hoursAgo, action, entity, target, actor, role]
 *
 * Deliberately spans several actors and entity kinds so the filters have
 * something to bite on, and includes the two events other pages already
 * reference: Ganesh Bhat's deactivation (the inactive row in the user
 * directory) and the Placement module being switched on.
 */
const SEED: [number, string, AuditEntity, string, string, InstitutionRole][] = [
  [7, "USER_DEACTIVATED", "User", "Ganesh Bhat (EMP-2019-0155)", "Meera Krishnan", "INSTITUTION_ADMIN"],
  [26, "MODULE_TOGGLED", "TenantModule", "Placement enabled", "Meera Krishnan", "INSTITUTION_ADMIN"],
  [45, "ROLE_ASSIGNED", "RoleAssignment", "Priya Sharma → Exam Controller", "Meera Krishnan", "INSTITUTION_ADMIN"],
  [70, "RESULT_PUBLISHED", "Result", "Mid-term · FY-A", "Deepak Iyer", "EXAM_CONTROLLER"],
  [74, "RESULT_APPROVED", "Result", "Mid-term · FY-A", "Dr. Sharma", "PRINCIPAL"],
  [96, "EXAM_CREATED", "Exam", "Mid-term Examination — Algorithms", "Priya Sharma", "TEACHER"],
  [120, "NOTICE_PUBLISHED", "Notice", "Mid-term timetable released", "Deepak Iyer", "EXAM_CONTROLLER"],
  [144, "PAYMENT_RECORDED", "FeePayment", "RCPT-ROLL126-2 · ₹48,000", "Suresh Patil", "ACCOUNTANT"],
  [150, "LEAVE_APPROVED", "LeaveRequest", "Priya Sharma · Sick Leave · 2 days", "Anita Desai", "HR_MANAGER"],
  [168, "PASSWORD_RESET", "User", "Latha Venkat (EMP-2024-0603)", "Meera Krishnan", "INSTITUTION_ADMIN"],
  [190, "MODULE_TOGGLED", "TenantModule", "Inventory enabled", "Meera Krishnan", "INSTITUTION_ADMIN"],
  [220, "USER_CREATED", "User", "Neha Rathi (EMP-2023-0512)", "Meera Krishnan", "INSTITUTION_ADMIN"],
];

function buildLog(): AuditEntry[] {
  return SEED.map(([hoursAgo, action, entity, target, actorName, actorRole], i) => ({
    id: `au-${i + 1}`,
    action,
    entity,
    target,
    actorName,
    actorRole,
    // Deterministic per row; the real column is INET from the request
    ipAddress: `10.20.${30 + (i % 4)}.${100 + i}`,
    createdAt: at(hoursAgo),
  }));
}

/** Newest first — an audit trail is read from the top. */
export function getAuditLog(): AuditEntry[] {
  return buildLog().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Entity kinds present, for the filter chips. */
export function getAuditEntities(): AuditEntity[] {
  return [...new Set(buildLog().map((e) => e.entity))].sort();
}

/** Distinct actors, for the actor filter. */
export function getAuditActors(): string[] {
  return [...new Set(buildLog().map((e) => e.actorName))].sort();
}
