"use client";

/**
 * Presentational bits shared by the Teacher and Student consoles.
 *
 * Both consoles render the same three things over and over — a status pill, a
 * weekday timetable grid and a period row — so they live here rather than
 * being copied into a dozen page components. Formatting helpers
 * (`percent`, `dateTime`, `statusLabel`) are re-exported from the leadership
 * UI so a percentage looks identical on every console in the product.
 */

import Link from "next/link";

import { Card } from "@/components/admin/ui";
import {
  dateOnly,
  dateTime,
  percent,
  statusLabel,
} from "@/components/principal/principal-ui";

export { dateOnly, dateTime, percent, statusLabel };
export { AsyncState, EmptyTable, ExportButton, MetricCard } from "@/components/principal/principal-ui";

/** `classes.day_of_week` is 0 = Sunday, matching the DB column (§7.5). */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** "09:00:00" → "09:00". Times arrive as ISO `time` strings. */
export function clockTime(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

type Tone = "default" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-light text-success-text",
  warning: "bg-warning-light text-warning-text",
  danger: "bg-destructive-light text-destructive-text",
  info: "bg-accent-light text-accent",
};

/**
 * Map a domain status onto a colour once, so "APPROVED" is never green on one
 * page and grey on the next.
 */
function toneForStatus(status: string): Tone {
  const value = status.toUpperCase();
  if (["APPROVED", "PUBLISHED", "PRESENT", "PASS", "PAID", "GRADED", "RESULTS_RELEASED"].includes(value)) {
    return "success";
  }
  if (["PENDING", "SUBMITTED", "UNDER_REVIEW", "DRAFT", "PARTIAL", "IN_PROGRESS", "LATE"].includes(value)) {
    return "warning";
  }
  if (["REJECTED", "FAIL", "ABSENT", "CANCELLED", "OVERDUE", "MALPRACTICE", "WITHHELD"].includes(value)) {
    return "danger";
  }
  if (["ONGOING", "RESUBMIT_REQUESTED", "EXCUSED", "COMPLETED"].includes(value)) return "info";
  return "default";
}

export function StatusPill({
  status,
  tone,
  label,
}: {
  status: string;
  tone?: Tone;
  label?: string;
}) {
  const resolved = tone ?? toneForStatus(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[resolved]}`}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

export interface PeriodLike {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code: string | null;
  subject_name: string | null;
  room_no: string | null;
  slot_type: string;
  /** Teacher view shows the class; student view shows the teacher. */
  secondary: string | null;
}

/**
 * One weekly grid used by both `/teacher/schedule` and `/student/timetable`.
 *
 * Built as a day-by-day list rather than a CSS table: period numbers are not
 * uniform across classes (a lab occupies two), so a fixed row-per-period grid
 * would leave holes on some days and overflow on others.
 */
export function WeeklyGrid({ slots }: { slots: PeriodLike[] }) {
  const byDay = new Map<number, PeriodLike[]>();
  for (const slot of slots) {
    byDay.set(slot.day_of_week, [...(byDay.get(slot.day_of_week) ?? []), slot]);
  }
  // Monday first; Sunday last, because a Sunday period is the exception.
  const days = [1, 2, 3, 4, 5, 6, 0].filter((day) => byDay.has(day));

  if (!days.length) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          No timetable has been published for you yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => (
        <Card key={day} className="!p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-primary">{WEEKDAYS[day]}</h3>
          <ol className="space-y-2">
            {(byDay.get(day) ?? [])
              .slice()
              .sort((a, b) => a.period_number - b.period_number)
              .map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-start justify-between gap-3 rounded-field border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {slot.subject_code ? `${slot.subject_code} · ` : ""}
                      {slot.subject_name ?? statusLabel(slot.slot_type)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {slot.secondary ?? "—"}
                      {slot.room_no ? ` · Room ${slot.room_no}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-foreground">
                      {clockTime(slot.start_time)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {clockTime(slot.end_time)}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

/** A compact stat used across both dashboards. */
export function QuickLink({
  href,
  label,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-field border border-border px-3 py-3 transition hover:border-accent hover:bg-accent-light"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-primary">{label}</span>
        {hint ? (
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </Link>
  );
}

/** A progress bar that turns amber below the institution threshold. */
export function ProgressBar({
  value,
  threshold = 75,
}: {
  value: number | null;
  threshold?: number;
}) {
  const safe = value ?? 0;
  const short = value !== null && value < threshold;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={short ? "h-full rounded-full bg-warning" : "h-full rounded-full bg-success"}
        style={{ width: `${Math.min(Math.max(safe, 0), 100)}%` }}
      />
    </div>
  );
}
