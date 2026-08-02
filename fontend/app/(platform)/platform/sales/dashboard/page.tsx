import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Percent,
  Sprout,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { PlatformPage } from "@/components/platform/platform-page";
import { tenantHost } from "@/lib/platform-shared";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import { TrialListItem } from "@/components/sales/trial-bits";
import { compactINR } from "@/lib/platform";
import {
  CONVERSION_WINDOW_DAYS,
  CURRENT_EXEC,
  RENEWAL_WINDOW_DAYS,
} from "@/lib/sales";
import { getSalesStats } from "@/lib/sales-data";
import { formatDate, rupees } from "@/lib/utils";
import type { Stat } from "@/types/dashboard";

export const metadata: Metadata = { title: "Sales Dashboard" };

/**
 * C-SL-01 — Sales Dashboard.
 * "Trial institutions, conversion rate, recent signups"
 *
 * The three things the doc names are the three regions of this page. Drawn
 * with the shared `StatsCard` / `DashboardPanel`, so the sales console adds
 * no chart code of its own — the same decision the Super Admin and Support
 * dashboards made.
 */
export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search} allow={["SALES_EXECUTIVE", "SUPER_ADMIN"]}>
      {() => {
        const s = getSalesStats();

        const stats: Stat[] = [
          {
            label: "Open trials",
            value: String(s.openTrials),
            icon: Sprout,
            tone: "accent",
            href: "/platform/sales/trials",
            delta: { text: `${s.mine} owned by you`, tone: "muted" },
          },
          {
            label: "Needs action",
            value: String(s.needsAction),
            icon: TriangleAlert,
            // Expired or closing inside 3 days — this is the number that
            // costs money if it is ignored
            tone: s.needsAction ? "danger" : "success",
            pulse: s.needsAction > 0,
            delta: {
              text: `${s.expired} already expired · ${s.unassigned} unassigned`,
              tone: "muted",
            },
          },
          {
            label: "Conversion",
            // The ring already renders the percentage. Passing it as `value`
            // too printed "67% 67%" — the convention in `lib/dashboards.tsx`
            // is that a ringed card's `value` is the *period* the ring covers.
            value: `Last ${CONVERSION_WINDOW_DAYS}d`,
            icon: Percent,
            tone: "success",
            ring: { value: s.conversionRate, max: 100 },
            delta: {
              text: `${s.converted} won · ${s.lapsed} lost`,
              tone: "muted",
            },
          },
          {
            label: "Pipeline",
            value: compactINR(s.pipelineValue),
            icon: Wallet,
            tone: "cyan",
            delta: { text: "per month, at list price", tone: "muted" },
          },
        ];

        return (
          <div className="mx-auto w-full min-w-0 max-w-6xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Sales
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Signed in as {CURRENT_EXEC.name}. Trials, conversions and the
                subscriptions they become.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((x) => (
                <StatsCard key={x.label} stat={x} />
              ))}
            </div>

            <div className="mb-4 grid min-w-0 grid-cols-12 gap-4">
              {/* Six points, so a line reads as a trend rather than noise */}
              <DashboardPanel
                panel={{
                  kind: "trend",
                  title: "Signups per month",
                  span: 7,
                  points: s.signupTrend.map((m) => m.count),
                  labels: s.signupTrend.map((m) => m.label),
                }}
              />

              {/* Two numbers, so bars — a two-point line is not a trend */}
              <DashboardPanel
                panel={{
                  kind: "bars",
                  title: `Last ${CONVERSION_WINDOW_DAYS} days`,
                  span: 5,
                  empty: "No trial has been decided yet.",
                  items: [
                    {
                      label: "Converted",
                      value: s.converted,
                      max: Math.max(1, s.converted, s.lapsed),
                      display: String(s.converted),
                      tone: "success" as const,
                    },
                    {
                      label: "Lapsed",
                      value: s.lapsed,
                      max: Math.max(1, s.converted, s.lapsed),
                      display: String(s.lapsed),
                      tone: "danger" as const,
                    },
                  ],
                }}
              />
            </div>

            {/* Trial institutions — the doc's first named item */}
            <Card className="mb-4 min-w-0 p-5 sm:p-6">
              <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[15px] font-bold text-foreground">
                  Trial pipeline
                  <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                    {rupees(s.pipelineValue)}/mo at stake
                  </span>
                </h2>
                <Link
                  href="/platform/sales/trials"
                  className="inline-flex shrink-0 items-center gap-1 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  All trials
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              {s.pipeline.length === 0 ? (
                <EmptyState message="No institution is on trial right now." />
              ) : (
                <ul className="min-w-0 divide-y divide-border border-t border-border">
                  {s.pipeline.map((t) => (
                    <TrialListItem key={t.tenantId} trial={t} />
                  ))}
                </ul>
              )}
            </Card>

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {/* Recent signups — the doc's third named item */}
              <Card className="min-w-0 p-5 sm:p-6">
                <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
                  Recent signups
                </h2>

                <ul className="min-w-0 divide-y divide-border border-t border-border">
                  {s.recentSignups.map((t) => (
                    <li key={t.tenantId} className="min-w-0 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-[12px] font-semibold text-accent"
                          aria-hidden="true"
                        >
                          {t.name.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {t.name}
                          </p>
                          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                            {tenantHost(t.slug)} · {t.planName}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {t.ageDays}d ago
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Renewals: not in the doc's description, but a sales desk
                  that only chases new logos loses the base it already has,
                  and C-SL-04 owns renewals. */}
              <Card className="min-w-0 p-5 sm:p-6">
                <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-[15px] font-bold text-foreground">
                    Renewing soon
                  </h2>
                  <Link
                    href="/platform/sales/subscriptions"
                    className="inline-flex shrink-0 items-center gap-1 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    Subscriptions
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>

                {s.renewalsDue.length === 0 ? (
                  <EmptyState
                    message={`Nothing renews in the next ${RENEWAL_WINDOW_DAYS} days.`}
                  />
                ) : (
                  <ul className="min-w-0 divide-y divide-border border-t border-border">
                    {s.renewalsDue.map((a) => (
                      <li key={a.tenantId} className="min-w-0 py-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-foreground">
                              {a.tenantName}
                            </p>
                            <p className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                              <CalendarClock
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              {a.renewsAt ? formatDate(a.renewsAt) : "—"} · in{" "}
                              {a.daysToRenewal}d
                            </p>
                          </div>
                          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">
                            {rupees(a.mrr)}
                            <span className="font-normal text-muted-foreground">
                              /mo
                            </span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <p className="mt-4 text-[12px] text-muted-foreground">
              Sales sees commercial records only — plans, trials and billing.
              Institution academic data is out of scope for this role (§4.1).
            </p>
          </div>
        );
      }}
    </PlatformPage>
  );
}
