import {
  BadgeIndianRupee,
  BookOpenCheck,
  CalendarDays,
  CalendarOff,
  FileText,
  FileSpreadsheet,
  Handshake,
  PartyPopper,
  Plane,
  Wallet,
} from "lucide-react";

import type { InstitutionRole } from "@/types/auth";
import type {
  CalendarDay,
  CalendarEvent,
  CalendarSource,
  SourceMeta,
} from "@/types/calendar";
import type { Tone } from "@/types/dashboard";

/**
 * Calendar role logic — role_based_shared_pages.md PAGE 18.
 *
 * Like notifications (PAGE 15), this is a **content filter**, not a view
 * dispatch: every role sees the same month grid, only the event sources
 * differ. `ROLE_SOURCES` is the PAGE 18 matrix as data.
 *
 * TODO(Dev-B): the backend scopes each source by the caller, so this mapping
 * decides which feeds to request and drives the legend/filters.
 */

const ROLE_SOURCES: Record<InstitutionRole, CalendarSource[]> = {
  // Own teaching periods, exam dates, assignment due dates, holidays
  TEACHER: ["TIMETABLE", "EXAM", "ASSIGNMENT", "HOLIDAY"],
  MENTOR: ["TIMETABLE", "EXAM", "ASSIGNMENT", "HOLIDAY"],

  // Own class timetable, exams, deadlines, holidays, hostel leave dates
  STUDENT: ["TIMETABLE", "EXAM", "ASSIGNMENT", "HOLIDAY", "LEAVE"],

  // Child's exam dates, school holidays, fee due dates
  PARENT: ["EXAM", "HOLIDAY", "FEE"],

  // All exam schedules, result publication dates
  EXAM_CONTROLLER: ["EXAM", "RESULT"],

  // Full academic calendar: timetable, exams, events, holidays
  ACADEMIC_COORDINATOR: ["TIMETABLE", "EXAM", "EVENT", "HOLIDAY"],

  // Dept exam schedule, dept events, teacher leaves
  HOD: ["EXAM", "EVENT", "LEAVE"],

  // Staff leave calendar, appraisal cycle dates, payroll schedule
  HR_MANAGER: ["LEAVE", "HR"],

  // Drive dates, interview schedules, offer deadlines
  PLACEMENT_OFFICER: ["PLACEMENT"],

  // ── Not in the PAGE 18 matrix ────────────────────────────────────────
  // Everyone can still see the institution calendar; module-specific feeds
  // wait until their events are specified.
  INSTITUTION_ADMIN: ["EXAM", "EVENT", "HOLIDAY", "RESULT"],
  PRINCIPAL: ["EXAM", "EVENT", "HOLIDAY", "RESULT"],
  VICE_PRINCIPAL: ["EXAM", "EVENT", "HOLIDAY"],
  ACCOUNTANT: ["FEE", "HOLIDAY"],
  LIBRARIAN: ["EVENT", "HOLIDAY"],
  HOSTEL_WARDEN: ["LEAVE", "EVENT", "HOLIDAY"],
  TRANSPORT_MANAGER: ["EVENT", "HOLIDAY"],
  ADMISSION_OFFICER: ["EVENT", "HOLIDAY"],
  STORE_MANAGER: ["EVENT", "HOLIDAY"],
};

/** Sources a set of roles sees — union for multi-role users. */
export function sourcesForRoles(roles: InstitutionRole[]): CalendarSource[] {
  const seen = new Set<CalendarSource>();
  for (const role of roles) {
    for (const source of ROLE_SOURCES[role] ?? []) seen.add(source);
  }
  return [...seen];
}

/* ── Presentation ───────────────────────────────────────────────────────── */

export const SOURCE_META: Record<CalendarSource, SourceMeta> = {
  TIMETABLE: { label: "Classes", icon: CalendarDays },
  EXAM: { label: "Exams", icon: FileSpreadsheet },
  ASSIGNMENT: { label: "Assignments", icon: FileText },
  RESULT: { label: "Results", icon: BookOpenCheck },
  HOLIDAY: { label: "Holidays", icon: CalendarOff },
  EVENT: { label: "Events", icon: PartyPopper },
  FEE: { label: "Fees", icon: BadgeIndianRupee },
  LEAVE: { label: "Leave", icon: Plane },
  HR: { label: "HR", icon: Wallet },
  PLACEMENT: { label: "Placement", icon: Handshake },
};

export const SOURCE_TONE: Record<CalendarSource, Tone> = {
  TIMETABLE: "accent",
  EXAM: "danger",
  ASSIGNMENT: "warning",
  RESULT: "success",
  HOLIDAY: "cyan",
  EVENT: "success",
  FEE: "danger",
  LEAVE: "muted",
  HR: "warning",
  PLACEMENT: "accent",
};

/** Dot colour used inside month cells. */
export const SOURCE_DOT: Record<CalendarSource, string> = {
  TIMETABLE: "bg-accent",
  EXAM: "bg-destructive",
  ASSIGNMENT: "bg-warning",
  RESULT: "bg-success",
  HOLIDAY: "bg-secondary",
  EVENT: "bg-success",
  FEE: "bg-destructive",
  LEAVE: "bg-[#CBD5E1]",
  HR: "bg-warning",
  PLACEMENT: "bg-accent",
};

/* ── Month grid maths ───────────────────────────────────────────────────── */

/** Fixed "today" so server and client agree. */
export const TODAY = "2026-07-29";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Mon-first weekday headers, matching the timetable's Mon–Sat convention. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Build a 6×7 month grid, Monday-first, with adjacent-month spill.
 * Events are bucketed by date so each cell carries its own list.
 */
export function buildMonth(
  year: number,
  month: number,
  events: CalendarEvent[],
): CalendarDay[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  // Cells only show the first couple of entries, so surface the notable ones:
  // exams/deadlines/holidays outrank routine classes, then chronological.
  const weight = (e: CalendarEvent) =>
    e.source === "TIMETABLE" ? 1 : 0;

  for (const list of byDate.values()) {
    list.sort(
      (a, b) =>
        weight(a) - weight(b) ||
        (a.startTime ?? "99").localeCompare(b.startTime ?? "99"),
    );
  }

  const first = new Date(Date.UTC(year, month, 1));
  // JS: 0 = Sunday. Shift so Monday = 0.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarDay[] = [];

  for (let i = lead - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const date = iso(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d);
    cells.push({ date, dayOfMonth: d, inMonth: false, isToday: false, events: [] });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(year, month, d);
    cells.push({
      date,
      dayOfMonth: d,
      inMonth: true,
      isToday: date === TODAY,
      events: byDate.get(date) ?? [],
    });
  }

  let next = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const date = iso(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, next);
    cells.push({ date, dayOfMonth: next, inMonth: false, isToday: false, events: [] });
    next += 1;
    if (cells.length >= 42) break;
  }

  return cells;
}

/** "29 Jul 2026" for the agenda heading. */
export function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "9:00 AM" — reuses the timetable's 24h → 12h conversion. */
export { formatTime } from "./timetable";
