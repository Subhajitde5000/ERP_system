import Link from "next/link";
import {
  ArrowLeft,
  Check,
  EyeOff,
  Minus,
  ScrollText,
  TriangleAlert,
} from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { moduleLabel } from "@/lib/platform-shared";
import { Card, Chip, EmptyState, ProgressBar } from "@/components/dashboard/primitives";
import { TicketListItem } from "./ticket-bits";
import type { InstitutionSnapshot } from "@/types/support";

/**
 * C-SP-04 — Institution Read-Only View.
 * "Read-only audit-mode view of any institution's data"
 *
 * §4.1 limits Support Staff to "view institution data in read-only mode (for
 * debugging)" and states plainly they "cannot modify institution data or
 * settings". This page therefore has **no form, no button that writes, and no
 * link into the live tenant** — every element is output.
 *
 * It is also deliberately a *diagnostic* view rather than the institution app
 * rendered behind a support login. Debugging a login failure or a missing
 * module needs configuration and health, not student records, marks or fee
 * accounts — none of which are in this payload at all.
 *
 * A server component: nothing here is interactive.
 */
export function InstitutionReadonly({ snapshot }: { snapshot: InstitutionSnapshot }) {
  const s = snapshot;
  const failing = s.checks.filter((c) => !c.ok);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/platform/support/tickets"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to tickets
      </Link>

      <div className="mb-1 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h1 className="min-w-0 font-display text-[22px] font-bold text-foreground">
          {s.tenantName}
        </h1>
        <Chip tone="muted">Read-only · audit mode</Chip>
      </div>
      <p className="mb-4 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span className="font-mono">{s.tenantSlug}.xyz.com</span>
        <span className="capitalize">· {s.type.toLowerCase()}</span>
        <span>· {s.planName}</span>
        <span>· since {formatDate(s.createdAt)}</span>
      </p>

      {/* Say what this view is and isn't, before anything else */}
      <div className="mb-4 flex min-w-0 items-start gap-2.5 rounded-field border border-accent-border bg-accent-light px-3.5 py-3">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <p className="min-w-0 text-[12px] leading-6 text-[#3730A3]">
          Diagnostic snapshot for debugging. Support can read configuration and
          health — never student records, marks or fees — and cannot change
          anything here. Configuration changes are the institution&apos;s own,
          or a Super Admin&apos;s.
        </p>
      </div>

      <div className="grid min-w-0 gap-4">
        {/* Health checks lead: the reason an agent opened this page */}
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Health checks
            </h2>
            <span
              className={cn(
                "shrink-0 text-[12px] font-semibold",
                failing.length ? "text-destructive-text" : "text-success-text",
              )}
            >
              {failing.length
                ? `${failing.length} need${failing.length === 1 ? "s" : ""} attention`
                : "All clear"}
            </span>
          </div>

          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {s.checks.map((c) => (
              <li key={c.label} className="flex min-w-0 items-start gap-3 py-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    c.ok ? "bg-success-light" : "bg-destructive-light",
                  )}
                  aria-hidden="true"
                >
                  {c.ok ? (
                    <Check className="h-3 w-3 text-success-text" />
                  ) : (
                    <TriangleAlert className="h-3 w-3 text-destructive-text" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium text-foreground">
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        // No `capitalize` here: it title-cases whole phrases
                        // ("910 Of Unlimited"). Values arrive correctly cased.
                        "min-w-0 text-[12px]",
                        c.ok ? "text-muted-foreground" : "font-medium text-destructive-text",
                      )}
                    >
                      {c.value}
                    </span>
                  </p>
                  {c.hint && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.hint}
                    </p>
                  )}
                </div>
                <span className="sr-only">{c.ok ? "Passing" : "Failing"}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Capacity */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Usage against plan
          </h2>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Meter label="Students" used={s.studentCount} cap={s.maxStudents} />
            <Meter label="Teachers" used={s.teacherCount} cap={s.maxTeachers} />
            <Meter
              label="Storage"
              used={s.storageUsedGb}
              cap={s.maxStorageGb}
              suffix=" GB"
            />
          </div>
        </Card>

        {/* Modules — the most common "it's missing" ticket */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            Modules
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            {s.enabledModules.length} on of {s.allowedModules.length} the plan
            allows. A module that is off here explains a missing menu item.
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {s.allowedModules.map((m) => {
              const on = s.enabledModules.includes(m);
              return (
                <span
                  key={m}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                    on
                      ? "bg-accent-light text-accent"
                      : "border border-dashed border-border text-[#475569]",
                  )}
                >
                  {on ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Minus className="h-3 w-3" aria-hidden="true" />
                  )}
                  {moduleLabel(m)}
                  <span className="sr-only">{on ? " enabled" : " disabled"}</span>
                </span>
              );
            })}
          </div>
        </Card>

        {/* Their open tickets, so context is in one place */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Open tickets
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              {s.openTickets.length}
            </span>
          </h2>
          {s.openTickets.length === 0 ? (
            <EmptyState message="No open tickets from this institution." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {s.openTickets.map((t) => (
                <TicketListItem key={t.id} ticket={t} />
              ))}
            </ul>
          )}
        </Card>

        {/* Recent admin actions — "what changed just before it broke?" */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
            Recent admin actions
          </h2>
          <p className="mb-3 text-[12px] text-muted-foreground">
            From the institution&apos;s audit trail — usually the fastest answer
            to &ldquo;what changed just before this broke?&rdquo;
          </p>

          {s.recentActivity.length === 0 ? (
            <EmptyState message="No recorded activity for this institution." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {s.recentActivity.map((e) => (
                <li key={e.id} className="flex min-w-0 items-start gap-3 py-2.5">
                  <ScrollText
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] font-semibold text-foreground">
                      {e.action}
                    </p>
                    <p className="min-w-0 truncate text-[12px] text-[#334155]">
                      {e.target}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.actorName} · {formatDate(e.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Meter({
  label,
  used,
  cap,
  suffix = "",
}: {
  label: string;
  used: number;
  cap: number;
  suffix?: string;
}) {
  // -1 is unlimited (§4.1) — a bar against infinity means nothing
  const unlimited = cap === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const tone = pct >= 100 ? "danger" : pct >= 90 ? "warning" : "success";

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-[#334155]">{label}</span>
        <span
          className={cn(
            "shrink-0 text-[13px] font-bold tabular-nums",
            !unlimited && pct >= 100 ? "text-destructive-text" : "text-foreground",
          )}
        >
          {used.toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        of {unlimited ? "unlimited" : `${cap.toLocaleString("en-IN")}${suffix}`}
      </p>
      {!unlimited && (
        <ProgressBar className="mt-1.5" value={pct} max={100} tone={tone} />
      )}
    </div>
  );
}
