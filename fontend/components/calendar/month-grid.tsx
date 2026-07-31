"use client";

import { cn } from "@/lib/utils";
import { SOURCE_DOT, WEEKDAYS } from "@/lib/calendar";
import type { CalendarDay } from "@/types/calendar";

/**
 * Month grid — PAGE 18.
 *
 * Monday-first to match the timetable's Mon–Sat convention. Each cell shows up
 * to two entries plus an overflow count; selecting a day drives the agenda
 * panel beside it, which is where full detail lives. That keeps cells legible
 * at 320px instead of trying to render everything inline.
 */
export function MonthGrid({
  days,
  selected,
  onSelect,
}: {
  days: CalendarDay[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = day.date === selected;
          const shown = day.events.slice(0, 2);
          const extra = day.events.length - shown.length;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-pressed={isSelected}
              aria-label={`${day.date}, ${day.events.length} event${day.events.length === 1 ? "" : "s"}`}
              className={cn(
                "flex min-h-[64px] min-w-0 flex-col gap-1 rounded-field border p-1.5 text-left transition-colors sm:min-h-[86px]",
                isSelected
                  ? "border-accent bg-accent-light"
                  : day.isToday
                    ? "border-accent/40 bg-white"
                    : "border-border bg-white hover:border-accent",
                !day.inMonth && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] tabular-nums",
                  day.isToday
                    ? "bg-accent font-bold text-white"
                    : "font-medium text-foreground",
                )}
              >
                {day.dayOfMonth}
              </span>

              {/* Compact list on sm+, dots on the narrowest screens */}
              <span className="hidden min-w-0 flex-1 flex-col gap-0.5 sm:flex">
                {shown.map((e) => (
                  <span
                    key={e.id}
                    className="flex min-w-0 items-center gap-1"
                    title={e.title}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        SOURCE_DOT[e.source],
                      )}
                    />
                    <span className="min-w-0 truncate text-[10px] leading-tight text-[#475569]">
                      {e.title}
                    </span>
                  </span>
                ))}
                {extra > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{extra} more
                  </span>
                )}
              </span>

              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {day.events.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      SOURCE_DOT[e.source],
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
