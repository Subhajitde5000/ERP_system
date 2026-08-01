import type { ModuleKey } from "./auth";

/**
 * Support Staff contracts — C-SP-01…C-SP-04.
 *
 * Mirrors `support_tickets` (DB §4.6), joined to `tenants` (§4.2),
 * `users` (§5.5, who raised it) and `platform_users` (§4.5, who owns it).
 *
 * ── Gap in the schema, flagged in the README ──────────────────────────────
 * §4.6 has no reply table, but the assignment doc lists
 * `POST /api/v1/platform/tickets/:id/reply` and C-SP-03 asks for a "reply
 * thread". A ticket with a description and a status but no correspondence
 * can't be worked. `TicketReply` below is the shape that endpoint implies —
 * `ticket_replies (id, ticket_id, author_id, author_kind, body, is_internal,
 * created_at)` — and is marked TODO(Dev-A) so the table gets added rather
 * than the UI quietly inventing it.
 */

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** Who wrote a reply — platform side or institution side. */
export type ReplyAuthorKind = "SUPPORT" | "INSTITUTION";

export interface TicketReply {
  id: string;
  authorName: string;
  authorKind: ReplyAuthorKind;
  /** Role at the time, e.g. "Support Staff" or "Institution Admin" */
  authorRole: string;
  body: string;
  /**
   * An internal note is visible to platform staff only — the institution
   * never sees it. Kept explicit so the UI can't leak one by accident.
   */
  isInternal: boolean;
  createdAt: string;
}

export interface TicketRow {
  id: string;
  /** Human reference, e.g. TKT-1042 */
  reference: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  /** `tenants.name` / `.slug` (§4.2) */
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  /** `users.name` — the institution admin who raised it (§5.5) */
  raisedByName: string;
  raisedByRole: string;
  /** `platform_users.name`, null when unassigned (§4.5) */
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  /** Derived from the replies, so the list can show conversation depth */
  replyCount: number;
  /** Derived: hours since raised, for the SLA column */
  ageHours: number;
}

export interface TicketDetail {
  ticket: TicketRow;
  replies: TicketReply[];
}

/** C-SP-01 — dashboard KPIs. */
export interface SupportStats {
  open: number;
  inProgress: number;
  resolvedToday: number;
  unassigned: number;
  /** Tickets assigned to the signed-in agent, still open */
  mine: number;
  byPriority: { priority: TicketPriority; count: number }[];
  /** Oldest unresolved first — the queue that needs attention */
  oldestOpen: TicketRow[];
  /** Mine, newest first */
  myQueue: TicketRow[];
}

/* ── C-SP-04 Institution Read-Only View ─────────────────────────────────── */

/**
 * §4.1: Support Staff "view institution data in read-only mode (for
 * debugging)" and "cannot modify institution data or settings". §2.1 calls
 * this "impersonate (read-only) for debugging".
 *
 * So this is a **diagnostic snapshot**, not the institution app rendered with
 * a support login. It answers "is their setup broken?" — plan, modules,
 * counts, recent activity — without exposing student records, marks or fees,
 * none of which a support agent needs to debug a login or a module toggle.
 */
export interface InstitutionSnapshot {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  type: string;
  planName: string;
  isActive: boolean;
  status: string;
  createdAt: string;
  /** Health checks a support agent actually acts on */
  checks: { label: string; value: string; ok: boolean; hint?: string }[];
  /** Modules on, against what the plan allows */
  enabledModules: ModuleKey[];
  allowedModules: ModuleKey[];
  /** Headcount, for "why are they over their cap?" */
  studentCount: number;
  teacherCount: number;
  maxStudents: number;
  maxTeachers: number;
  storageUsedGb: number;
  maxStorageGb: number;
  /** Recent admin actions in that tenant (§10.3) */
  recentActivity: {
    id: string;
    action: string;
    target: string;
    actorName: string;
    createdAt: string;
  }[];
  /** Their open tickets, so the agent has context in one place */
  openTickets: TicketRow[];
}
