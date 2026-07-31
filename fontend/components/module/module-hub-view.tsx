import Link from "next/link";

import { roleChip } from "@/lib/roles";
import { Card, Chip } from "@/components/dashboard/primitives";
import { DashboardPanel } from "@/components/dashboard/panel";
import { StatsCard } from "@/components/dashboard/stats-card";
import type { ModuleHub } from "@/types/module-hub";

/**
 * Optional-module landing page — `/{module}/dashboard`.
 *
 * A **server** component, like `DashboardView`: `Stat.icon` is a Lucide
 * component and cannot cross the server→client boundary as a prop. There is
 * nothing interactive here, so no client island is needed at all.
 *
 * Renders entirely with `StatsCard` and `DashboardPanel`, the same two
 * components the 18 role dashboards and the reports page use.
 */
export function ModuleHubView({
  hub,
  canManage,
}: {
  hub: ModuleHub;
  canManage: boolean;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            {hub.title}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {hub.description}
          </p>
        </div>

        {/* A viewer without the owning role sees the same figures, no levers */}
        {!canManage && (
          <Chip tone="muted">Read only · managed by {roleChip(hub.ownerRole)}</Chip>
        )}
      </div>

      {hub.stats.length > 0 && (
        <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hub.stats.map((s) => (
            <StatsCard key={s.label} stat={s} />
          ))}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-12 gap-4">
        {hub.panels.map((panel, i) => (
          <DashboardPanel key={`${hub.key}-${i}`} panel={panel} />
        ))}
      </div>

      {canManage && hub.actions.length > 0 && (
        <Card className="mt-4 min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Quick actions
          </h2>
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {hub.actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className={
                    a.primary
                      ? "inline-flex h-11 min-w-0 items-center gap-2 rounded-field bg-accent px-4 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      : "inline-flex h-11 min-w-0 items-center gap-2 rounded-field border border-border bg-white px-4 text-[14px] font-medium text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
