/**
 * Library contracts — role_based_shared_pages.md PAGE 24 (C-RB-24).
 * Mirrors `books`, `book_copies` and `book_issues` in
 * database_design_complete.md §8.1.
 */

/** `book_condition` enum (DB §8.1). */
export type BookCondition = "GOOD" | "FAIR" | "DAMAGED" | "LOST";

/**
 * PAGE 24 has exactly two experiences: the Librarian manages the title, and
 * everyone else reads the catalogue entry. The discriminator decides how much
 * the data layer returns, not which layout renders.
 */
export type BookViewKind =
  | "MANAGE" // Librarian — copies, issue history, borrowers, edit
  | "CATALOGUE" // Student / Staff — title, availability, location
  | "NONE";

export interface BookPermissions {
  view: BookViewKind;
  /** Librarian — "Issue, return" */
  canCirculate: boolean;
  /** Librarian — "mark damaged/lost" */
  canSetCondition: boolean;
  /** Librarian — "edit book details" (§4.8 Catalogue) */
  canEditBook: boolean;
  /**
   * Whether borrower identities are returned at all.
   *
   * PAGE 24 gives "current borrowers" and "full issue history" to the
   * Librarian only. Circulation records name who read what, so this gates
   * what the *server sends* — a reader never receives another person's
   * borrowing history.
   */
  canSeeBorrowers: boolean;
  note: string;
}

/* ── Title (`books`) ────────────────────────────────────────────────────── */

export interface BookSummary {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  edition: string | null;
  publicationYear: number | null;
  subjectArea: string | null;
  language: string;
  /** Shelf code — PAGE 24 shows this to every reader */
  locationCode: string | null;
  coverImageUrl: string | null;
  isActive: boolean;
  /**
   * `books.total_copies` / `available_copies` are denormalised counters the
   * DB updates on issue/return. Both are **derived from `book_copies` here**
   * so the header can never contradict the copy list beside it.
   */
  totalCopies: number;
  availableCopies: number;
  /** Copies out on loan right now */
  issuedCopies: number;
  /** Copies withdrawn from circulation (DAMAGED / LOST) */
  unavailableCopies: number;
}

/* ── Copies (`book_copies`) ─────────────────────────────────────────────── */

export interface BookCopy {
  id: string;
  accessionNumber: string;
  condition: BookCondition;
  isAvailable: boolean;
  addedAt: string;
  /** Present only when the copy is on loan and the caller may see borrowers */
  currentIssue?: {
    borrowerName: string;
    borrowerRef: string;
    borrowerKind: "STUDENT" | "STAFF";
    issuedAt: string;
    dueDate: string;
    isOverdue: boolean;
    overdueDays: number;
  };
}

/* ── Issue history (`book_issues`) ──────────────────────────────────────── */

export interface BookIssueRecord {
  id: string;
  accessionNumber: string;
  borrowerName: string;
  borrowerRef: string;
  borrowerKind: "STUDENT" | "STAFF";
  issuedByName: string;
  issuedAt: string;
  dueDate: string;
  /** null = still out */
  returnedAt: string | null;
  returnedToName: string | null;
  fineAmount: number;
  finePaid: boolean;
  isOverdue: boolean;
  overdueDays: number;
}

/**
 * Circulation roll-up for the title — the Librarian's "how is this book
 * doing" summary. Derived from the issue records.
 */
export interface BookCirculationStats {
  totalIssues: number;
  currentlyOut: number;
  overdue: number;
  /** Distinct borrowers across the whole history */
  uniqueBorrowers: number;
  outstandingFines: number;
  /** Average days held, closed loans only; null when nothing is back yet */
  averageDaysHeld: number | null;
}

/**
 * Everything the book page may render.
 *
 * Sections a role isn't entitled to are **absent**, not empty — a reader's
 * payload carries no borrower names at all.
 */
