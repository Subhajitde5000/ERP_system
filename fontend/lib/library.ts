import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  BookCondition,
  BookPermissions,
  BookViewKind,
} from "@/types/library";

/**
 * Library book role logic — role_based_shared_pages.md PAGE 24 (C-RB-24).
 *
 * "One URL. Different actions." — the table names only two groups, so this is
 * the simplest matrix in the set: the Librarian manages the title, and
 * **everyone else** reads the catalogue entry.
 *
 * ── Deviations, flagged in the README ─────────────────────────────────────
 *
 * 1. PAGE 24's second row is "Student / Staff". Read literally that excludes
 *    Parents, but §6 gives Parent "● child" on optional modules and a
 *    catalogue entry carries nothing personal, so Parents read it too. The
 *    alternative — a 403 on a library shelf listing — would be surprising.
 *
 * 2. "No issue from here — goes through librarian" is explicit, so no reader
 *    role gets a circulation lever, not even the Institution Admin. The page
 *    says so in the UI rather than silently omitting the button.
 *
 * TODO(Dev-B): the backend must scope identically — a reader requesting
 * `?include=issues` must 403 regardless of what the UI offers.
 */

const READER_NOTE =
  "Catalogue entry. Borrowing is handled at the library desk.";

function reader(): BookPermissions {
  return {
    view: "CATALOGUE",
    canCirculate: false,
    canSetCondition: false,
    canEditBook: false,
    canSeeBorrowers: false,
    note: READER_NOTE,
  };
}

const VIEWS: Record<InstitutionRole, BookPermissions> = {
  // §4.8 — catalogue, issue/return, inventory
  LIBRARIAN: {
    view: "MANAGE",
    canCirculate: true,
    canSetCondition: true,
    canEditBook: true,
    canSeeBorrowers: true,
    note: "Copies, circulation history and current borrowers.",
  },

  // "Student / Staff" — the whole institution reads the catalogue
  STUDENT: reader(),
  PARENT: reader(),
  TEACHER: reader(),
  MENTOR: reader(),
  HOD: reader(),
  PRINCIPAL: reader(),
  VICE_PRINCIPAL: reader(),
  INSTITUTION_ADMIN: reader(),
  EXAM_CONTROLLER: reader(),
  ACADEMIC_COORDINATOR: reader(),
  ACCOUNTANT: reader(),
  HOSTEL_WARDEN: reader(),
  TRANSPORT_MANAGER: reader(),
  PLACEMENT_OFFICER: reader(),
  HR_MANAGER: reader(),
  ADMISSION_OFFICER: reader(),
  STORE_MANAGER: reader(),
};

/** Richest view wins for multi-role users. */
const VIEW_RANK: BookViewKind[] = ["NONE", "CATALOGUE", "MANAGE"];

export function bookPermissions(roles: InstitutionRole[]): BookPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<BookPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canCirculate: acc.canCirculate || next.canCirculate,
      canSetCondition: acc.canSetCondition || next.canSetCondition,
      canEditBook: acc.canEditBook || next.canEditBook,
      canSeeBorrowers: acc.canSeeBorrowers || next.canSeeBorrowers,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const CONDITION_LABELS: Record<BookCondition, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  DAMAGED: "Damaged",
  LOST: "Lost",
};

export const CONDITION_TONE: Record<BookCondition, Tone> = {
  GOOD: "success",
  FAIR: "warning",
  DAMAGED: "danger",
  LOST: "muted",
};

/**
 * A copy is out of circulation once it is damaged or lost — the librarian
 * can't issue it, and it must not count toward availability.
 */
export function isCirculable(condition: BookCondition): boolean {
  return condition === "GOOD" || condition === "FAIR";
}

/** Availability colour for the reader's headline count. */
export function availabilityTone(available: number, total: number): Tone {
  if (available === 0) return "danger";
  if (total > 0 && available / total <= 0.25) return "warning";
  return "success";
}

/**
 * Overdue fine. The DB stores `fine_amount` but no doc gives the rate, so it
 * lives here as one constant rather than being sprinkled through fixtures.
 * TODO(Dev-A): move to `tenant_settings` — institutions set their own rate.
 */
export const FINE_PER_DAY = 5;

export function fineFor(overdueDays: number): number {
  return Math.max(0, overdueDays) * FINE_PER_DAY;
}

/** Whole days a loan is past due; 0 when it is not. */
export function overdueDaysFor(dueDate: string, now: number): number {
  const due = new Date(dueDate).setUTCHours(23, 59, 59, 999);
  if (now <= due) return 0;
  return Math.floor((now - due) / (24 * 60 * 60 * 1000)) + 1;
}
