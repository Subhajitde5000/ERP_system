"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/primitives";
import type { DetailTab } from "@/types/detail";

/**
 * Layout shared by the "one URL, different tabs per role" detail pages —
 * role_based_shared_pages.md PAGE 19 (student) and PAGE 20 (staff).
 *
 * Only the tab *set* and the tab bodies differ between those pages, so the
 * back link, header card, tab strip and panel wiring live here once.
 */

/** Back link — every detail page returns to where the role came from. */
export function DetailBackLink({
  href = "/dashboard",
  label = "Back",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/**
 * Header card — avatar, title, status badge, subtitle, meta row, actions.
 * Identical for every role that has access; only the action slot varies.
 */
export function DetailHeader({
  initial,
  title,
  badge,
  subtitle,
  meta,
  actions,
}: {
  initial: string;
  title: string;
  badge?: React.ReactNode;
  subtitle: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-[20px] font-semibold text-white ring-4 ring-accent-light"
          aria-hidden="true"
        >
          {initial}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-display text-[20px] font-bold text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
          {meta && (
            <div className="mt-3 flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-[12px]">
              {meta}
            </div>
          )}
        </div>

        {actions}
      </div>
    </Card>
  );
}

/**
 * Tab strip — the role's own set, as a WAI-ARIA tablist.
 *
 * Roving tabindex plus arrow / Home / End keys: without it a keyboard user has
 * to tab through every tab to reach the panel, which the §10 a11y checklist
 * calls out.
 */
export function DetailTabs<K extends string>({
  tabs,
  active,
  onSelect,
  label,
  panelId,
}: {
  tabs: DetailTab<K>[];
  active: K;
  onSelect: (key: K) => void;
  label: string;
  panelId: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  function move(delta: number) {
    const index = tabs.findIndex((t) => t.key === active);
    if (index === -1) return;
    const next = tabs[(index + delta + tabs.length) % tabs.length]!;
    onSelect(next.key);
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${next.key}`)
      ?.focus();
  }

  function jump(to: 0 | -1) {
    const next = to === 0 ? tabs[0] : tabs[tabs.length - 1];
    if (!next) return;
    onSelect(next.key);
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${next.key}`)
      ?.focus();
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "Home") {
          e.preventDefault();
          jump(0);
        } else if (e.key === "End") {
          e.preventDefault();
          jump(-1);
        }
      }}
      className="-mx-1 mt-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
    >
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.key)}
            className={cn(
              "h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-medium transition",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              selected
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-accent hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Panel wrapper — carries the scope note so a narrowed tab
 * ("Attendance — your department") is explicit rather than silently partial.
 */
export function DetailPanel({
  id,
  tab,
  children,
}: {
  id: string;
  tab?: DetailTab;
  children: React.ReactNode;
}) {
  return (
    <>
      {tab?.scopeNote && (
        <p className="mt-3 rounded-field border border-border bg-background px-3.5 py-2 text-[12px] text-muted-foreground">
          Showing {tab.label.toLowerCase()} for{" "}
          <span className="font-medium text-foreground">{tab.scopeNote}</span>.
        </p>
      )}
      <div
        id={id}
        role="tabpanel"
        aria-labelledby={tab ? `tab-${tab.key}` : undefined}
        tabIndex={0}
        className="mt-4 min-w-0 focus-visible:outline-none"
      >
        {children}
      </div>
    </>
  );
}
