import type { Tone } from "@/types/dashboard";
import type { TicketPriority, TicketRow, TicketStatus } from "@/types/support";

/**
 * Support Staff logic — C-SP-01…C-SP-04.
 *
 * `role_based_system_design.md` §4.1, verbatim:
 *   - View institution data in read-only mode (for debugging)
 *   - Respond to support tickets
 *   - **Cannot modify institution data or settings**
 *
 * That last line is the whole shape of this section. A support agent may
 * change a *ticket* — status, assignee, replies, all `support_tickets` rows
 * (§4.6) which belong to the platform — but may not change anything inside a
 * tenant. C-SP-04 is therefore a read-only diagnostic view, not an
 * impersonation session that could write.
 */

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
  CLOSED: "muted",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, Tone> = {
  LOW: "muted",
  MEDIUM: "cyan",
  HIGH: "warning",
  CRITICAL: "danger",
};

/** Sort weight — critical first, then high, so the queue self-triages. */
const PRIORITY_RANK: Record<TicketPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** A ticket still needing work. RESOLVED and CLOSED are done. */
export function isOpenTicket(t: { status: TicketStatus }): boolean {
  return t.status === "OPEN" || t.status === "IN_PROGRESS";
}

/**
 * Response-time target by priority, in hours.
 *
 * No doc states an SLA, so it lives here as one table rather than being
 * scattered through the UI — the same call made for `LATE_FINE_PER_DAY`.
 * TODO(Dev-A): belongs in platform settings once the plans carry support
 * tiers; a Premium tenant should not wait as long as a Basic one.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 12,
  MEDIUM: 48,
  LOW: 96,
};

/**
 * Is this ticket past its response target?
 * Only unresolved tickets can breach — a closed ticket's age is history.
 */
export function isBreaching(t: TicketRow): boolean {
  return isOpenTicket(t) && t.ageHours > SLA_HOURS[t.priority];
}

/** Queue order: breaching first, then priority, then oldest. */
export function byTriage(a: TicketRow, b: TicketRow): number {
  const breach = Number(isBreaching(b)) - Number(isBreaching(a));
  if (breach !== 0) return breach;
  const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rank !== 0) return rank;
  return b.ageHours - a.ageHours;
}

/** "3h" / "2d 4h" — compact age for a dense queue. */
export function formatAge(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/**
 * Statuses an agent may move a ticket to from where it is now.
 *
 * A closed ticket is terminal from the support side — reopening is the
 * institution raising a new one — so it offers nothing. Encoding it as a
 * transition map keeps the rule in one place instead of in the dropdown.
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};

/** The signed-in agent. TODO(Dev-A): read from the platform JWT. */
export const CURRENT_AGENT = { id: "pu-2", name: "Nandini Rao" };
