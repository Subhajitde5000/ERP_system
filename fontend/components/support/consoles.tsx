"use client";

/**
 * Live Support Staff consoles — C-SP-01 … C-SP-04.
 *
 * Same shape as the Super Admin (`platform/consoles.tsx`) and Owner
 * (`platform/owner-consoles.tsx`) equivalents: a hook for the data, `<Live>`
 * for loading/error, `useAction` for mutations. None of those primitives are
 * re-implemented here.
 *
 * The presentational components — `TicketList`, `TicketDetail`,
 * `InstitutionReadonly`, `TicketListItem` — keep their existing markup and
 * props; they only gained the callbacks and the agent identity they need.
 *
 * §4.1 boundary: an agent may change a *ticket* (status, assignee, replies)
 * but "cannot modify institution data or settings", so C-SP-04 renders a
 * read-only snapshot with no mutation path at all.
 */

import Link from "next/link";
import { CheckCircle2, Inbox, LifeBuoy, UserPlus } from "lucide-react";

import { replyToTicket, updateTicket } from "@/lib/platform-api";
import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_TONE } from "@/lib/support";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import { DashboardPanel } from "@/components/dashboard/panel";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ActionBar, Live, useAction } from "@/components/platform/live";
import { usePlatformSession } from "@/hooks/use-platform-session";
import {
  useInstitutionSnapshot,
  useSupportStats,
  useTicketDetail,
  useTickets,
} from "@/hooks/use-support-console";
import { InstitutionReadonly } from "./institution-readonly";
import { TicketDetail } from "./ticket-detail";
import { TicketList } from "./ticket-list";
import { TicketListItem } from "./ticket-bits";
import type { Stat } from "@/types/dashboard";

/* ── C-SP-01 · Dashboard ─────────────────────────────────────────────────── */

export function LiveSupportDashboard() {
  const stats = useSupportStats();
  const session = usePlatformSession();

  return (
    <Live resource={stats} label="Loading the support queue…">
      {(s) => {
        const cards: Stat[] = [
          {
            label: "Open",
            value: String(s.open),
            icon: Inbox,
            tone: "warning",
            delta: { text: `${s.inProgress} in progress`, tone: "muted" },
          },
          {
            label: "Assigned to me",
            value: String(s.mine),
            icon: LifeBuoy,
            tone: "accent",
            href: "/platform/support/tickets?assignee=me",
          },
          {
            label: "Unassigned",
            value: String(s.unassigned),
            icon: UserPlus,
            // Nobody owning a ticket is the thing that goes wrong quietly
            tone: s.unassigned ? "danger" : "success",
            pulse: s.unassigned > 0,
          },
          {
            label: "Resolved today",
            value: String(s.resolvedToday),
            icon: CheckCircle2,
            tone: "success",
          },
        ];

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Support
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {session ? `Signed in as ${session.name}. ` : ""}
                Tickets raised across the platform.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((x) => (
                <StatsCard key={x.label} stat={x} />
              ))}
            </div>

            <div className="mb-4 grid min-w-0 grid-cols-12 gap-4">
              <DashboardPanel
                panel={{
                  kind: "bars",
                  title: "Open by priority",
                  span: 5,
                  empty: "Nothing open — the queue is clear.",
                  items: s.byPriority.map((p) => ({
                    label: TICKET_PRIORITY_LABELS[p.priority],
                    value: p.count,
                    max: Math.max(1, ...s.byPriority.map((x) => x.count)),
                    display: String(p.count),
                    tone: TICKET_PRIORITY_TONE[p.priority],
                  })),
                }}
              />

              <div className="col-span-12 min-w-0 lg:col-span-7">
                <Card className="min-w-0 p-5 sm:p-6">
                  <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-[15px] font-bold text-foreground">
                      Waiting longest
                    </h2>
                    <Link
                      href="/platform/support/tickets"
                      className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      All tickets
                    </Link>
                  </div>

                  {s.oldestOpen.length === 0 ? (
                    <EmptyState message="Nothing is waiting." />
                  ) : (
                    <ul className="min-w-0 divide-y divide-border border-t border-border">
                      {s.oldestOpen.map((t) => (
                        <TicketListItem key={t.id} ticket={t} />
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>

            <Card className="min-w-0 p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
                My queue
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  {s.myQueue.length} open
                </span>
              </h2>

              {s.myQueue.length === 0 ? (
                <EmptyState message="Nothing assigned to you right now." />
              ) : (
                <ul className="min-w-0 divide-y divide-border border-t border-border">
                  {s.myQueue.map((t) => (
                    <TicketListItem key={t.id} ticket={t} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        );
      }}
    </Live>
  );
}

/* ── C-SP-02 · Ticket list ───────────────────────────────────────────────── */

export function LiveTicketList({ initialAssignee }: { initialAssignee?: string }) {
  // One unfiltered page; `TicketList` applies its own client-side filters,
  // which keeps the existing filter bar and its counts working unchanged.
  const tickets = useTickets({ status: "ALL", limit: 500 });
  const session = usePlatformSession();

  return (
    <Live resource={tickets} label="Loading tickets…">
      {(rows) => (
        <TicketList
          tickets={rows}
          initialAssignee={initialAssignee}
          agentId={session?.id ?? null}
        />
      )}
    </Live>
  );
}

/* ── C-SP-03 · Ticket detail ─────────────────────────────────────────────── */

export function LiveTicketDetail({ id }: { id: string }) {
  const detail = useTicketDetail(id);
  const action = useAction();
  const session = usePlatformSession();

  return (
    <Live resource={detail} label="Loading ticket…">
      {(d, resource) => (
        <>
          <ActionBar action={action} />
          <TicketDetail
            detail={d}
            agentName={session?.name}
            // These throw on failure so the component can surface the API's
            // message (e.g. an illegal status transition) against the form.
            onReplySubmit={async (body, isInternal) => {
              await replyToTicket(id, body, isInternal);
              await resource.reload();
            }}
            onStatusChange={async (next) => {
              await updateTicket(id, { status: next });
              await resource.reload();
            }}
          />
        </>
      )}
    </Live>
  );
}

/* ── C-SP-04 · Institution read-only ─────────────────────────────────────── */

export function LiveInstitutionReadonly({ tenantId }: { tenantId: string }) {
  const snapshot = useInstitutionSnapshot(tenantId);

  return (
    <Live resource={snapshot} label="Loading institution snapshot…">
      {(s) => <InstitutionReadonly snapshot={s} />}
    </Live>
  );
}
