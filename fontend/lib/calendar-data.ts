import type { InstitutionRole } from "@/types/auth";
import type { CalendarEvent, CalendarSource } from "@/types/calendar";
import { DAYS } from "./timetable";
import { sourcesForRoles } from "./calendar";
import { getClassSlots, getTeacherSlots } from "./timetable-data";
import { getAllExams, getStudentExams } from "./examination-data";
import { getOwnAssignments, getStudentAssignments } from "./assignment-data";
import { getPublications } from "./result-data";

/**
 * Calendar aggregator.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with `GET /api/v1/calendar?from=&to=&sources=`.
 *
 * The backend should aggregate server-side (one query per source, scoped to
 * the caller) rather than making the client fan out. Until then this derives
 * from the same fixtures the other pages use, so the calendar can never
 * disagree with the module it came from.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree. */
const T0 = Date.UTC(2026, 6, 29);
const dateOffset = (days: number) =>
  new Date(T0 + days * DAY).toISOString().slice(0, 10);

/**
 * Institution-local date/time from a UTC timestamp.
 * Slicing the ISO string would show UTC — a 10:00 IST exam rendered as 02:30.
 */
const TZ = "Asia/Kolkata";

const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });

/* ── Calendar-only sources (no table of their own yet) ──────────────────── */

const HOLIDAYS: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-15", title: "Independence Day", detail: "Institution closed" },
  { date: "2026-08-26", title: "Onam", detail: "Institution closed" },
  { date: "2026-07-31", title: "Local holiday", detail: "Founder's Day" },
];

const EVENTS: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-05", title: "CSE department seminar", detail: "Seminar Hall 2 · 2:30 PM" },
  { date: "2026-08-12", title: "Annual sports meet", detail: "Main ground · all day" },
  { date: "2026-08-20", title: "Parent-teacher meeting", detail: "Classrooms · 10:00 AM" },
];

const FEE_DUES: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-15", title: "Second installment due", detail: "₹5,000" },
  { date: "2026-09-15", title: "Third installment due", detail: "₹5,000" },
];

const LEAVES: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-02", title: "Priya Sharma — casual leave", detail: "2–4 August" },
  { date: "2026-08-05", title: "Arun Kumar — sick leave", detail: "1 day" },
  { date: "2026-08-08", title: "Hostel leave — Aryan Mehta", detail: "Family function" },
];

const HR_DATES: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-25", title: "Payroll cut-off", detail: "August payroll run" },
  { date: "2026-09-01", title: "Appraisal cycle opens", detail: "10 reviews pending" },
];

const PLACEMENT_DATES: { date: string; title: string; detail: string }[] = [
  { date: "2026-08-18", title: "Infosys pre-placement talk", detail: "Auditorium · 11:00 AM" },
  { date: "2026-08-20", title: "Infosys campus drive", detail: "CSE · ECE · IT" },
  { date: "2026-08-27", title: "Offer acceptance deadline", detail: "8 offers pending" },
];

/**
 * Expand a weekly timetable into dated entries across the visible month.
 * Slots repeat every week, so this walks the month and matches day-of-week.
 */
function expandTimetable(
  slots: ReturnType<typeof getClassSlots>,
  year: number,
  month: number,
  showClass: boolean,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const js = new Date(Date.UTC(year, month, d)).getUTCDay();
    if (js === 0) continue; // Sunday — no classes
    const dow = js;

    for (const slot of slots) {
      if (slot.dayOfWeek !== dow || slot.slotType === "BREAK") continue;
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({
        id: `tt-${slot.id}-${date}`,
        source: "TIMETABLE",
        title: slot.subjectCode ?? slot.subjectName ?? "Class",
        detail: showClass
          ? `${slot.className}${slot.roomNo ? ` · ${slot.roomNo}` : ""}`
          : `${slot.teacherName ?? ""}${slot.roomNo ? ` · ${slot.roomNo}` : ""}`,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        href: "/timetable",
      });
    }
  }
  return out;
}

/**
 * Build the calendar for a role, for one month.
 * Only the sources that role is entitled to are queried (PAGE 18 matrix).
 */
