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
