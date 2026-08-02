import Link from "next/link";
import { ArrowRight, Building2, FileText, LifeBuoy, Plus, Receipt, UserCircle, Wallet, type LucideIcon } from "lucide-react";

import { Card } from "@/components/dashboard/primitives";
import { StatsCard } from "@/components/dashboard/stats-card";
import { TenantStateChip } from "@/components/platform/tenant-bits";
import { compactINR } from "@/lib/platform";
import type { Stat } from "@/types/dashboard";
import type { TenantRow } from "@/types/platform";

const OWNER_EMAIL = "rahul@gmail.com";

/** Owner-facing xyz.com dashboard: one login, many institutions. */
export function OwnerDashboard({ tenants }: { tenants: TenantRow[] }) {
  const mine = tenants.slice(0, 3);
  const mrr = mine.reduce((sum, t) => sum + (t.status === "ACTIVE" ? planAmount(t.planSlug) : 0), 0);
  const openInvoices = mine.filter((t) => t.status === "PAST_DUE").length;
  const stats: Stat[] = [
    { label: "My Institutions", value: String(mine.length), icon: Building2, tone: "accent" },
    { label: "Monthly billing", value: compactINR(mrr), icon: Wallet, tone: "success" },
    { label: "Open invoices", value: String(openInvoices), icon: FileText, tone: openInvoices ? "warning" : "success" },
    { label: "Support tickets", value: "2", icon: LifeBuoy, tone: "cyan" },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Platform dashboard
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Signed in as {OWNER_EMAIL}. Manage all your institutions from xyz.com.
          </p>
        </div>
        <Link
          href="/signup"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create New Institution
        </Link>
      </div>

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((x) => (
          <StatsCard key={x.label} stat={x} />
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-bold text-foreground">My Institutions</h2>
            <Link href="/platform/my-institutions" className="text-[12px] font-semibold text-accent hover:underline">
              View all
            </Link>
          </div>
          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {mine.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">
                    {t.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{t.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{t.slug}.xyz.com</p>
                  </div>
                  <TenantStateChip tenant={t} />
                  <Link href={`https://${t.slug}.xyz.com/login`} className="rounded text-[12px] font-semibold text-accent hover:underline">
                    Go To
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="font-display text-[15px] font-bold text-foreground">Owner shortcuts</h2>
          <div className="mt-4 grid gap-2">
            <Shortcut href="/platform/billing" icon={Wallet} label="Billing" />
            <Shortcut href="/platform/subscriptions" icon={Receipt} label="Subscriptions" />
            <Shortcut href="/platform/invoices" icon={FileText} label="Invoices" />
            <Shortcut href="/platform/tickets" icon={LifeBuoy} label="Support Tickets" />
            <Shortcut href="/platform/profile" icon={UserCircle} label="Profile" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Shortcut({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-field border border-border px-3 py-2 text-sm font-medium text-[#334155] transition hover:border-accent-border hover:bg-accent-light hover:text-accent">
      <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden="true" />{label}</span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function planAmount(planSlug: string): number {
  if (planSlug === "starter") return 2999;
  if (planSlug === "professional") return 7999;
  if (planSlug === "enterprise") return 19999;
  return 0;
}
