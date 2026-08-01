import Link from "next/link";
import { AlertTriangle, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatAge,
  isBreaching,
  SLA_HOURS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
} from "@/lib/support";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { TicketRow } from "@/types/support";

/**
 * Ticket presentation shared by the dashboard (C-SP-01), the list (C-SP-02)
 * and the read-only institution view (C-SP-04). Written once so a ticket
 * looks the same wherever it is shown.
 */

export function PriorityChip({ ticket }: { ticket: TicketRow }) {
  const tone = TICKET_PRIORITY_TONE[ticket.priority];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        tone === "muted" ? "text-[#475569]" : TONE_TEXT[tone],
      )}
    >
      {TICKET_PRIORITY_LABELS[ticket.priority]}
    </span>
  );
}

export function StatusChip({ ticket }: { ticket: TicketRow }) {
  const tone = TICKET_STATUS_TONE[ticket.status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        tone === "muted" ? "text-[#475569]" : TONE_TEXT[tone],
      )}
    >
      {TICKET_STATUS_LABELS[ticket.status]}
    </span>
  );
}

/**
 * Age, flagged when it is past the response target.
 * Only unresolved tickets can breach — a closed ticket's age is history.
 */
export function AgeChip({ ticket }: { ticket: TicketRow }) {
  const breaching = isBreaching(ticket);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
        breaching ? "font-semibold text-destructive-text" : "text-muted-foreground",
      )}
      title={
        breaching
          ? `Past the ${SLA_HOURS[ticket.priority]}h target for ${TICKET_PRIORITY_LABELS[ticket.priority].toLowerCase()} priority`
          : undefined
      }
    >
      {breaching && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      {formatAge(ticket.ageHours)}
      {breaching && <span className="sr-only"> — past response target</span>}
    </span>
  );
}

/** One row in any ticket list. */
export function TicketListItem({ ticket }: { ticket: TicketRow }) {
  return (
    <li className="min-w-0 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/platform/support/tickets/${ticket.id}`}
              className="min-w-0 truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {ticket.subject}
            </Link>
            <PriorityChip ticket={ticket} />
            <StatusChip ticket={ticket} />
          </div>

          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span className="shrink-0 font-mono">{ticket.reference}</span>
            <span className="min-w-0 truncate">{ticket.tenantName}</span>
            <span className="shrink-0">· {ticket.raisedByName}</span>
            {ticket.replyCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                {ticket.replyCount}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <AgeChip ticket={ticket} />
          <span className="text-[11px] text-muted-foreground">
            {ticket.assignedToName ?? (
              <span className="font-medium text-[#B45309]">Unassigned</span>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}