export interface BookDetail {
  book: BookSummary;
  /** Librarian only — every physical copy with its accession number */
  copies?: BookCopy[];
  /** Librarian only — full issue history */
  issues?: BookIssueRecord[];
  /** Librarian only */
  stats?: BookCirculationStats;
  /**
   * Reader view — whether *this* reader currently holds a copy. Their own
   * loan is their own record, so it is safe to return.
   */
  ownLoan?: {
    accessionNumber: string;
    issuedAt: string;
    dueDate: string;
    isOverdue: boolean;
    overdueDays: number;
    fineAmount: number;
  } | null;
}

/* ── Librarian console (C-LB-02, C-LB-04…C-LB-07) ───────────────────────── */

/**
 * One row of the catalogue list. `BookSummary` already carries every column
 * `books` has plus the derived counters, so the catalogue reuses it rather
 * than declaring a near-identical shape.
 */
export interface BookCatalogue {
  books: BookSummary[];
  /** Distinct `subject_area` values, for the filter. */
  subjects: string[];
  totals: {
    titles: number;
    copies: number;
    available: number;
    onLoan: number;
    outOfCirculation: number;
  };
  canManage: boolean;
}

/**
 * A live loan, flattened across every title.
 *
 * `BookIssueRecord` is per-title (the detail page already knows which book it
 * is showing); the circulation desk needs the title on the row itself.
 */
export interface LoanRow extends BookIssueRecord {
  bookId: string;
  bookTitle: string;
}

/** C-LB-06 — "Issued Books List", and C-LB-07 filtered to the late ones. */
export interface CirculationDesk {
  /** Loans with `returned_at IS NULL`. */
  outstanding: LoanRow[];
  /** Returned loans, most recent first — the audit trail behind a return. */
  returned: LoanRow[];
  totals: {
    onLoan: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    outstandingFines: number;
    borrowers: number;
  };
  today: string;
  canManage: boolean;
}

/** A copy that can be issued right now — C-LB-04. */
export interface IssuableCopy {
  copyId: string;
  accessionNumber: string;
  condition: BookCondition;
  bookId: string;
  bookTitle: string;
  authors: string[];
  locationCode: string | null;
}

/** Someone who may borrow — `book_issues.borrower_id` is any user (§8.1). */
export interface BorrowerOption {
  id: string;
  name: string;
  ref: string;
  kind: "STUDENT" | "STAFF";
  /** Live loans they already hold, so the desk can see a serial defaulter. */
  currentLoans: number;
  overdueLoans: number;
}

/** Everything C-LB-04's form needs, resolved on the server. */
export interface IssueFormContext {
  copies: IssuableCopy[];
  borrowers: BorrowerOption[];
  /** Default loan length in days. */
  loanDays: number;
  today: string;
  /** Max concurrent loans one borrower may hold. */
  borrowLimit: number;
}

/** Why a proposed issue cannot (or should not) go ahead — C-LB-04. */
export type IssueIssueKind =
  | "COPY_UNAVAILABLE"
  | "BORROWER_AT_LIMIT"
  | "BORROWER_OVERDUE"
  | "PAST_DUE_DATE";

export interface IssueIssue {
  kind: IssueIssueKind;
  message: string;
  blocking: boolean;
}

/** C-LB-05 — the return screen for one live loan. */
export interface ReturnContext {
  loan: LoanRow;
  /** Fine owed right now, recomputed from the due date — never trusted stale. */
  fineDue: number;
  today: string;
}

/* ── E-resources (`e_resources`, DB §8.1) ───────────────────────────────── */

export type EResourceType = "EBOOK" | "JOURNAL" | "PAPER" | "LINK";

export interface EResource {
  id: string;
  title: string;
  resourceType: EResourceType;
  /** External link, or null when the file is in S3. */
  url: string | null;
  /** S3 key — the DB stores one or the other. */
  fileKey: string | null;
  subjectArea: string | null;
  uploadedByName: string;
  createdAt: string;
}

export interface EResourceShelf {
  resources: EResource[];
  subjects: string[];
  canManage: boolean;
}
