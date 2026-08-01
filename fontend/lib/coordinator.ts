import { istDate } from "@/lib/utils";
import { timetablePermissions } from "@/lib/timetable";
import type { InstitutionRole } from "@/types/auth";
import type { DayOfWeek } from "@/types/timetable";
import type {
  SubstitutableSlot,
  SubstitutionIssue,
  SubstitutionWhen,
} from "@/types/coordinator";

/**
 * Academic Coordinator logic — C-AC-05 and C-AC-06.
 *
 * `role_based_system_design.md` §4.5 gives the coordinator "Timetable —
 * create and manage timetable"; §6's matrix confirms they are the only
 * institution role with a build grant. Substitutions are part of that grant,
 * so this module holds the rules both pages share.
 */

/* ── Access ─────────────────────────────────────────────────────────────── */

/**
 * Who reaches the substitution pages.
 *
 * Deliberately delegated to `timetablePermissions()` rather than restated.
 * PAGE 10 already decides who may build the timetable and who may arrange a
 * one-off substitution (`canSubstitute`), and a substitution *is* a timetable
 * edit — a second, independent table here would be one refactor away from
 * disagreeing with the grid that renders the same rows.
 *
 * That yields, from §4.5 / §6:
 *   • ACADEMIC_COORDINATOR → edit (the only role with `canSubstitute`)
 *   • INSTITUTION_ADMIN / PRINCIPAL / VICE_PRINCIPAL → read (institution view)
 *   • HOD → read (department view)
 *   • TEACHER / MENTOR / STUDENT / PARENT → read is not useful here, but they
 *     hold a timetable view, so they see the list without the levers
 *   • Everyone else (`view: "NONE"`) → refused
 */
export function substitutionAccess(roles: InstitutionRole[]): {
  canView: boolean;
  canEdit: boolean;
  deniedReason: string | null;
} {
  const perms = timetablePermissions(roles);

  if (perms.view === "NONE") {
    return {
      canView: false,
      canEdit: false,
      deniedReason:
        "Substitutions are part of the timetable, which isn't in your role.",
    };
  }

  return { canView: true, canEdit: perms.canSubstitute, deniedReason: null };
}

/* ── Thresholds ─────────────────────────────────────────────────────────── */

/**
 * How many periods one teacher may cover in a day before the form warns.
 *
 * No doc states a limit, so it lives here as one named constant rather than a
 * literal buried in the checker — the same call made for `SLA_HOURS` and
 * `TAB_SWITCH_FLAG_THRESHOLD`.
 *
 * TODO(Dev-A): belongs in institution settings once §4.2 grows a policy block.
 */
export const HEAVY_COVER_LOAD = 2;

/* ── Labels ─────────────────────────────────────────────────────────────── */

export const WHEN_LABELS: Record<SubstitutionWhen, string> = {
  TODAY: "Today",
  UPCOMING: "Upcoming",
  PAST: "Past",
};

/* ── Date helpers ───────────────────────────────────────────────────────── */

/**
 * Where a DATE sits relative to today.
 *
 * Both sides are plain "YYYY-MM-DD" in IST, so this is a string comparison —
 * no `Date` is constructed, which is what makes it immune to the UTC
 * roll-back that shifted the exam scheduler by 5½ hours.
 */
export function whenFor(date: string, today: string): SubstitutionWhen {
  if (date === today) return "TODAY";
  return date > today ? "UPCOMING" : "PAST";
}

/**
 * The weekday of a DATE as the schema's 1=Mon…6=Sat, or `null` for Sunday.
 *
 * Parsed as UTC midnight deliberately: a "YYYY-MM-DD" has no time, so there
 * is no zone to convert. `new Date("2026-07-29")` is already UTC midnight;
 * reading `getUTCDay()` keeps it that way, whereas `getDay()` would shift the
 * weekday for anyone west of Greenwich.
 */
export function dowOf(date: string): DayOfWeek | null {
  const t = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  const js = new Date(t).getUTCDay(); // 0 = Sunday
  return js === 0 ? null : (js as DayOfWeek);
}

