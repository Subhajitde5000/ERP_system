"use client";

/**
 * Weekly day-column grid shared by the Teacher schedule (C-TC-02) and the
 * Student timetable (C-ST-06): both render timetable slots grouped by
 * `day_of_week` (1 = Monday … 6 = Saturday), differing only in the text on
 * each card. Callers map their wire slots into `WeeklyGridEntry` so this
 * stays the single grid implementation.
 */

import { Card, EmptyState } from "@/components/admin/ui";

export interface WeeklyGridEntry {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  heading: string;
  subheading: string | null;
  meta: string | null;
  slot_type: string;
}

export const WEEK_DAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
];

const SLOT_TYPE_CLASS: Record<string, string> = {
  CLASS: "border-accent-border bg-accent-light",
  BREAK: "border-border bg-muted",
  LAB: "border-success-border bg-success-light",
  SPORTS: "border-success-border bg-success-light",
  LIBRARY: "border-warning-border bg-warning-light",
  ASSEMBLY: "border-warning-border bg-warning-light",
};

export function clockTime(value: string): string {
  // "09:30:00" → "09:30"
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function WeeklySlotGrid({
  slots,
  highlightDay,
  emptyText = "No periods are scheduled.",
}: {
  slots: WeeklyGridEntry[];
  /** Today (1-6) gets a header highlight when rendered inside the week. */
  highlightDay?: number;
  emptyText?: string;
}) {
  if (!slots.length) {
    return (
      <Card>
        <EmptyState text={emptyText} />
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {WEEK_DAYS.map(({ day, label }) => {
        const daySlots = slots
          .filter((slot) => slot.day_of_week === day)
          .sort((a, b) => a.period_number - b.period_number);
        return (
          <section key={day} aria-label={label} className="flex min-w-0 flex-col gap-2">
            <h2
              className={`rounded-field px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${
                highlightDay === day ? "bg-accent text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </h2>
            {daySlots.length ? (
              daySlots.map((slot) => (
                <article
                  key={slot.id}
                  className={`rounded-field border p-3 ${SLOT_TYPE_CLASS[slot.slot_type] ?? "border-border bg-card"}`}
                >
                  <p className="text-[11px] font-bold text-muted-foreground">
                    P{slot.period_number} · {clockTime(slot.start_time)}–{clockTime(slot.end_time)}
                  </p>
                  <h3 className="mt-1 truncate text-sm font-semibold text-primary">{slot.heading}</h3>
                  {slot.subheading ? (
                    <p className="truncate text-xs text-muted-foreground">{slot.subheading}</p>
                  ) : null}
                  {slot.meta ? <p className="mt-1 text-[11px] text-muted-foreground">{slot.meta}</p> : null}
                </article>
              ))
            ) : (
              <p className="rounded-field border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                Free
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
