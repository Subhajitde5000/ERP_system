import type { InstitutionRole } from "@/types/auth";
import { leadershipCall, queryString } from "@/lib/principal";
import type { Tone } from "@/types/dashboard";
import type {
  BookCondition,
  BookPermissions,
  BookViewKind,
  EResourceType,
  IssueIssue,
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
 * The backend applies the same boundary: circulation routes require a live
 * Librarian/Admin role and catalogue readers only receive their own loan.
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
 * The production API reads `library.fine_per_day` from tenant settings; this
 * remains the client-side presentation default.
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

/* ── Circulation desk (C-LB-04 … C-LB-07) ───────────────────────────────── */

/**
 * Default loan length, in days.
 *
 * `book_issues.due_date` is stored per loan (§8.1) but no doc gives the
 * default term, so it lives here as one constant beside `FINE_PER_DAY`.
 * The production API reads the institution value from tenant settings; this
 * remains the form default.
 */
export const LOAN_DAYS = 14;

/**
 * How many books one borrower may hold at once.
 *
 * Not a schema constraint — the DB would happily insert a twentieth loan —
 * so the desk enforces it and the backend must re-check.
 */
export const BORROW_LIMIT = 3;

/** Loans due within this many days count as "due soon" on the desk. */
export const DUE_SOON_DAYS = 7;

/** Human labels for `e_resources.resource_type` (§8.1 — free VARCHAR). */
export const E_RESOURCE_LABELS: Record<EResourceType, string> = {
  EBOOK: "E-book",
  JOURNAL: "Journal",
  PAPER: "Paper",
  LINK: "Link",
};

export const E_RESOURCE_TONE: Record<EResourceType, Tone> = {
  EBOOK: "accent",
  JOURNAL: "cyan",
  PAPER: "success",
  LINK: "muted",
};

/**
 * Add `days` to a plain "YYYY-MM-DD", returning the same shape.
 *
 * `due_date` is a DATE with no time (§8.1), so this is date arithmetic at UTC
 * midnight and never a wall-clock conversion — the trap that shifted the exam
 * scheduler by 5½ hours.
 */
export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days until a due date; negative once it has passed. */
export function daysUntil(dueDate: string, today: string): number {
  const a = Date.parse(`${dueDate}T00:00:00.000Z`);
  const b = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Everything wrong with a proposed issue — C-LB-04.
 *
 * A pure function with its own test, the same shape as the Exam Controller's
 * `findScheduleClashes` and the coordinator's `findSubstitutionIssues`.
 *
 * `COPY_UNAVAILABLE` and `PAST_DUE_DATE` **block**: the first would double-issue
 * one physical copy, the second creates a loan that is born overdue.
 * `BORROWER_AT_LIMIT` and `BORROWER_OVERDUE` only **warn** — a librarian
 * routinely lets a student take one more book while promising to bring the
 * late one tomorrow, and refusing that models a rule the institution has not
 * got.
 */
export function findIssueProblems(
  proposed: {
    copy: { accessionNumber: string; condition: BookCondition; available: boolean } | null;
    borrower: { name: string; currentLoans: number; overdueLoans: number } | null;
    dueDate: string;
  },
  ctx: { today: string; borrowLimit: number },
): IssueIssue[] {
  const problems: IssueIssue[] = [];
  const { copy, borrower, dueDate } = proposed;

  if (copy && (!copy.available || !isCirculable(copy.condition))) {
    problems.push({
      kind: "COPY_UNAVAILABLE",
      message: !isCirculable(copy.condition)
        ? `${copy.accessionNumber} is marked ${CONDITION_LABELS[copy.condition].toLowerCase()} and is out of circulation.`
        : `${copy.accessionNumber} is already on loan.`,
      blocking: true,
    });
  }

  if (dueDate && dueDate <= ctx.today) {
    problems.push({
      kind: "PAST_DUE_DATE",
      message: "The due date must be after today, or the loan starts overdue.",
      blocking: true,
    });
  }

  if (borrower && borrower.currentLoans >= ctx.borrowLimit) {
    problems.push({
      kind: "BORROWER_AT_LIMIT",
      message: `${borrower.name} already holds ${borrower.currentLoans} of ${ctx.borrowLimit} allowed books.`,
      blocking: false,
    });
  }

  if (borrower && borrower.overdueLoans > 0) {
    problems.push({
      kind: "BORROWER_OVERDUE",
      message: `${borrower.name} has ${borrower.overdueLoans} overdue ${
        borrower.overdueLoans === 1 ? "book" : "books"
      } already.`,
      blocking: false,
    });
  }

  return problems;
}

/** Does this set of problems stop the issue? */
export function hasBlockingIssueProblem(problems: IssueIssue[]): boolean {
  return problems.some((p) => p.blocking);
}

/* ── Production API boundary ────────────────────────────────────────────── */

const call = <T>(path: string, init: RequestInit = {}) =>
  leadershipCall<T>("library", path, init, "LibraryAPIError");
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface LibraryPage<T> { items: T[]; total: number; limit: number; offset: number }
export interface LibraryCatalogue extends LibraryPage<import("@/types/library").BookSummary> {
  subjects: string[];
  canManage: boolean;
}
export interface LibraryLoan {
  id: string; copyId: string; bookId: string; bookTitle: string; accessionNumber: string;
  borrowerId: string; borrowerName: string; borrowerRef: string; issuedAt: string;
  dueDate: string; returnedAt: string | null; fineAmount: number; finePaid: boolean;
  isOverdue: boolean; overdueDays: number;
}
export interface LibraryDesk extends LibraryPage<LibraryLoan> {
  overdue: number;
  outstandingFines: number;
}
export interface LibraryDashboard {
  titles: number; copies: number; available: number; onLoan: number; overdue: number;
  outstandingFines: number; recentLoans: LibraryLoan[]; canManage: boolean;
}
export interface LibraryBookDetail {
  book: import("@/types/library").BookSummary;
  copies: import("@/types/library").BookCopy[] | null;
  issues: LibraryLoan[] | null;
  ownLoan: LibraryLoan | null;
  canManage: boolean;
}
export interface LibraryBorrower {
  id: string; name: string; ref: string; currentLoans: number; overdueLoans: number;
}
export interface LibraryResource {
  id: string; title: string; resourceType: EResourceType; url: string | null;
  fileKey: string | null; subjectArea: string | null; uploadedByName: string; createdAt: string;
}
export interface BookPayload {
  title: string; authors: string[]; isbn?: string | null; publisher?: string | null;
  edition?: string | null; publicationYear?: number | null; subjectArea?: string | null;
  language?: string; locationCode?: string | null; coverImageUrl?: string | null; isActive?: boolean;
}

export const fetchLibraryDashboard = () => call<LibraryDashboard>("/dashboard");
export const fetchBooks = (filters: { query?: string; subject?: string; available?: boolean; limit?: number; offset?: number } = {}) =>
  call<LibraryCatalogue>(`/books${queryString(filters)}`);
export const fetchBook = (id: string) => call<LibraryBookDetail>(`/books/${id}`);
export const createBook = (body: BookPayload) => call<LibraryBookDetail>("/books", json("POST", body));
export const updateBook = (id: string, body: BookPayload) => call<LibraryBookDetail>(`/books/${id}`, json("PUT", body));
export const addBookCopy = (bookId: string, body: { accessionNumber: string; condition: BookCondition }) =>
  call<import("@/types/library").BookCopy>(`/books/${bookId}/copies`, json("POST", body));
export const updateCopyCondition = (copyId: string, condition: BookCondition) =>
  call<import("@/types/library").BookCopy>(`/copies/${copyId}/condition`, json("PATCH", { condition }));
export const fetchIssues = (filters: { overdue?: boolean; query?: string; limit?: number; offset?: number } = {}) =>
  call<LibraryDesk>(`/issues${queryString(filters)}`);
export const issueBook = (body: { copyId: string; borrowerId: string; dueDate: string; notes?: string }) =>
  call<LibraryLoan>("/issues", json("POST", body));
export const returnBook = (id: string, body: { finePaid: boolean; notes?: string }) =>
  call<LibraryLoan>(`/issues/${id}/return`, json("POST", body));
export const fetchBorrowers = (query = "") => call<LibraryBorrower[]>(`/borrowers${queryString({ query })}`);
export const fetchResources = (query = "") => call<LibraryResource[]>(`/e-resources${queryString({ query })}`);
export const createResource = (body: { title: string; resourceType: EResourceType; url?: string; fileKey?: string; subjectArea?: string }) =>
  call<LibraryResource>("/e-resources", json("POST", body));
export const deleteResource = (id: string) => call<void>(`/e-resources/${id}`, { method: "DELETE" });
