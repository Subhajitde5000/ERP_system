import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Panel } from "@/types/dashboard";
import {
  Card,
  EmptyState,
  PanelHeader,
  ProgressBar,
  TONE_BG,
  TONE_FILL,
  TONE_TEXT,
} from "./primitives";

/**
 * One renderer for every panel type in §5.
 *
 * The 17 role dashboards reuse these bodies; a new dashboard is a config
 * object, never a new layout. Adding a panel type means adding one case here.
 */

const SPAN: Record<number, string> = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

export function DashboardPanel({ panel }: { panel: Panel }) {
  return (
    <Card className={cn("col-span-12 p-5 sm:p-6", SPAN[panel.span ?? 12])}>
      <PanelHeader title={panel.title} link={panel.link} />
      <PanelBody panel={panel} />
    </Card>
  );
}

function PanelBody({ panel }: { panel: Panel }) {
  switch (panel.kind) {
    /* ── Lists: notices, defaulters, submissions ─────────────────────────── */
    case "list": {
      if (!panel.items.length)
        return <EmptyState message={panel.empty ?? "Nothing here yet."} />;

      return (
        <ul className="divide-y divide-border">
          {panel.items.map((item, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 py-3 first:pt-0 last:pb-0",
                item.pinned && "-mx-2 rounded-field bg-warning-light px-2",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {item.pinned && (
                    <span className="mr-1.5 text-[10px] font-semibold uppercase text-warning">
                      Pinned
                    </span>
                  )}
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {item.meta && (
                <span
                  className={cn(
                    "shrink-0 text-[13px] font-semibold",
                    TONE_TEXT[item.tone ?? "muted"],
                  )}
                >
                  {item.meta}
                </span>
              )}

              {item.action && (
                <Link
                  href={item.action.href}
                  className="shrink-0 rounded-field border border-border px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
                >
                  {item.action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      );
    }

    /* ── Timeline: teacher's day, class schedule ─────────────────────────── */
    case "timeline": {
      if (!panel.items.length)
        return <EmptyState message={panel.empty ?? "No classes scheduled."} />;

      return (
        <ol className="relative space-y-1 border-l border-border pl-4">
          {panel.items.map((item, i) => (
            <li key={i} className="relative py-2">
              <span
                className={cn(
                  "absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-white",
                  item.current ? "bg-accent" : TONE_FILL[item.tone ?? "muted"],
                )}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-[68px] shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {item.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {item.title}
                    {item.current && (
                      <span className="ml-2 rounded-full bg-accent-light px-1.5 py-px text-[10px] font-semibold text-accent">
                        Next
                      </span>
                    )}
                  </p>
                  {item.subtitle && (
                    <p className="truncate text-[12px] text-muted-foreground">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                {item.done ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success-text">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    {item.done}
                  </span>
                ) : (
                  item.action && (
                    <Link
                      href={item.action.href}
                      className="shrink-0 rounded-field bg-accent px-2.5 py-1 text-[12px] font-medium text-white shadow-accent transition-colors hover:bg-accent-hover"
                    >
                      {item.action.label}
                    </Link>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      );
    }

    /* ── Bars: dept attendance, route utilisation ────────────────────────── */
    case "bars": {
      if (!panel.items.length)
        return <EmptyState message={panel.empty ?? "No data yet."} />;

      return (
        <ul className="space-y-3.5">
          {panel.items.map((bar, i) => (
            <li key={i}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] text-foreground">
                  {bar.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums",
                    TONE_TEXT[bar.tone ?? "accent"],
                  )}
                >
                  {bar.display ?? `${bar.value}${panel.unit ?? "%"}`}
                </span>
              </div>
              <ProgressBar
                value={bar.value}
                max={bar.max ?? 100}
                tone={bar.tone ?? "accent"}
              />
            </li>
          ))}
        </ul>
      );
    }

    /* ── Grid of mini metrics: attendance heatmap by dept ────────────────── */
    case "grid": {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {panel.items.map((item, i) => (
            <div
              key={i}
              className={cn(
                "rounded-field border border-border p-3",
                TONE_BG[item.tone ?? "muted"],
              )}
            >
              {/* `muted-foreground` is 4.76:1 on white but only 4.26:1 on a
                  tinted cell, so the label takes the darker slate here. */}
              <p className="truncate text-[12px] text-[#475569]">
                {item.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-lg font-bold",
                  TONE_TEXT[item.tone ?? "accent"],
                )}
              >
                {/* A grid cell is a percentage only when a max was given;
                    with an explicit max it is a count out of that total. */}
                {item.value}
                {item.max === undefined ? "%" : ""}
              </p>
            </div>
          ))}
        </div>
      );
    }

    /* ── Setup checklist stepper — §5.1 ──────────────────────────────────── */
    case "checklist": {
      const done = panel.items.filter((i) => i.progress === 100).length;

      return (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <ProgressBar
              value={done}
              max={panel.items.length}
              tone="accent"
              className="flex-1"
            />
            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
              {done}/{panel.items.length}
            </span>
          </div>

          <ul className="space-y-2.5">
            {panel.items.map((item, i) => {
              const complete = item.progress === 100;
              return (
                <li key={i} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                      complete ? "bg-success" : "border border-border bg-muted",
                    )}
                    aria-hidden="true"
                  >
                    {complete && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-[13px]",
                      complete ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  {!complete && (
                    <span className="text-[12px] font-medium text-warning-text">
                      {item.progress}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {panel.cta && (
            <Link
              href={panel.cta.href}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-field bg-accent text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              {panel.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      );
    }

    /* ── Admission funnel — §5.16 ────────────────────────────────────────── */
    case "funnel": {
      const top = panel.stages[0]?.value || 1;

      return (
        <ul className="space-y-2">
          {panel.stages.map((stage, i) => {
            const pct = Math.round((stage.value / top) * 100);
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[12px] text-muted-foreground">
                  {stage.label}
                </span>
                <div className="flex-1">
                  <div
                    className="flex h-8 items-center justify-end rounded-field bg-accent px-2.5 text-[12px] font-semibold text-white transition-all"
                    style={{ width: `${Math.max(pct, 14)}%`, opacity: 1 - i * 0.15 }}
                  >
                    {stage.value}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      );
    }

    /* ── Placement pipeline kanban — §5.14 ───────────────────────────────── */
    case "kanban": {
      return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {panel.columns.map((col, i) => (
            <div key={i} className="rounded-field bg-background p-3">
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {col.label}
                <span className="rounded-full bg-accent-light px-1.5 text-[10px] text-accent">
                  {col.items.length}
                </span>
              </p>
              <ul className="space-y-1.5">
                {col.items.map((item, j) => (
                  <li
                    key={j}
                    className="rounded-md border border-border bg-white px-2 py-1.5 text-[12px] text-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    /* ── Tables: defaulters, overdue books, conflicts ────────────────────── */
    case "table": {
      if (!panel.rows.length)
        return <EmptyState message={panel.empty ?? "Nothing to show."} />;

      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {panel.columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                      col.numeric ? "text-right" : "text-left",
                    )}
                  >
                    {col.label}
                  </th>
                ))}
                {panel.action && <th className="w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {panel.rows.map((row, i) => (
                <tr key={i}>
                  {panel.columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-1 py-2.5 text-[13px] text-foreground",
                        col.numeric && "text-right tabular-nums",
                      )}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                  {panel.action && (
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={`${panel.action} — row ${i + 1}`}
                        className="rounded p-1 text-accent transition-colors hover:bg-accent-light"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    /* ── Quick actions — §4.2 ────────────────────────────────────────────── */
    case "actions": {
      return (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {panel.items.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link
                key={i}
                href={action.href}
                className={cn(
                  "group flex items-center gap-3 rounded-field border p-3 transition-all",
                  action.primary
                    ? "border-transparent bg-accent text-white shadow-accent hover:bg-accent-hover"
                    : "border-border bg-white hover:border-accent hover:bg-accent-light/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    action.primary ? "bg-white/15" : "bg-accent-light",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      action.primary ? "text-white" : "text-accent",
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    "flex-1 text-[13px] font-medium",
                    action.primary ? "text-white" : "text-foreground",
                  )}
                >
                  {action.label}
                </span>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                    action.primary ? "text-white/70" : "text-[#94A3B8]",
                  )}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      );
    }

    /* ── Trend line: daily collection — §5.8 ─────────────────────────────── */
    case "trend": {
      const max = Math.max(...panel.points, 1);
      const min = Math.min(...panel.points, 0);
      const range = max - min || 1;
      const w = 100;
      const h = 40;

      const coords = panel.points.map((p, i) => {
        const x = (i / Math.max(panel.points.length - 1, 1)) * w;
        const y = h - ((p - min) / range) * (h - 6) - 3;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      });

      const line = `M ${coords.join(" L ")}`;
      const area = `${line} L ${w},${h} L 0,${h} Z`;

      return (
        <div>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="h-24 w-full"
            role="img"
            aria-label={`Trend: ${panel.points.join(", ")}`}
          >
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#trendFill)" />
            <path
              d={line}
              fill="none"
              stroke="#4F46E5"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="mt-2 flex justify-between">
            {panel.labels.map((label, i) => (
              <span key={i} className="text-[10px] text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
        </div>
      );
    }
  }
}
