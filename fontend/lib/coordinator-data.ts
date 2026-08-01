import { CLASSES, getClassSlots } from "@/lib/timetable-data";
import { getStaffDirectory } from "@/lib/staff-detail-data";
import { whenFor } from "@/lib/coordinator";
import { istDate } from "@/lib/utils";
import type {
  SubstitutableSlot,
  Substitution,
  SubstitutionBoard,
  SubstitutionFormContext,
  SubstituteCandidate,
} from "@/types/coordinator";
import type { TimetableSlot } from "@/types/timetable";

/**
 * Academic Coordinator data source — C-AC-05 and C-AC-06.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (team plan B-68).
 *
 *   GET    /api/v1/timetable/substitutions?from=&to=   the board
 *   POST   /api/v1/timetable/substitutions             arrange cover
 *   DELETE /api/v1/timetable/substitutions/:id         cancel it
 *
 * Rows are unique on `(slot_id, date)` (DB §7.8), so the fixture is keyed the
 * same way and the form enforces the same constraint before it would ever
 * reach the database.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Nothing here re-seeds a class, a teacher or a period. Slots come from
 * `timetable-data` (which owns the grid) and people from `getStaffDirectory()`
 * (which owns staff identity) — the cross-module ownership rule that stopped
 * the exam monitor inventing a "Rahul Das" who existed nowhere else.
 */

/** Frozen demo clock — Wednesday 29 July 2026, matching every other fixture. */
const T0 = Date.UTC(2026, 6, 29);

/** Today as a plain IST DATE, the anchor both pages compare against. */
const TODAY = istDate(new Date(T0).toISOString());

/** `n` days from T0 as a plain "YYYY-MM-DD". */
function on(days: number): string {
  return istDate(new Date(T0 + days * 86_400_000).toISOString());
}

/** A timestamp `n` days before T0, for `created_at`. */
function at(daysAgo: number): string {
  return new Date(T0 - daysAgo * 86_400_000).toISOString();
}

/** Every slot in the institution, from the module that owns the grid. */
function allSlots(): TimetableSlot[] {
  return CLASSES.flatMap((c) => getClassSlots(c.id));
}

/** Teacher name → staff id, so a substitution row can carry real FKs. */
function staffIdByName(): Map<string, string> {
  return new Map(getStaffDirectory().map((s) => [s.name, s.id]));
}

/**
 * The coordinator who arranged the demo rows.
 *
 * `arranged_by` is a real FK → users.id (§7.8). Latha Venkat is the staff
 * member the session presents as ACADEMIC_COORDINATOR ("Latha" in
 * `DEMO_NAMES`), so the audit trail names the person actually signed in
 * rather than a stranger.
 */
const ARRANGED_BY = "Latha Venkat";

/**
 * Seeded substitutions: [slotId, dayOffset, substituteName, reason, createdDaysAgo]
 *
 * Chosen to sit *mid-workflow* — one already run, two live today, two ahead —
 * so the board's tabs each have something in them. A list where every row is
 * "upcoming" cannot demonstrate the today/past split the page is built around.
 *
 * Every substitute is free in that period: verified against the grid by
 * `busyCells()` below, and asserted in the test suite. A fixture that
 * contradicts its own conflict checker is worse than no fixture.
 */
const SEED: [string, number, string, string, number][] = [
  // Today (Wed) — the two the coordinator is watching this morning.
  //
  // `reason` explains why the ORIGINAL teacher is away, never what the
  // substitute is doing: the row already renders as "X covering Y", so a
  // reason naming the substitute reads as a contradiction.
  ["fy-a-3-2", 0, "Meena Thomas", "At the university moderation meeting.", 2],
  ["fy-a-3-6", 0, "Sunil Rao", "Attending an external viva.", 1],
  // Tomorrow (Thu) — this is the row `timetable-data` already renders in the
  // grid, kept identical here so the two pages cannot disagree.
  ["fy-a-4-3", 1, "Arun Kumar", "Medical leave", 3],
  // Friday
  ["sy-b-5-7", 2, "Neha Rathi", "On exam duty.", 1],
  // Already happened (Mon) — proves the past tab is real
  ["fy-a-1-1", -2, "Arun Kumar", "At a conference.", 6],
];

/**
 * Which (day, period) cells each teacher already occupies.
 *
 * Keyed by staff id and shaped `"{dayOfWeek}-{periodNumber}"`, which is what
 * `findSubstitutionIssues()` looks up. Derived from the grid, so a teacher
 * who gains a period tomorrow automatically stops being offered as free.
 */
function busyCells(): Record<string, string[]> {
  const ids = staffIdByName();
  const out: Record<string, string[]> = {};

  for (const slot of allSlots()) {
    if (slot.slotType === "BREAK" || !slot.teacherName) continue;
    const id = ids.get(slot.teacherName);
    if (!id) continue;
    const cell = `${slot.dayOfWeek}-${slot.periodNumber}`;
    (out[id] ??= []).push(cell);
  }

  return out;
}

