"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { seatUsage } from "@/lib/platform";
import { Card, EmptyState } from "@/components/dashboard/primitives";
import { TenantStateChip } from "./tenant-bits";
import type { PlanRow, TenantRow } from "@/types/platform";

/**
 * C-SA-02 — Institution List.
 * "All tenants table: name, plan, status, student count"
 */
export function InstitutionList({
  tenants,
  plans,
}: {
  tenants: TenantRow[];
  plans: PlanRow[];
}) {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("ALL");
  const [state, setState] = useState("ALL");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (plan !== "ALL" && t.planSlug !== plan) return false;
      if (state === "SUSPENDED" && t.isActive) return false;
      if (state !== "ALL" && state !== "SUSPENDED") {
        if (!t.isActive || t.status !== state) return false;
      }
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [tenants, query, plan, state]);

  const counts = {
    all: tenants.length,
    active: tenants.filter((t) => t.isActive && t.status === "ACTIVE").length,
    trial: tenants.filter((t) => t.status === "TRIAL").length,
    suspended: tenants.filter((t) => !t.isActive).length,
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Institutions
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every tenant on the platform.
          </p>
        </div>

        <Link
          href="/platform/institutions/new"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New institution
        </Link>
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="relative mb-3 flex min-w-0 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <label htmlFor="tenant-search" className="sr-only">
            Search institutions
          </label>
          <input
            id="tenant-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, subdomain or city…"
            className="h-10 w-full min-w-0 rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>

        <div className="mb-4 flex min-w-0 flex-wrap gap-2">
          <div
            role="group"
            aria-label="Filter by state"
            className="-mx-1 flex min-w-0 max-w-full gap-2 overflow-x-auto px-1 pb-1"
          >
            {(
              [
                ["ALL", "All", counts.all],
                ["ACTIVE", "Active", counts.active],
                ["TRIAL", "Trial", counts.trial],
                ["SUSPENDED", "Suspended", counts.suspended],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                aria-pressed={state === key}
                onClick={() => setState(key)}
                className={cn(
                  "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                  state === key
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-accent",
                )}
              >
                {label}
                <span className="ml-1.5 opacity-70">{n}</span>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            <label htmlFor="tenant-plan" className="sr-only">
              Filter by plan
            </label>
            <select
              id="tenant-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="h-8 max-w-[170px] rounded-full border border-border bg-white px-3 text-xs font-medium text-muted-foreground transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              <option value="ALL">All plans</option>
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "institution" : "institutions"} shown
        </p>

        {shown.length === 0 ? (
          <EmptyState message="No institutions match these filters." />
        ) : (
          <>
            {/* ≥768px: table */}
            <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
              <table className="w-full min-w-[720px] border-collapse">
                <caption className="sr-only">
                  Institutions — {shown.length} rows
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    {["Institution", "Type", "Plan", "Students", "Teachers", "State"].map(
                      (h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className={cn(
                            "py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                            i >= 3 && i <= 4 ? "text-right" : "text-left",
                          )}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => {
                    const cap = plans.find((p) => p.slug === t.planSlug);
                    const usage = cap
                      ? seatUsage(t.studentCount, cap.maxStudents)
                      : null;

                    return (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <th scope="row" className="py-3 pr-3 text-left align-top">
                          <Link
                            href={`/platform/institutions/${t.id}`}
                            className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                          >
                            {t.name}
                          </Link>
                          <span className="block truncate font-mono text-[11px] font-normal text-muted-foreground">
                            {t.slug}.xyz.com
                          </span>
                        </th>
                        <td className="py-3 pr-3 align-top text-[12px] capitalize text-muted-foreground">
                          {t.type.toLowerCase()}
                        </td>
                        <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                          {t.planName}
                        </td>
                        <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                          {t.studentCount.toLocaleString("en-IN")}
                          {usage && (
                            <span
                              className={cn(
                                "block text-[10px]",
                                usage.pct >= 90
                                  ? "text-destructive-text"
                                  : "text-muted-foreground",
                              )}
                            >
                              {usage.pct}% of cap
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-muted-foreground">
                          {t.teacherCount}
                        </td>
                        <td className="py-3 align-top">
                          <TenantStateChip tenant={t} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* <768px: stacked */}
            <ul className="min-w-0 divide-y divide-border border-t border-border md:hidden">
              {shown.map((t) => (
                <li key={t.id} className="min-w-0 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/platform/institutions/${t.id}`}
                        className="block truncate rounded text-[13px] font-medium text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {t.name}
                      </Link>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {t.slug}.xyz.com
                      </p>
                    </div>
                    <TenantStateChip tenant={t} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t.planName} · {t.studentCount.toLocaleString("en-IN")} students ·{" "}
                    {t.teacherCount} teachers
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Suspending a tenant blocks sign-in for everyone in it, but keeps all
        their data.
      </p>
    </div>
  );
}
