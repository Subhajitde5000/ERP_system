import Link from "next/link";
import { CalendarX2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { SOURCE_META, SOURCE_TONE, formatTime, longDate } from "@/lib/calendar";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { CalendarEvent } from "@/types/calendar";

/**
 * Day agenda — PAGE 18.
 * Full detail for the selected day; the month grid stays compact and this
 * panel carries titles, times and deep links into the owning module.
 */
export function DayAgenda({
  date,
  events,
}: {
  date: string;
  events: CalendarEvent[];
}) {
  return (
    <Card className="min-w-0 p-5">
      <h2 className="font-display text-[15px] font-bold text-foreground">
        {longDate(date)}
      </h2>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {events.length === 0
          ? "Nothing scheduled"
          : `${events.length} ${events.length === 1 ? "entry" : "entries"}`}
      </p>

      {events.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarX2
            className="mx-auto mb-2 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-[13px] text-muted-foreground">
            No classes, exams or deadlines on this day.
          </p>
        </div>
      ) : (
        <ul className="mt-3 min-w-0 divide-y divide-border border-t border-border">
          {events.map((e) => {
            const meta = SOURCE_META[e.source];
            const tone = SOURCE_TONE[e.source];
            const Icon = meta.icon;

            return (
              <li key={e.id} className="min-w-0">
                <Link
                  href={e.href}
                  className="flex min-w-0 gap-3 py-3 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-field",
                      TONE_BG[tone],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                        {e.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                          TONE_BG[tone],
                          TONE_TEXT[tone],
                        )}
                      >
                        {meta.label}
                      </span>
                    </span>
                    {e.detail && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                        {e.detail}
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {e.startTime ? formatTime(e.startTime) : "All day"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
