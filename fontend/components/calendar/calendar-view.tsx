"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MONTH_NAMES,
  SOURCE_DOT,
  SOURCE_META,
  TODAY,
  buildMonth,
} from "@/lib/calendar";
import { Card } from "@/components/dashboard/primitives";
import { DayAgenda } from "./day-agenda";
import { MonthGrid } from "./month-grid";
import type { CalendarEvent, CalendarSource } from "@/types/calendar";

/**
 * Calendar — PAGE 18.
 *
 * One month grid for every role; only the event sources differ. Source
 * filters are built from what's actually present, so a Placement Officer
 * never sees an empty "Holidays" toggle.
 */
export function CalendarView({
  events,
  year,
  month,
  onMonthChange,
}: {
  events: CalendarEvent[];
  year: number;
  month: number;
  /** Month navigation is a server round-trip so each month is fetched fresh */
  onMonthChange: (year: number, month: number) => void;
}) {
  const [selected, setSelected] = useState(() => {
    // Land on today when viewing the current month, else the 1st
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return TODAY.startsWith(prefix) ? TODAY : `${prefix}-01`;
  });
  const [hidden, setHidden] = useState<Set<CalendarSource>>(new Set());

  const present = useMemo(() => {
    const order = Object.keys(SOURCE_META) as CalendarSource[];
    const seen = new Set(events.map((e) => e.source));
    return order.filter((s) => seen.has(s));
  }, [events]);

  const visible = useMemo(
    () => events.filter((e) => !hidden.has(e.source)),
    [events, hidden],
  );

  const days = useMemo(
    () => buildMonth(year, month, visible),
    [year, month, visible],
  );

  const selectedEvents = useMemo(
    () => days.find((d) => d.date === selected)?.events ?? [],
    [days, selected],
  );

  function toggle(source: CalendarSource) {
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  function step(delta: number) {
    const m = month + delta;
    const y = year + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    setSelected(`${y}-${String(nm + 1).padStart(2, "0")}-01`);
    onMonthChange(y, nm);
  }

  return (
    <div className="grid min-w-0 gap-4">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="rounded-field border border-border bg-white p-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <h2 className="min-w-[150px] text-center font-display text-[16px] font-bold text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next month"
            className="rounded-field border border-border bg-white p-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <span className="text-[12px] text-muted-foreground">
          {visible.length} {visible.length === 1 ? "entry" : "entries"} this month
        </span>
      </div>

      {/* Source legend, doubling as filters */}
      <div
        role="group"
        aria-label="Filter by type"
        className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
      >
        {present.map((s) => {
          const on = !hidden.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={on}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition",
                on
                  ? "border-border bg-white text-foreground"
                  : "border-border bg-muted text-muted-foreground opacity-60",
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full", SOURCE_DOT[s])}
                aria-hidden="true"
              />
              {SOURCE_META[s].label}
            </button>
          );
        })}
      </div>

      {/* Grid + agenda */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0 p-3 sm:p-4">
          <MonthGrid days={days} selected={selected} onSelect={setSelected} />
        </Card>

        <DayAgenda date={selected} events={selectedEvents} />
      </div>
    </div>
  );
}
