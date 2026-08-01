"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, EyeOff, Lock, Send, ShieldAlert } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  CURRENT_AGENT,
  isBreaching,
  SLA_HOURS,
  STATUS_TRANSITIONS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/support";
import { FormAlert } from "@/components/auth/form-alert";
import { Card } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { AgeChip, PriorityChip, StatusChip } from "./ticket-bits";
import type { TicketDetail as Detail } from "@/types/support";

/**
 * C-SP-03 — Ticket Detail.
 * "View ticket + reply thread + change status"
 *
 * A support agent may change the *ticket* — it is a `support_tickets` row
 * (§4.6), platform-owned. What they may not do is change anything inside the
 * institution (§4.1), which is why the only link into the tenant is the
 * read-only diagnostic view.
 */
export function TicketDetail({ detail }: { detail: Detail }) {
  const { ticket, replies } = detail;
  const [status, setStatus] = useState(ticket.status);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const transitions = STATUS_TRANSITIONS[status];
  const closed = status === "CLOSED";

  async function onReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (!body.trim()) {
      setError("Write a reply before sending.");
      return;
    }
    setError(null);
    setBusy(true);
    // TODO(Dev-A): POST /api/v1/platform/tickets/:id/reply
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    setBody("");
    setNotice(
      `POST /platform/tickets/${ticket.id}/reply { internal: ${internal} } — API not connected yet (Dev-A, C-SP-03).`,
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/platform/support/tickets"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All tickets
      </Link>

      <div className="mb-1 flex min-w-0 flex-wrap items-start gap-2">
        <h1 className="min-w-0 font-display text-[22px] font-bold text-foreground">
          {ticket.subject}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
          <PriorityChip ticket={ticket} />
          <StatusChip ticket={{ ...ticket, status }} />
        </div>
      </div>

      <p className="mb-4 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span className="shrink-0 font-mono">{ticket.reference}</span>
        <span>·</span>
        <Link
          href={`/platform/support/institutions/${ticket.tenantId}`}
          className="rounded font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          {ticket.tenantName}
        </Link>
        <span>· raised by {ticket.raisedByName}</span>
        <span>· {formatDate(ticket.createdAt)}</span>
        <AgeChip ticket={ticket} />
      </p>

      {isBreaching(ticket) && (
        <FormAlert variant="error" className="mb-4">
          Past the {SLA_HOURS[ticket.priority]}-hour response target for{" "}
          {TICKET_PRIORITY_LABELS[ticket.priority].toLowerCase()} priority.
        </FormAlert>
      )}

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <div className="grid min-w-0 gap-4">
        {/* Original request */}
        <Card className="min-w-0 p-5 sm:p-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Reported
          </p>
          <p className="whitespace-pre-line text-[13px] leading-6 text-[#334155]">
            {ticket.description}
          </p>
        </Card>

        {/* Thread */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Conversation
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
          </h2>

          {replies.length === 0 ? (
            <p className="rounded-field border border-dashed border-border py-6 text-center text-[13px] text-muted-foreground">
              No replies yet. You&apos;re first.
            </p>
          ) : (
            <ul className="min-w-0 space-y-3">
              {replies.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "min-w-0 rounded-field border p-3.5",
                    r.isInternal
                      ? "border-warning bg-warning-light"
                      : r.authorKind === "SUPPORT"
                        ? "border-accent-border bg-accent-light"
                        : "border-border bg-background",
                  )}
                >
                  <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2">
                    <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
                      {r.authorName}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#475569]">
                      {r.authorRole}
                    </span>
                    {/* An internal note must be unmistakable — it is the one
                        thing on this page the institution must never see. */}
                    {r.isInternal && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#B45309]">
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                        Internal note
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-[#475569]">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-[13px] leading-6 text-[#334155]">
                    {r.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Reply + status */}
        <Card className="min-w-0 p-5 sm:p-6">
          {closed ? (
            <p className="flex items-center justify-center gap-2 rounded-field border border-dashed border-border py-6 text-center text-[13px] text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              This ticket is closed. The institution can raise a new one if the
              problem returns.
            </p>
          ) : (
            <form onSubmit={onReply} noValidate className="min-w-0">
              <label
                htmlFor="reply-body"
                className="text-[13px] font-medium text-[#334155]"
              >
                Reply as {CURRENT_AGENT.name}
              </label>
              <textarea
                id="reply-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "reply-error" : undefined}
                placeholder={
                  internal
                    ? "Visible to platform staff only…"
                    : "Your reply goes to the institution…"
                }
                className={cn(
                  "mt-1.5 w-full min-w-0 rounded-field border bg-white px-3 py-2 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                  error
                    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                    : "border-border focus:border-accent focus:ring-accent/15",
                )}
              />
              {error && (
                <p id="reply-error" className="mt-1 text-[12px] text-destructive-text">
                  {error}
                </p>
              )}

              <label
                htmlFor="reply-internal"
                className="mt-2.5 flex min-w-0 items-center gap-2.5"
              >
                <input
                  id="reply-internal"
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                />
                <span className="text-[13px] text-[#334155]">
                  Internal note
                  <span className="text-muted-foreground">
                    {" "}
                    — the institution won&apos;t see this
                  </span>
                </span>
              </label>

              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <label
                    htmlFor="ticket-status"
                    className="shrink-0 text-[12px] font-medium text-[#334155]"
                  >
                    Status
                  </label>
                  <select
                    id="ticket-status"
                    value={status}
                    onChange={(e) => {
                      const next = e.target.value as typeof status;
                      setStatus(next);
                      setNotice(
                        `PATCH /platform/tickets/${ticket.id} { status: "${next}" } — API not connected yet (Dev-A, C-SP-03).`,
                      );
                    }}
                    className="h-9 rounded-field border border-border bg-white px-3 text-[13px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                  >
                    <option value={status}>{TICKET_STATUS_LABELS[status]}</option>
                    {transitions.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  loading={busy}
                  loadingText="Sending…"
                  className="w-auto px-4"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send reply
                </Button>
              </div>
            </form>
          )}
        </Card>

        <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          You can change this ticket, but not the institution&apos;s data —{" "}
          <Link
            href={`/platform/support/institutions/${ticket.tenantId}`}
            className="rounded font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            open the read-only view
          </Link>{" "}
          to diagnose their setup.
        </p>
      </div>
    </div>
  );
}
