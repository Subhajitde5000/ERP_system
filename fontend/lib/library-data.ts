import type {
  BookCatalogue,
  BookCirculationStats,
  BookCondition,
  BookCopy,
  BookDetail,
  BookIssueRecord,
  BookPermissions,
  BookSummary,
  BorrowerOption,
  CirculationDesk,
  EResource,
  EResourceShelf,
  EResourceType,
  IssuableCopy,
  IssueFormContext,
  LoanRow,
  ReturnContext,
} from "@/types/library";
import {
  BORROW_LIMIT,
  DUE_SOON_DAYS,
  LOAN_DAYS,
  fineFor,
  isCirculable,
  overdueDaysFor,
} from "./library";
import { getClassRoster } from "./attendance-data";
import { getStaffDirectory } from "./staff-detail-data";

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
    // Issued 8 days ago on a 14-day loan → due in 6, inside the "due this
    // week" window. At 6 days ago it fell just outside it, which left the
    // circulation desk permanently reading "0 due today, 0 due this week" —
    // a KPI pinned at zero reads as broken rather than as good news.
    ["ACC-11890", "GOOD", "s1", 8],
    ["ACC-11891", "GOOD", null, 0],
    ["ACC-11892", "FAIR", "s4", 15],
  ],
  b3: [
    ["ACC-12055", "GOOD", "s2", 30],
    ["ACC-12056", "GOOD", null, 0],
  ],
};

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

/* ── Librarian console (C-LB-02, C-LB-04 … C-LB-08) ─────────────────────── */

/**
 * Every live and closed loan, flattened across all titles.
 *
 * `buildIssues()` is per-title because the book page shows one book; the
 * circulation desk needs the title on the row. Built from the same function
 * so a loan on the desk is byte-for-byte the loan on the book page.
 */
function allLoans(): LoanRow[] {
  return BOOKS.flatMap((seed) =>
    buildIssues(seed.id).map((issue) => ({
      ...issue,
      bookId: seed.id,
      bookTitle: seed.title,
    })),
  );
}

/** C-LB-02 — Book Catalogue. Every title with its derived counters. */
export function getBookCatalogue(canManage: boolean): BookCatalogue {
  // `getBook()` already derives the four counters from `book_copies`; calling
  // it keeps the catalogue row identical to the book page's header.
  const books = BOOKS.map((seed) => getBook(seed.id)!);
  const subjects = [
    ...new Set(books.map((b) => b.subjectArea).filter((s): s is string => !!s)),
  ].sort();

  return {
    books,
    subjects,
    totals: {
      titles: books.length,
      copies: books.reduce((a, b) => a + b.totalCopies, 0),
      available: books.reduce((a, b) => a + b.availableCopies, 0),
      onLoan: books.reduce((a, b) => a + b.issuedCopies, 0),
      outOfCirculation: books.reduce((a, b) => a + b.unavailableCopies, 0),
    },
    canManage,
  };
}

/**
 * C-LB-06 — Issued Books List (and C-LB-07, the overdue slice of it).
 *
 * One accessor serves both pages: "overdue" is a filter over the same rows,
 * not a different query, so the two screens can never disagree about how many
 * books are late.
 */