export function getCalendarEvents(
  roles: InstitutionRole[],
  year: number,
  month: number,
): CalendarEvent[] {
  const sources = new Set<CalendarSource>(sourcesForRoles(roles));
  const isStudentSide =
    roles.includes("STUDENT") || roles.includes("PARENT");
  const out: CalendarEvent[] = [];

  // ── Timetable ──────────────────────────────────────────────────────
  if (sources.has("TIMETABLE")) {
    const slots = isStudentSide ? getClassSlots("fy-a") : getTeacherSlots();
    out.push(...expandTimetable(slots, year, month, !isStudentSide));
  }

  // ── Exams ──────────────────────────────────────────────────────────
  if (sources.has("EXAM")) {
    if (isStudentSide) {
      for (const e of getStudentExams()) {
        out.push({
          id: `ex-${e.id}`,
          source: "EXAM",
          title: e.title,
          detail: `${e.subjectCode} · ${e.totalMarks} marks`,
          date: dayOf(e.scheduledAt),
          startTime: timeOf(e.scheduledAt),
          endTime: null,
          href: `/examination/${e.id}`,
          urgent: true,
        });
      }
    } else {
      for (const e of getAllExams()) {
        out.push({
          id: `ex-${e.id}`,
          source: "EXAM",
          title: e.title,
          detail: `${e.subjectCode} · ${e.className} · ${e.mode}`,
          date: dayOf(e.scheduledAt),
          startTime: timeOf(e.scheduledAt),
          endTime: null,
          href: `/examination/${e.id}`,
          urgent: true,
        });
      }
    }
  }

  // ── Assignment deadlines ───────────────────────────────────────────
  if (sources.has("ASSIGNMENT")) {
    const list = isStudentSide ? getStudentAssignments() : getOwnAssignments();
    for (const a of list) {
      out.push({
        id: `as-${a.id}`,
        source: "ASSIGNMENT",
        title: `Due: ${a.title}`,
        detail: `${a.subjectCode} · ${a.totalMarks} marks`,
        date: dayOf(a.dueDate),
        startTime: null,
        endTime: null,
        href: "/assignments",
        urgent: true,
      });
    }
  }

  // ── Result publication dates ───────────────────────────────────────
  if (sources.has("RESULT")) {
    for (const p of getPublications()) {
      if (!p.publishedAt) continue;
      out.push({
        id: `rs-${p.id}`,
        source: "RESULT",
        title: p.title,
        detail: `Published · ${p.studentCount} students`,
        date: dayOf(p.publishedAt),
        startTime: null,
        endTime: null,
        href: "/results",
      });
    }
    // Upcoming publication targets
    out.push({
      id: "rs-upcoming",
      source: "RESULT",
      title: "Mid-Term results — target release",
      detail: "Awaiting principal approval",
      date: dateOffset(9),
      startTime: null,
      endTime: null,
      href: "/results",
    });
  }

  // ── Flat calendar-only sources ─────────────────────────────────────
  const flat: [CalendarSource, typeof HOLIDAYS, string][] = [
    ["HOLIDAY", HOLIDAYS, "/calendar"],
    ["EVENT", EVENTS, "/calendar"],
    ["FEE", FEE_DUES, "/fees"],
    ["LEAVE", LEAVES, "/attendance"],
    ["HR", HR_DATES, "/hr"],
    ["PLACEMENT", PLACEMENT_DATES, "/placement"],
  ];

  for (const [source, rows, href] of flat) {
    if (!sources.has(source)) continue;
    for (const [i, r] of rows.entries()) {
      out.push({
        id: `${source.toLowerCase()}-${i}`,
        source,
        title: r.title,
        detail: r.detail,
        date: r.date,
        startTime: null,
        endTime: null,
        href,
        urgent: source === "FEE",
      });
    }
  }

  // Keep only the requested month
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return out.filter((e) => e.date.startsWith(prefix));
}

/** Weekday label for the agenda list. */
export function weekdayName(date: string): string {
  const js = new Date(`${date}T00:00:00Z`).getUTCDay();
  return DAYS.find((d) => d.value === js)?.long ?? "Sunday";
}
