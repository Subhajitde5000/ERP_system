import type { LucideIcon } from "lucide-react";

/**
 * Calendar contracts — role_based_shared_pages.md PAGE 18 (C-RB-18).
 *
 * The calendar has no table of its own: it *aggregates* records that already
 * exist — `timetable_slots`, `exams`, `assignments`, `result_publications`,
 * `attendance_leaves`, `fee_installments` — plus institution holidays and
 * HR/placement dates. So the source types live with their own modules and
 * this file only describes the unified event shape.
 */

/** Which module a calendar entry came from — drives icon and colour. */
export type CalendarSource =
  | "TIMETABLE"
  | "EXAM"
  | "ASSIGNMENT"
  | "RESULT"
  | "HOLIDAY"
  | "EVENT"
  | "FEE"
  | "LEAVE"
  | "HR"
  | "PLACEMENT";

/** A single entry on the calendar, normalised across every source module. */
export interface CalendarEvent {
  id: string;
  source: CalendarSource;
  title: string;
  /** Secondary line — class, subject, venue, amount, etc. */
  detail: string | null;
  /** ISO date (YYYY-MM-DD) — the day this lands on */
  date: string;
  /** "09:00" for timed entries; null for all-day (holidays, due dates) */
  startTime: string | null;
  endTime: string | null;
  /** Deep link into the owning module */
  href: string;
  /** Deadlines and flagged items get the accent edge */
  urgent?: boolean;
}

export interface SourceMeta {
  label: string;
  icon: LucideIcon;
}

/** A day cell in the month grid. */
export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  /** false for the leading/trailing days of adjacent months */
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}
