import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Inbox, LifeBuoy, UserPlus } from "lucide-react";

import { PlatformPage } from "@/components/platform/platform-page";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import { TicketListItem } from "@/components/support/ticket-bits";
import { CURRENT_AGENT, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_TONE } from "@/lib/support";
import { getSupportStats } from "@/lib/support-data";
import type { Stat } from "@/types/dashboard";

export const metadata: Metadata = { title: "Support Dashboard" };

/**
 * C-SP-01 — Support Dashboard.
 * "Open tickets count, priority breakdown, assigned to me"
 *
 * Rendered with the shared `StatsCard` / `DashboardPanel`, so the support
 * console adds no chart code of its own.
 */
export default async function SupportDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SUPPORT_STAFF", "SUPER_ADMIN"]}>
      {() => {
        const s = getSupportStats();

        const stats: Stat[] = [
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
                Signed in as {CURRENT_AGENT.name}. Tickets raised by
                institution admins across the platform.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((x) => (
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
    </PlatformPage>
  );
}