export function getCirculationDesk(canManage: boolean): CirculationDesk {
  const loans = allLoans();
  const today = new Date(T0).toISOString().slice(0, 10);

  const outstanding = loans
    .filter((l) => l.returnedAt === null)
    // Most overdue first — the desk's actual work queue.
    .sort((a, b) => b.overdueDays - a.overdueDays || a.dueDate.localeCompare(b.dueDate));

  const returned = loans
    .filter((l) => l.returnedAt !== null)
    .sort((a, b) => (b.returnedAt ?? "").localeCompare(a.returnedAt ?? ""));

  const until = (d: string) =>
    Math.round(
      (Date.parse(`${d}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) /
        DAY,
    );

  return {
    outstanding,
    returned,
    totals: {
      onLoan: outstanding.length,
      overdue: outstanding.filter((l) => l.isOverdue).length,
      dueToday: outstanding.filter((l) => until(l.dueDate) === 0).length,
      dueThisWeek: outstanding.filter((l) => {
        const d = until(l.dueDate);
        return d > 0 && d <= DUE_SOON_DAYS;
      }).length,
      // Fines are owed on returned books too — a reader who paid nothing when
      // handing it back still owes it.
      outstandingFines: loans
        .filter((l) => !l.finePaid)
        .reduce((a, l) => a + l.fineAmount, 0),
      borrowers: new Set(outstanding.map((l) => l.borrowerRef)).size,
    },
    today,
    canManage,
  };
}

/** C-LB-05 — one live loan, with its fine recomputed against today. */
export function getReturnContext(loanId: string): ReturnContext | undefined {
  const loan = allLoans().find((l) => l.id === loanId && l.returnedAt === null);
  if (!loan) return undefined;

  return {
    loan,
    // Recomputed rather than read off the row: `fine_amount` is written when
    // the loan is created and grows every day it stays out.
    fineDue: fineFor(overdueDaysFor(loan.dueDate, T0)),
    today: new Date(T0).toISOString().slice(0, 10),
  };
}

/** Live loan ids, so `/library/issues/:id/return` can be statically checked. */
export function getOpenLoanIds(): string[] {
  return allLoans()
    .filter((l) => l.returnedAt === null)
    .map((l) => l.id);
}

/**
 * C-LB-04 — Issue Book.
 *
 * Only copies that are physically issuable appear: a DAMAGED or LOST copy is
 * out of circulation (§8.1 `book_condition`), and one already on loan cannot
 * be lent twice. Listing them so the form can then refuse them would pad the
 * picker with rows that can never be chosen.
 */
export function getIssueFormContext(): IssueFormContext {
  const today = new Date(T0).toISOString().slice(0, 10);
  const live = allLoans().filter((l) => l.returnedAt === null);

  const copies: IssuableCopy[] = BOOKS.flatMap((seed) =>
    (COPIES[seed.id] ?? [])
      .map(([accessionNumber, condition, holderId], i) => ({
        copyId: `${seed.id}-c${i + 1}`,
        accessionNumber,
        condition,
        bookId: seed.id,
        bookTitle: seed.title,
        authors: seed.authors,
        locationCode: seed.locationCode,
        _issuable: holderId === null && isCirculable(condition),
      }))
      .filter((c) => c._issuable)
      .map(({ _issuable, ...c }) => {
        void _issuable;
        return c;
      }),
  );

  /*
   * Who may borrow. §8.1 makes `borrower_id` any user, so the roster and the
   * staff directory both qualify — read from the modules that own those
   * identities rather than re-seeded here.
   */
  const countFor = (ref: string) => ({
    currentLoans: live.filter((l) => l.borrowerRef === ref).length,
    overdueLoans: live.filter((l) => l.borrowerRef === ref && l.isOverdue).length,
  });

  const borrowers: BorrowerOption[] = [
    ...ROSTER.map((s) => ({
      id: s.id,
      name: s.name,
      ref: s.rollNo,
      kind: "STUDENT" as const,
      ...countFor(s.rollNo),
    })),
    ...getStaffDirectory()
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        name: s.name,
        ref: s.employeeCode,
        kind: "STAFF" as const,
        ...countFor(s.employeeCode),
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return {
    copies,
    borrowers,
    loanDays: LOAN_DAYS,
    today,
    borrowLimit: BORROW_LIMIT,
  };
}

/* ── E-resources (C-LB-08, DB §8.1 `e_resources`) ───────────────────────── */

/**
 * [title, type, url|null, fileKey|null, subject, uploadedBy, daysAgo]
 *
 * §8.1 stores `url` OR `file_key` — an external link or an S3 object — so the
 * seed carries exactly one of the two per row and the UI renders accordingly.
 */
const E_RESOURCES: [
  string,
  EResourceType,
  string | null,
  string | null,
  string,
  string,
  number,
][] = [
  ["IEEE Xplore Digital Library", "JOURNAL", "https://ieeexplore.ieee.org", null, "Computer Science", LIBRARIAN, 120],
  ["ACM Digital Library", "JOURNAL", "https://dl.acm.org", null, "Computer Science", LIBRARIAN, 118],
  ["Introduction to Algorithms — companion notes", "EBOOK", null, "e-res/clrs-companion.pdf", "Computer Science · Algorithms", LIBRARIAN, 46],
  ["A Survey of Consensus Protocols", "PAPER", null, "e-res/consensus-survey.pdf", "Computer Science · Distributed Systems", "Priya Sharma", 31],
  ["NPTEL — Database Management Systems", "LINK", "https://nptel.ac.in/courses/106105175", null, "Computer Science · Databases", "Arun Kumar", 22],
  ["Springer Mathematics Collection", "JOURNAL", "https://link.springer.com", null, "Mathematics", LIBRARIAN, 9],
];

/** C-LB-08 — E-Resources shelf. */
export function getEResources(canManage: boolean): EResourceShelf {
  const resources: EResource[] = E_RESOURCES.map(
    ([title, resourceType, url, fileKey, subjectArea, uploadedByName, daysAgo], i) => ({
      id: `er-${i + 1}`,
      title,
      resourceType,
      url,
      fileKey,
      subjectArea,
      uploadedByName,
      createdAt: at(daysAgo),
    }),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    resources,
    subjects: [
      ...new Set(
        resources.map((r) => r.subjectArea).filter((s): s is string => !!s),
      ),
    ].sort(),
    canManage,
  };
}