/** The seeded rows, joined against the grid and the staff directory. */
function substitutions(): Substitution[] {
  const ids = staffIdByName();
  const slots = allSlots();
  const rows: Substitution[] = [];

  SEED.forEach(([slotId, offset, substituteName, reason, createdDaysAgo], i) => {
    const slot = slots.find((s) => s.id === slotId);
    // A seed pointing at a slot the grid doesn't have is a fixture bug, not a
    // runtime condition — skip it rather than render a half-empty row.
    if (!slot || !slot.teacherName) return;

    const date = on(offset);

    rows.push({
      id: `sub-${i + 1}`,
      slotId,
      date,
      when: whenFor(date, TODAY),
      substituteTeacherId: ids.get(substituteName) ?? substituteName,
      substituteTeacherName: substituteName,
      originalTeacherId: ids.get(slot.teacherName) ?? slot.teacherName,
      originalTeacherName: slot.teacherName,
      reason,
      arrangedByName: ARRANGED_BY,
      createdAt: at(createdDaysAgo),
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      className: slot.className,
      classId: slot.classId,
      roomNo: slot.roomNo,
      slotType: slot.slotType,
    });
  });

  return rows;
}

/* ── C-AC-05 Substitution Management ────────────────────────────────────── */

/**
 * The substitution board.
 *
 * `canEdit` is decided by the caller (the route, from `substitutionAccess()`)
 * and passed *in*, not recomputed here — but it is carried on the payload so
 * the client component cannot forget to thread it. A `canEdit` the component
 * ignores is the bug that gave a Principal working Create/Edit/Delete on
 * eight pages.
 */
export function getSubstitutionBoard(canEdit: boolean): SubstitutionBoard {
  const rows = substitutions();

  // Today first, then soonest upcoming, then most recent past. Within a day,
  // by period, so the morning reads top-to-bottom like the actual timetable.
  const rank = { TODAY: 0, UPCOMING: 1, PAST: 2 } as const;
  rows.sort((a, b) => {
    if (rank[a.when] !== rank[b.when]) return rank[a.when] - rank[b.when];
    if (a.date !== b.date)
      return a.when === "PAST"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date);
    return a.periodNumber - b.periodNumber;
  });

  const live = rows.filter((r) => r.when !== "PAST");

  return {
    today: TODAY,
    rows,
    counts: {
      today: rows.filter((r) => r.when === "TODAY").length,
      upcoming: rows.filter((r) => r.when === "UPCOMING").length,
      past: rows.filter((r) => r.when === "PAST").length,
      coveringTeachers: new Set(live.map((r) => r.substituteTeacherId)).size,
    },
    canEdit,
  };
}

/* ── C-AC-06 Add Substitution ───────────────────────────────────────────── */

/**
 * Everything the form needs.
 *
 * BREAK slots are excluded — there is no teacher to cover. Slots without a
 * teacher are excluded too: §7.8 requires `original_teacher_id NOT NULL`, so
 * a free period cannot be substituted, only filled.
 */
export function getSubstitutionFormContext(): SubstitutionFormContext {
  const ids = staffIdByName();

  const slots: SubstitutableSlot[] = allSlots()
    .filter((s) => s.slotType !== "BREAK" && s.teacherName)
    .map((s) => ({
      slotId: s.id,
      dayOfWeek: s.dayOfWeek,
      periodNumber: s.periodNumber,
      startTime: s.startTime,
      endTime: s.endTime,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      className: s.className,
      classId: s.classId,
      roomNo: s.roomNo,
      teacherId: ids.get(s.teacherName!) ?? s.teacherName!,
      teacherName: s.teacherName!,
    }))
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek ||
        a.periodNumber - b.periodNumber ||
        a.className.localeCompare(b.className),
    );

  /*
   * Who can stand in.
   *
   * Anyone who teaches somewhere in the grid — read off the timetable rather
   * than filtered by role, because the grid is the only place that knows a
   * person actually takes classes. `getStaffDirectory()` still supplies the
   * department and designation so the coordinator can tell two names apart.
   */
  const teaching = new Set(
    allSlots()
      .filter((s) => s.slotType !== "BREAK" && s.teacherName)
      .map((s) => s.teacherName!),
  );

  const candidates: SubstituteCandidate[] = getStaffDirectory()
    .filter((s) => s.isActive && teaching.has(s.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      departmentName: s.departmentName,
      designation: s.designation,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    today: TODAY,
    slots,
    candidates,
    taken: substitutions().map((r) => ({
      slotId: r.slotId,
      date: r.date,
      substituteTeacherId: r.substituteTeacherId,
    })),
    busyCells: busyCells(),
  };
}

