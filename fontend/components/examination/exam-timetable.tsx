import Link from "next/link";
import { Clock, Globe, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { examDayLabel, examDateTime } from "@/lib/examination";
import { Card } from "@/components/dashboard/primitives";
import type { TimetableEntry } from "@/types/examination";

/**
 * Academic Coordinator — exam timetable by date and class (PAGE 6).
 * Grouped by day so scheduling clashes are visible at a glance.
 */
export function ExamTimetable({ entries }: { entries: TimetableEntry[] }) {
  // Group by calendar day, preserving chronological order
  const days = new Map<string, TimetableEntry[]>();
  for (const e of entries) {
    const key = e.scheduledAt.slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(e);
  }

  if (entries.length === 0) {
    return (
      <Card className="border-dashed py-14 text-center">
        <p className="text-[13px] text-muted-foreground">
          No exams scheduled.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      {[...days.entries()].map(([day, items]) => {
        // Two exams for the same class on one day is a scheduling clash
        const classes = items.map((i) => i.className);
        const clash = classes.some((c, i) => classes.indexOf(c) !== i);

        return (
          <Card key={day} className="min-w-0 p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[15px] font-bold text-foreground">
                {examDayLabel(day)}
              </h2>
              <span className="flex items-center gap-2">
                {clash && (
                  <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                    CLASS CLASH
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {items.length} exam{items.length === 1 ? "" : "s"}
                </span>
              </span>
            </div>

            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {items.map((e) => (
                <li key={e.examId} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
                  <span className="w-14 shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
                    {examDateTime(e.scheduledAt).split(", ")[1]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/examination/${e.examId}`}
                      className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent"
                    >
                      {e.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{e.subjectCode}</span> ·{" "}
                      {e.className}
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {e.durationMinutes}m
                  </span>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      e.mode === "ONLINE"
                        ? "bg-accent-light text-accent"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {e.mode === "ONLINE" ? (
                      <Globe className="h-2.5 w-2.5" aria-hidden="true" />
                    ) : (
                      <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                    )}
                    {e.mode}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
