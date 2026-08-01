/**
 * Academic Coordinator contracts — C-AC-05 (Substitution Management) and
 * C-AC-06 (Add Substitution).
 *
 * Mirrors `timetable_substitutions` in `database_design_complete.md` §7.8:
 *
 *   id · tenant_id · slot_id FK→timetable_slots · date DATE
 *   substitute_teacher_id FK→users · original_teacher_id FK→users
 *   reason TEXT · arranged_by FK→users (the coordinator) · created_at
 *   UNIQUE (slot_id, date)
 *
 * The row stores only ids, so everything a coordinator needs to read a
 * substitution — which class, which subject, what time — is denormalised here
 * exactly the way `GET /timetable/substitutions` would join it. Nothing in
 * this file invents a column the schema does not have.
 *
 * Note `reason` is free TEXT with **no FK to `leave_requests`**: the schema
 * does not connect a substitution to why the teacher is away, so neither does
 * this page. Deriving cover from the leave module would be inventing a join.
 */

import type { DayOfWeek, SlotType } from "@/types/timetable";

/**
 * Where a substitution sits relative to today.
 *
 * Not a database column — §7.8 stores only `date`, so this is derived on read
 * against the institution's today in IST. C-AC-05 asks for "today's /
 * upcoming" substitutions, which is precisely this split.
 */
export type SubstitutionWhen = "TODAY" | "UPCOMING" | "PAST";

/** One row of `timetable_substitutions`, joined for display. */
export interface Substitution {
  id: string;
  /** FK → timetable_slots.id */
  slotId: string;
  /** DATE — "YYYY-MM-DD", no time component (§7.8). */
  date: string;
  /** Derived from `date` against today, in IST. */
  when: SubstitutionWhen;

  /** FK → users.id, plus the joined name. */
  substituteTeacherId: string;
  substituteTeacherName: string;
  originalTeacherId: string;
  originalTeacherName: string;

  /** TEXT, nullable in the schema. */
  reason: string | null;
  /** FK → users.id — the coordinator who arranged it. Nullable in §7.8. */
  arrangedByName: string | null;
  createdAt: string;

  /* ── Joined from `timetable_slots` (§7.8) ───────────────────────────── */
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectCode: string | null;
  subjectName: string | null;
  className: string;
  classId: string;
  roomNo: string | null;
  slotType: SlotType;
}

/** C-AC-05 — "List of today's / upcoming substitutions". */
export interface SubstitutionBoard {
  today: string;
  /** Every substitution: today first, then upcoming by date, then past. */
  rows: Substitution[];
  counts: {
    today: number;
    upcoming: number;
    past: number;
    /** Distinct teachers covering someone else's class today or later. */
    coveringTeachers: number;
  };
  canEdit: boolean;
}

/* ── C-AC-06 Add Substitution ───────────────────────────────────────────── */

/** A teacher the coordinator can pick as a substitute. */
export interface SubstituteCandidate {
  id: string;
  name: string;
  departmentName: string;
  designation: string;
}

/** A slot the coordinator can arrange cover for. */
export interface SubstitutableSlot {
  slotId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectCode: string | null;
  subjectName: string | null;
  className: string;
  classId: string;
  roomNo: string | null;
  teacherId: string;
  teacherName: string;
}

/**
 * Everything C-AC-06's form needs, resolved on the server.
 *
 * The whole slot list ships once and the client re-filters as the date
 * changes: a substitution is always for one weekday, so a round-trip per date
 * would fetch data the page already holds.
 */
export interface SubstitutionFormContext {
  today: string;
  slots: SubstitutableSlot[];
  candidates: SubstituteCandidate[];
  /**
   * Existing rows, as `(slot_id, date, substitute)`.
   *
   * `slotId + date` is the §7.8 unique key; `substituteTeacherId` rides along
   * so the form can count how many periods one teacher is already covering
   * that day without a second round-trip.
   */
  taken: { slotId: string; date: string; substituteTeacherId: string }[];
  /**
   * Teacher id → the `(dayOfWeek, periodNumber)` cells they already teach.
   * Lets the form tell the coordinator who is actually free for that period.
   */
  busyCells: Record<string, string[]>;
}

/**
 * Why a proposed substitution cannot (or should not) be saved.
 *
 * Same two-level shape as the Exam Controller's `ScheduleClash`: some
 * problems are refusals, others are judgement calls the coordinator is
 * entitled to make.
 */
export type SubstitutionIssueKind =
  | "ALREADY_COVERED" // violates UNIQUE (slot_id, date)
  | "SUBSTITUTE_BUSY" // they teach their own class that period
  | "SAME_TEACHER" // substitute === original
  | "PAST_DATE"
  | "WRONG_DAY" // the slot's weekday doesn't match the chosen date
  | "HEAVY_LOAD"; // already covering several periods that day

export interface SubstitutionIssue {
  kind: SubstitutionIssueKind;
  message: string;
  /** Blocking issues disable the save; warnings are acknowledged and pass. */
  blocking: boolean;
}