/** "2026-07-29" → "Wed 29 Jul 2026", always IST. */
export function dateLabel(date: string): string {
  const t = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC", // the value is a plain date; UTC keeps it unshifted
  });
}

/* ── Conflict checking (C-AC-06) ────────────────────────────────────────── */

/**
 * Everything wrong with a proposed substitution.
 *
 * A pure function with its own test, not a check buried in the form: this is
 * the rule that stops a coordinator putting one teacher in two rooms at once,
 * and it is the thing most worth being able to test directly.
 *
 * Blocking vs. warning:
 *   • `ALREADY_COVERED` blocks — it violates UNIQUE (slot_id, date) and the
 *     insert would fail at the database anyway.
 *   • `SUBSTITUTE_BUSY` blocks — the substitute is timetabled to teach their
 *     own class that period, so they physically cannot take this one.
 *   • `SAME_TEACHER`, `PAST_DATE`, `WRONG_DAY` block — each describes a row
 *     that is simply wrong.
 *   • `HEAVY_LOAD` only warns. Asking one teacher to cover a third period is
 *     a judgement call a coordinator is entitled to make on a bad morning;
 *     refusing it would model a rule the institution does not have.
 */
export function findSubstitutionIssues(
  proposed: {
    slot: SubstitutableSlot | null;
    date: string;
    substituteId: string;
    substituteName: string;
  },
  ctx: {
    today: string;
    taken: { slotId: string; date: string; substituteTeacherId: string }[];
    busyCells: Record<string, string[]>;
    /** Other slots the substitute is already covering on this date. */
    coveringCount: number;
  },
): SubstitutionIssue[] {
  const issues: SubstitutionIssue[] = [];
  const { slot, date, substituteId, substituteName } = proposed;

  if (!slot || !date || !substituteId) return issues;

  // Past dates — compared as plain date strings, both already IST
  if (date < ctx.today) {
    issues.push({
      kind: "PAST_DATE",
      message: "That date has already passed — the period cannot be covered.",
      blocking: true,
    });
  }

  // The slot's weekday must match the chosen date
  const dow = dowOf(date);
  if (dow !== null && dow !== slot.dayOfWeek) {
    issues.push({
      kind: "WRONG_DAY",
      message: `${slot.className} doesn't have this period on ${dateLabel(date)}.`,
      blocking: true,
    });
  }

  // UNIQUE (slot_id, date) — §7.8
  if (ctx.taken.some((t) => t.slotId === slot.slotId && t.date === date)) {
    issues.push({
      kind: "ALREADY_COVERED",
      message: "This period already has a substitute on that date.",
      blocking: true,
    });
  }

  // Substituting a teacher for themselves is a no-op
  if (substituteId === slot.teacherId) {
    issues.push({
      kind: "SAME_TEACHER",
      message: `${substituteName} already teaches this period.`,
      blocking: true,
    });
  } else if (
    dow !== null &&
    (ctx.busyCells[substituteId] ?? []).includes(`${dow}-${slot.periodNumber}`)
  ) {
    // Only meaningful when the day is right and it isn't the same person
    issues.push({
      kind: "SUBSTITUTE_BUSY",
      message: `${substituteName} is teaching their own class in this period.`,
      blocking: true,
    });
  }

  // Judgement call, not a refusal
  if (ctx.coveringCount >= HEAVY_COVER_LOAD) {
    issues.push({
      kind: "HEAVY_LOAD",
      message: `${substituteName} is already covering ${ctx.coveringCount} other ${
        ctx.coveringCount === 1 ? "period" : "periods"
      } that day.`,
      blocking: false,
    });
  }

  return issues;
}

/** Does this set of issues stop the save? */
export function hasBlockingIssue(issues: SubstitutionIssue[]): boolean {
  return issues.some((i) => i.blocking);
}

/** Today's DATE in IST — the anchor both pages compare against. */
export function todayDate(now: number): string {
  return istDate(new Date(now).toISOString());
}
