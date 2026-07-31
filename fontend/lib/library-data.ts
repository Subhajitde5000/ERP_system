import type {
  BookCirculationStats,
  BookCondition,
  BookCopy,
  BookDetail,
  BookIssueRecord,
  BookPermissions,
  BookSummary,
} from "@/types/library";
import { fineFor, isCirculable, overdueDaysFor } from "./library";
import { getClassRoster } from "./attendance-data";

/**
 * Library data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 24, C-RB-24; DB §8.1).
 *
 *   GET   /api/v1/library/books/:id                 title + counters
 *   PATCH /api/v1/library/books/:id                 edit catalogue record
 *   GET   /api/v1/library/books/:id/copies          physical copies
 *   PATCH /api/v1/library/copies/:id                condition GOOD/FAIR/DAMAGED/LOST
 *   GET   /api/v1/library/books/:id/issues          full circulation history
 *   POST  /api/v1/library/issues                    issue a copy to a borrower
 *   PATCH /api/v1/library/issues/:id/return         record a return + fine
 *
 * `books.available_copies` is a denormalised counter in the DB. Here it is
 * derived from `book_copies` so the header can never disagree with the copy
 * list rendered beside it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/** The signed-in reader, matching the student-detail library record. */
const OWN_READER = { id: "s1", name: "Aryan Mehta", ref: "ROLL142" };

const LIBRARIAN = "Fatima Sheikh";

/* ── Catalogue (`books`) ────────────────────────────────────────────────── */

type BookSeed = Omit<
  BookSummary,
  "totalCopies" | "availableCopies" | "issuedCopies" | "unavailableCopies"
>;

/**
 * `b1` is "Introduction to Algorithms" — the title the student-detail page
 * already has on loan to Aryan Mehta (ACC-10422, 12 days overdue), so the two
 * pages describe the same loan.
 */
const BOOKS: BookSeed[] = [
  {
    id: "b1",
    title: "Introduction to Algorithms",
    authors: ["Thomas H. Cormen", "Charles E. Leiserson", "Ronald L. Rivest"],
    isbn: "978-0262046305",
    publisher: "MIT Press",
    edition: "4th",
    publicationYear: 2022,
    subjectArea: "Computer Science · Algorithms",
    language: "English",
    locationCode: "CS-04-A12",
    coverImageUrl: null,
    isActive: true,
  },
  {
    id: "b2",
    title: "Database System Concepts",
    authors: ["Abraham Silberschatz", "Henry F. Korth", "S. Sudarshan"],
    isbn: "978-0078022159",
    publisher: "McGraw-Hill",
    edition: "7th",
    publicationYear: 2019,
    subjectArea: "Computer Science · Databases",
    language: "English",
    locationCode: "CS-05-B03",
    coverImageUrl: null,
    isActive: true,
  },
  {
    id: "b3",
    title: "Clean Code",
    authors: ["Robert C. Martin"],
    isbn: "978-0132350884",
    publisher: "Prentice Hall",
    edition: "1st",
    publicationYear: 2008,
    subjectArea: "Computer Science · Software Engineering",
    language: "English",
    locationCode: "CS-07-C21",
    coverImageUrl: null,
    isActive: true,
  },
];

/* ── Copies (`book_copies`) ─────────────────────────────────────────────── */

/**
 * [accession, condition, borrower id or null, days since issue, loan days]
 * The loan period is per-copy because renewals shorten it; omit it to use
 * the default.
 */
type CopySeed = [string, BookCondition, string | null, number, number?];

const COPIES: Record<string, CopySeed[]> = {
  b1: [
    // Aryan's overdue loan — the same one student detail shows: issued 24
    // days ago on a 12-day loan, so it is 12 days past due.
    ["ACC-10422", "GOOD", "s1", 24, 12],
    ["ACC-10423", "GOOD", "s3", 6],
    ["ACC-10424", "FAIR", null, 0],
    ["ACC-10425", "GOOD", null, 0],
    // Out of circulation, so availability ≠ total − issued
    ["ACC-10426", "DAMAGED", null, 0],
    ["ACC-10427", "LOST", null, 0],
  ],
  b2: [
    ["ACC-11890", "GOOD", "s1", 6],
    ["ACC-11891", "GOOD", null, 0],
    ["ACC-11892", "FAIR", "s4", 15],
  ],
  b3: [
    ["ACC-12055", "GOOD", "s2", 30],
    ["ACC-12056", "GOOD", null, 0],
  ],
};

