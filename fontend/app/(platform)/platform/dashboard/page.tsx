import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  GraduationCap,
  LifeBuoy,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";

import { PlatformPage } from "@/components/platform/platform-page";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DashboardPanel } from "@/components/dashboard/panel";
import { Card } from "@/components/dashboard/primitives";
import { TenantStateChip } from "@/components/platform/tenant-bits";
import { compactINR } from "@/lib/platform";
import { getPlatformStats } from "@/lib/platform-data";
import type { Stat } from "@/types/dashboard";

export const metadata: Metadata = { title: "Platform Dashboard" };

/**
 * C-SA-01 — Super Admin Dashboard.
 * "KPIs: total institutions, active users, revenue, tickets"
 *
 * Rendered with the same `StatsCard` / `DashboardPanel` the institution
 * dashboards and reports use, so the platform console needs no chart code
 * of its own.
 */
export default async function PlatformDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const search = await searchParams;

  return (
    <PlatformPage search={search}>
      {() => {
        const s = getPlatformStats();

        const stats: Stat[] = [
          {
            label: "Institutions",
            value: String(s.totalInstitutions),
            icon: Building2,
            tone: "accent",
            delta: {
              text: `${s.activeInstitutions} active · ${s.trialInstitutions} trial`,
              tone: "muted",
            },
          },
          {
            label: "Students",
            value: s.totalStudents.toLocaleString("en-IN"),
            icon: GraduationCap,
            tone: "cyan",
            delta: { text: `${s.totalTeachers} teachers`, tone: "muted" },
          },
          {
            label: "MRR",
            value: compactINR(s.mrr),
            icon: Wallet,
            tone: "success",
            delta: { text: "recurring, ex-trials", tone: "muted" },
          },
          {
            label: "Open tickets",
            value: String(s.openTickets),
            icon: LifeBuoy,
            tone: s.criticalTickets ? "danger" : "success",
            delta: { text: `${s.criticalTickets} critical`, tone: "danger" },
            pulse: s.criticalTickets > 0,
          },
        ];

        return (
          <div className="mx-auto w-full min-w-0 max-w-6xl">
            <div className="mb-4 min-w-0">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Platform overview
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Every institution on xyz.com, and what they pay.
              </p>
            </div>

            <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((x) => (
                <StatsCard key={x.label} stat={x} />
              ))}
            </div>

            <div className="grid min-w-0 grid-cols-12 gap-4">
              <DashboardPanel
                panel={{
                  kind: "trend",
                  title: "Revenue trend",
                  span: 7,
                  points: s.revenueTrend.map((m) => m.amount),
                  labels: s.revenueTrend.map((m) => m.label),
                }}
              />
              <DashboardPanel
                panel={{
                  kind: "bars",
                  title: "Institutions by plan",
                  span: 5,
                  items: s.planMix.map((p) => ({
                    label: p.plan,
                    value: p.count,
                    max: Math.max(...s.planMix.map((x) => x.count)),
                    display: String(p.count),
                    tone: "accent" as const,
                  })),
                }}
              />
            </div>

            {/* Newest signups — the row the Super Admin acts on most */}
            <Card className="mt-4 min-w-0 p-5 sm:p-6">
              <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[15px] font-bold text-foreground">
                  Recent institutions
                </h2>
                <Link
                  href="/platform/institutions"
                  className="inline-flex shrink-0 items-center gap-1 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  View all
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              <ul className="min-w-0 divide-y divide-border border-t border-border">
                {s.recentTenants.map((t) => (
                  <li key={t.id} className="min-w-0 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-[12px] font-semibold text-accent"
                        aria-hidden="true"
                      >
                        {t.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/platform/institutions/${t.id}`}
                          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          {t.name}
                        </Link>
                        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                          {t.slug}.xyz.com · {t.planName} ·{" "}
                          {t.studentCount.toLocaleString("en-IN")} students
                        </p>
                      </div>
                      <TenantStateChip tenant={t} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Institution data is audit-only from here — editing happens inside
              the tenant.
            </p>
          </div>
        );
      }}
    </PlatformPage>
  );
}