/** Loan period — no doc states one, so it lives here as a single constant. */
const LOAN_DAYS = 14;

const ROSTER = getClassRoster();

function borrower(id: string) {
  const student = ROSTER.find((s) => s.id === id);
  return {
    name: student?.name ?? "Unknown",
    ref: student?.rollNo ?? "—",
    kind: "STUDENT" as const,
  };
}

/**
 * Physical copies with their live loan, if any.
 * `withBorrowers` is false for readers — PAGE 24 gives "current borrowers" to
 * the Librarian only, so the name is never attached to the payload.
 */
function buildCopies(bookId: string, withBorrowers: boolean): BookCopy[] {
  return (COPIES[bookId] ?? []).map(
    ([accessionNumber, condition, holderId, daysAgo, loanDays], i) => {
      const onLoan = holderId !== null && isCirculable(condition);
      const dueDate = on(daysAgo - (loanDays ?? LOAN_DAYS));
      const overdueDays = onLoan ? overdueDaysFor(dueDate, T0) : 0;

      const copy: BookCopy = {
        id: `${bookId}-c${i + 1}`,
        accessionNumber,
        condition,
        // A damaged or lost copy is not available even though nobody holds it
        isAvailable: isCirculable(condition) && !onLoan,
        addedAt: on(400 + i * 30),
      };

      if (onLoan && withBorrowers && holderId) {
        const b = borrower(holderId);
        copy.currentIssue = {
          borrowerName: b.name,
          borrowerRef: b.ref,
          borrowerKind: b.kind,
          issuedAt: at(daysAgo),
          dueDate,
          isOverdue: overdueDays > 0,
          overdueDays,
        };
      }

      return copy;
    },
  );
}

/* ── Issue history (`book_issues`) ──────────────────────────────────────── */

/** Closed loans, so the history isn't only the live ones. */
type PastSeed = [string, string, number, number];
const PAST_ISSUES: Record<string, PastSeed[]> = {
  // [accession, borrowerId, issued daysAgo, returned daysAgo]
  b1: [
    ["ACC-10423", "s2", 60, 44],
    ["ACC-10424", "s4", 90, 70],
    ["ACC-10422", "s5", 120, 100],
    ["ACC-10425", "s3", 150, 138],
  ],
  b2: [["ACC-11891", "s2", 70, 58]],
  b3: [["ACC-12056", "s1", 100, 80]],
};

/**
 * Full circulation history — live loans first, then closed ones.
 * Fines are computed from the overdue days, never hand-written.
 */
function buildIssues(bookId: string): BookIssueRecord[] {
  const live: BookIssueRecord[] = (COPIES[bookId] ?? [])
    .filter(([, condition, holderId]) => holderId && isCirculable(condition))
    .map(([accessionNumber, , holderId, daysAgo, loanDays], i) => {
      const b = borrower(holderId!);
      const dueDate = on(daysAgo - (loanDays ?? LOAN_DAYS));
      const overdueDays = overdueDaysFor(dueDate, T0);

      return {
        id: `${bookId}-i${i + 1}`,
        accessionNumber,
        borrowerName: b.name,
        borrowerRef: b.ref,
        borrowerKind: b.kind,
        issuedByName: LIBRARIAN,
        issuedAt: at(daysAgo),
        dueDate,
        returnedAt: null,
        returnedToName: null,
        fineAmount: fineFor(overdueDays),
        finePaid: false,
        isOverdue: overdueDays > 0,
        overdueDays,
      };
    });

  const past: BookIssueRecord[] = (PAST_ISSUES[bookId] ?? []).map(
    ([accessionNumber, holderId, issuedAgo, returnedAgo], i) => {
      const b = borrower(holderId);
      const dueDate = on(issuedAgo - LOAN_DAYS);
      // Overdue is measured at the moment of return, not against today
      const overdueDays = overdueDaysFor(
        dueDate,
        T0 - returnedAgo * DAY,
      );

      return {
        id: `${bookId}-p${i + 1}`,
        accessionNumber,
        borrowerName: b.name,
        borrowerRef: b.ref,
        borrowerKind: b.kind,
        issuedByName: LIBRARIAN,
        issuedAt: at(issuedAgo),
        dueDate,
        returnedAt: at(returnedAgo),
        returnedToName: LIBRARIAN,
        fineAmount: fineFor(overdueDays),
        // One unpaid historic fine, so the stat has something to show
        finePaid: !(bookId === "b1" && i === 1),
        isOverdue: false,
        overdueDays,
      };
    },
  );

  return [...live, ...past];
}

function buildStats(issues: BookIssueRecord[]): BookCirculationStats {
  const closed = issues.filter((i) => i.returnedAt !== null);
  const held = closed.map(
    (i) =>
      (new Date(i.returnedAt!).getTime() - new Date(i.issuedAt).getTime()) /
      DAY,
  );

  return {
    totalIssues: issues.length,
    currentlyOut: issues.filter((i) => i.returnedAt === null).length,
    overdue: issues.filter((i) => i.isOverdue).length,
    uniqueBorrowers: new Set(issues.map((i) => i.borrowerRef)).size,
    outstandingFines: issues
      .filter((i) => !i.finePaid)
      .reduce((a, i) => a + i.fineAmount, 0),
    averageDaysHeld: held.length
      ? Math.round(held.reduce((a, b) => a + b, 0) / held.length)
      : null,
  };
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * The title with its counters derived from the copies, so
 * `available_copies` can never drift from the list beside it.
 */
export function getBook(id: string): BookSummary | undefined {
  const seed = BOOKS.find((b) => b.id === id);
  if (!seed) return undefined;

  const copies = buildCopies(id, false);

  return {
    ...seed,
    totalCopies: copies.length,
    availableCopies: copies.filter((c) => c.isAvailable).length,
    issuedCopies: copies.filter(
      (c) => isCirculable(c.condition) && !c.isAvailable,
    ).length,
    unavailableCopies: copies.filter((c) => !isCirculable(c.condition)).length,
  };
}

export function getBookIds(): string[] {
  return BOOKS.map((b) => b.id);
}

/**
 * Every book the signed-in reader currently holds, so other modules (student
 * detail) can quote the same accession numbers, due dates and fines instead
 * of hard-coding them.
 */
export function getOwnLoans(): {
  bookId: string;
  title: string;
  accessionNumber: string;
  issuedOn: string;
  dueOn: string;
  isOverdue: boolean;
  overdueDays: number;
  fineAmount: number;
}[] {
  const out = [];

  for (const seed of BOOKS) {
    for (const [accessionNumber, condition, holderId, daysAgo, loanDays] of
      COPIES[seed.id] ?? []) {
      if (holderId !== OWN_READER.id || !isCirculable(condition)) continue;
      const dueOn = on(daysAgo - (loanDays ?? LOAN_DAYS));
      const overdueDays = overdueDaysFor(dueOn, T0);
      out.push({
        bookId: seed.id,
        title: seed.title,
        accessionNumber,
        issuedOn: at(daysAgo),
        dueOn,
        isOverdue: overdueDays > 0,
        overdueDays,
        fineAmount: fineFor(overdueDays),
      });
    }
  }

  return out;
}

/**
 * Mirrors `GET /api/v1/library/books/:id` with the caller's entitlements
 * applied.
 *
 * A reader receives the title and its counts and nothing else — no accession
 * numbers, no borrower names, no history. Their *own* loan is returned,
 * because it is their own record.
 */
export function getBookDetail(
  id: string,
  perms: BookPermissions,
): BookDetail | undefined {
  const book = getBook(id);
  if (!book) return undefined;

  if (perms.view === "MANAGE") {
    const issues = buildIssues(id);
    return {
      book,
      copies: buildCopies(id, perms.canSeeBorrowers),
      issues,
      stats: buildStats(issues),
    };
  }

  // Reader — catalogue entry plus their own loan, if they hold one
  const mine = (COPIES[id] ?? []).find(
    ([, condition, holderId]) =>
      holderId === OWN_READER.id && isCirculable(condition),
  );

  if (!mine) return { book, ownLoan: null };

  const [accessionNumber, , , daysAgo, loanDays] = mine;
  const dueDate = on(daysAgo - (loanDays ?? LOAN_DAYS));
  const overdueDays = overdueDaysFor(dueDate, T0);

  return {
    book,
    ownLoan: {
      accessionNumber,
      issuedAt: at(daysAgo),
      dueDate,
      isOverdue: overdueDays > 0,
      overdueDays,
      fineAmount: fineFor(overdueDays),
    },
  };
}

/* ── Catalogue-wide circulation (PAGE 14 reports) ───────────────────────── */

/**
 * Circulation across the whole catalogue.
 *
 * Built from the same `buildIssues()` / `buildStats()` the book detail page
 * uses, so the Librarian's report and any book they click into always agree —
 * the drift that produced 91%-vs-64% between PAGE 19 and PAGE 23.
 *
 * TODO(Dev-B): `GET /api/v1/library/reports/circulation?from=&to=`, which is
 * a `GROUP BY book_id` over `book_issues` (§8.1).
 */
export function getLibraryCirculation(): BookCirculationStats & {
  overdueRate: number;
  byBook: {
    id: string;
    title: string;
    totalIssues: number;
    currentlyOut: number;
    overdue: number;
    totalCopies: number;
  }[];
  overdueLoans: {
    title: string;
    accessionNumber: string;
    borrowerName: string;
    borrowerRef: string;
    overdueDays: number;
    fineAmount: number;
  }[];
} {
  const perBook = BOOKS.map((seed) => {
    const issues = buildIssues(seed.id);
    return { seed, issues, stats: buildStats(issues) };
  });

  const allIssues = perBook.flatMap((b) => b.issues);
  const closed = allIssues.filter((i) => i.returnedAt !== null);
  const held = closed.map(
    (i) =>
      (new Date(i.returnedAt!).getTime() - new Date(i.issuedAt).getTime()) / DAY,
  );

  const currentlyOut = allIssues.filter((i) => i.returnedAt === null).length;
  const overdue = allIssues.filter((i) => i.isOverdue).length;

  return {
    totalIssues: allIssues.length,
    currentlyOut,
    overdue,
    // Share of *live* loans that are late — over all issues ever, the rate
    // would shrink every time a book came back on time, which reads as an
    // improvement that never happened.
    overdueRate: currentlyOut ? Math.round((overdue / currentlyOut) * 100) : 0,
    uniqueBorrowers: new Set(allIssues.map((i) => i.borrowerRef)).size,
    outstandingFines: allIssues
      .filter((i) => !i.finePaid)
      .reduce((a, i) => a + i.fineAmount, 0),
    averageDaysHeld: held.length
      ? Math.round(held.reduce((a, b) => a + b, 0) / held.length)
      : null,
    byBook: perBook.map(({ seed, stats }) => ({
      id: seed.id,
      title: seed.title,
      totalIssues: stats.totalIssues,
      currentlyOut: stats.currentlyOut,
      overdue: stats.overdue,
      totalCopies: (COPIES[seed.id] ?? []).length,
    })),
    overdueLoans: perBook.flatMap(({ seed, issues }) =>
      issues
        .filter((i) => i.isOverdue)
        .map((i) => ({
          title: seed.title,
          accessionNumber: i.accessionNumber,
          borrowerName: i.borrowerName,
          borrowerRef: i.borrowerRef,
          overdueDays: i.overdueDays,
          fineAmount: i.fineAmount,
        })),
    ),
  };
}
