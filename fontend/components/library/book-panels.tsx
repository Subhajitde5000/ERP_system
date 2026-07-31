"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Info,
  Library,
  MapPin,
  RotateCcw,
  Undo2,
} from "lucide-react";

import { cn, formatDate, rupees } from "@/lib/utils";
import {
  CONDITION_LABELS,
  CONDITION_TONE,
  availabilityTone,
  isCirculable,
} from "@/lib/library";
import { FieldRow } from "@/components/profile/field-row";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  BookCirculationStats,
  BookCopy,
  BookDetail,
  BookIssueRecord,
  BookSummary,
} from "@/types/library";

/**
 * Library book panels — role_based_shared_pages.md PAGE 24 (C-RB-24).
 *
 * Librarian: "all copies + accession numbers, full issue history, current
 *            borrowers" with "issue, return, mark damaged/lost, edit".
 * Reader:    "title, availability count, location code" — view only.
 */

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t] ?? TONE_BG.muted,
        TONE_TEXT[t] ?? TONE_TEXT.muted,
      )}
    >
      {children}
    </span>
  );
}

/* ── Availability + location (every role) ───────────────────────────────── */

/**
 * PAGE 24's reader row: "availability count, location code". The librarian
 * sees the same block with the out-of-circulation split spelled out.
 */
export function AvailabilityPanel({
  book,
  detailed,
}: {
  book: BookSummary;
  detailed: boolean;
}) {
  const tone = availabilityTone(book.availableCopies, book.totalCopies);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Availability
          </p>
          <p className={cn("mt-1 font-display text-3xl font-bold", TONE_TEXT[tone])}>
            {book.availableCopies}
            <span className="text-lg text-muted-foreground">
              /{book.totalCopies}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {book.availableCopies === 0
              ? "All copies are out — ask the desk to reserve one."
              : `${book.availableCopies} cop${book.availableCopies === 1 ? "y" : "ies"} on the shelf now`}
          </p>
        </div>

        {book.locationCode && (
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Shelf location
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[15px] font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {book.locationCode}
            </p>
          </div>
        )}
      </div>

      <ProgressBar
        className="mt-4"
        value={book.availableCopies}
        max={book.totalCopies}
        tone={tone}
      />

      {detailed && (
        <dl className="mt-4 grid min-w-0 grid-cols-3 gap-4 border-t border-border pt-3">
          {[
            ["On shelf", book.availableCopies, "success"],
            ["On loan", book.issuedCopies, "accent"],
            ["Withdrawn", book.unavailableCopies, "muted"],
          ].map(([label, value, t]) => (
            <div key={label as string} className="min-w-0">
              <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-display text-lg font-bold tabular-nums",
                  TONE_TEXT[t as keyof typeof TONE_TEXT],
                )}
              >
                {value as number}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/** Catalogue record — the bibliographic detail (`books`, DB §8.1). */
export function BookInfoPanel({ book }: { book: BookSummary }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Catalogue record
      </h2>
      <dl className="min-w-0 divide-y divide-border border-t border-border">
        <FieldRow
          label={book.authors.length > 1 ? "Authors" : "Author"}
          value={book.authors.join(", ")}
        />
        <FieldRow label="Publisher" value={book.publisher} />
        <FieldRow
          label="Edition"
          value={
            [book.edition && `${book.edition} edition`, book.publicationYear]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
        <FieldRow label="ISBN" value={book.isbn} mono />
        <FieldRow label="Subject" value={book.subjectArea} />
        <FieldRow label="Language" value={book.language} />
      </dl>
    </Card>
  );
}

/* ── Reader: own loan + the "go to the desk" rule ───────────────────────── */

/**
 * PAGE 24 is explicit: "View only (no issue from here — goes through
 * librarian)". Saying so beats silently omitting a button the reader might go
 * looking for.
 */
export function ReaderNoticePanel({
  ownLoan,
}: {
  ownLoan: BookDetail["ownLoan"];
}) {
  return (
    <div className="grid min-w-0 gap-4">
      {ownLoan && (
        <Card
          className={cn(
            "min-w-0 border-l-4 p-5 sm:p-6",
            ownLoan.isOverdue ? "border-l-destructive" : "border-l-accent",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                <BookOpen className="h-4 w-4 text-accent" aria-hidden="true" />
                You have this book
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                <span className="font-mono">{ownLoan.accessionNumber}</span> ·
                issued {formatDate(ownLoan.issuedAt)} · due{" "}
                {formatDate(ownLoan.dueDate)}
              </p>
            </div>
            <Pill tone={ownLoan.isOverdue ? "danger" : "accent"}>
              {ownLoan.isOverdue
                ? `${ownLoan.overdueDays} DAYS OVERDUE`
                : "ON LOAN"}
            </Pill>
          </div>

          {ownLoan.isOverdue && (
            <p className="mt-3 flex min-w-0 items-center gap-2 rounded-field bg-destructive-light px-3.5 py-2.5 text-[13px] font-medium text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              Fine so far {rupees(ownLoan.fineAmount)} — please return it at the
              desk.
            </p>
          )}
        </Card>
      )}

      <p className="flex min-w-0 items-center gap-2 rounded-field border border-border bg-background px-3.5 py-3 text-[12px] text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        Borrowing and returns are handled at the library desk — this page is
        the catalogue entry.
      </p>
    </div>
  );
}

/* ── Librarian: copies ──────────────────────────────────────────────────── */

const CONDITIONS = ["GOOD", "FAIR", "DAMAGED", "LOST"] as const;

/**
 * PAGE 24's "all copies + accession numbers ... current borrowers" with
 * "issue, return, mark damaged/lost".
 */
export function CopiesPanel({
  copies,
  canCirculate,
  canSetCondition,
  onAction,
}: {
  copies: BookCopy[];
  canCirculate: boolean;
  canSetCondition: boolean;
  onAction: (message: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <Library className="h-4 w-4 text-accent" aria-hidden="true" />
            Copies
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {copies.length} physical cop{copies.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {copies.map((c) => {
          const loan = c.currentIssue;
          const withdrawn = !isCirculable(c.condition);

          return (
            <li key={c.id} className="min-w-0 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  {c.accessionNumber}
                </span>

                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                  {loan ? (
                    <>
                      {loan.borrowerName}
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        {loan.borrowerRef}
                      </span>
                    </>
                  ) : withdrawn ? (
                    <span className="text-muted-foreground">
                      Out of circulation
                    </span>
                  ) : (
                    <span className="text-muted-foreground">On the shelf</span>
                  )}
                </span>

                <Pill tone={CONDITION_TONE[c.condition]}>
                  {CONDITION_LABELS[c.condition].toUpperCase()}
                </Pill>

                {loan && (
                  <Pill tone={loan.isOverdue ? "danger" : "accent"}>
                    {loan.isOverdue
                      ? `${loan.overdueDays}D OVERDUE`
                      : "ON LOAN"}
                  </Pill>
                )}
              </div>

              {loan && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Issued {formatDate(loan.issuedAt)} · due{" "}
                  {formatDate(loan.dueDate)}
                </p>
              )}
              {!loan && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Added {formatDate(c.addedAt)}
                </p>
              )}

              <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                {canCirculate &&
                  (loan ? (
                    <button
                      type="button"
                      onClick={() =>
                        onAction(
                          "PATCH /library/issues/:id/return — API not connected yet (Dev-B, §8.1).",
                        )
                      }
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Return
                    </button>
                  ) : (
                    !withdrawn && (
                      <button
                        type="button"
                        onClick={() =>
                          onAction(
                            "POST /library/issues — API not connected yet (Dev-B, §8.1).",
                          )
                        }
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        Issue
                      </button>
                    )
                  ))}

                {canSetCondition && (
                  <button
                    type="button"
                    aria-expanded={open === c.id}
                    onClick={() => setOpen(open === c.id ? null : c.id)}
                    className="inline-flex h-9 shrink-0 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    Change condition
                  </button>
                )}
              </div>

              {open === c.id && canSetCondition && (
                <div
                  role="group"
                  aria-label={`Condition for ${c.accessionNumber}`}
                  className="mt-2 flex min-w-0 flex-wrap gap-1.5"
                >
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      aria-pressed={c.condition === cond}
                      onClick={() => {
                        setOpen(null);
                        onAction(
                          `PATCH /library/copies/:id {condition:${cond}} — API not connected yet (Dev-B).`,
                        );
                      }}
                      className={cn(
                        "h-8 shrink-0 rounded-field border px-3 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                        c.condition === cond
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-white text-muted-foreground hover:border-accent",
                      )}
                    >
                      {CONDITION_LABELS[cond]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ── Librarian: circulation stats + history ─────────────────────────────── */

export function CirculationStatsPanel({
  stats,
}: {
  stats: BookCirculationStats;
}) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        ["Total issues", String(stats.totalIssues), "text-foreground"],
        ["Out now", String(stats.currentlyOut), "text-accent"],
        [
          "Overdue",
          String(stats.overdue),
          stats.overdue > 0 ? "text-destructive" : "text-muted-foreground",
        ],
        [
          "Unpaid fines",
          rupees(stats.outstandingFines),
          stats.outstandingFines > 0 ? "text-warning" : "text-muted-foreground",
        ],
      ].map(([label, value, tone]) => (
        <Card key={label} className="min-w-0 p-4 sm:p-5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1.5 font-display text-xl font-bold", tone)}>
            {value}
          </p>
        </Card>
      ))}
    </div>
  );
}

/** PAGE 24's "full issue history". */
export function IssueHistoryPanel({
  issues,
  stats,
  onAction,
}: {
  issues: BookIssueRecord[];
  stats: BookCirculationStats;
  onAction: (message: string) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "OUT" | "RETURNED">("ALL");

  const groups = {
    ALL: issues,
    OUT: issues.filter((i) => i.returnedAt === null),
    RETURNED: issues.filter((i) => i.returnedAt !== null),
  };
  const shown = groups[filter];

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <RotateCcw className="h-4 w-4 text-accent" aria-hidden="true" />
            Issue history
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {stats.uniqueBorrowers} borrower
            {stats.uniqueBorrowers === 1 ? "" : "s"}
            {stats.averageDaysHeld !== null &&
              ` · held ${stats.averageDaysHeld} days on average`}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter issue history"
        className="-mx-1 mb-3 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
      >
        {(
          [
            ["ALL", "All", groups.ALL.length],
            ["OUT", "Out now", groups.OUT.length],
            ["RETURNED", "Returned", groups.RETURNED.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              filter === key
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-accent",
            )}
          >
            {label}
            <span className="ml-1.5 opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState message="No records in this group." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {shown.map((i) => (
            <li key={i.id} className="min-w-0 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {i.borrowerName}
                  <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                    {i.borrowerRef}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {i.accessionNumber}
                </span>
                {i.returnedAt === null ? (
                  <Pill tone={i.isOverdue ? "danger" : "accent"}>
                    {i.isOverdue ? `${i.overdueDays}D OVERDUE` : "OUT"}
                  </Pill>
                ) : (
                  <Pill tone="success">RETURNED</Pill>
                )}
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDate(i.issuedAt)} → {formatDate(i.dueDate)}
                {i.returnedAt && ` · returned ${formatDate(i.returnedAt)}`}
                {i.fineAmount > 0 && (
                  <span
                    className={cn(
                      "font-medium",
                      i.finePaid ? "text-success" : "text-destructive",
                    )}
                  >
                    {" "}
                    · fine {rupees(i.fineAmount)}{" "}
                    {i.finePaid ? "paid" : "unpaid"}
                  </span>
                )}
              </p>

              {i.fineAmount > 0 && !i.finePaid && (
                <button
                  type="button"
                  onClick={() =>
                    onAction(
                      "PATCH /library/issues/:id {fine_paid:true} — API not connected yet (Dev-B).",
                    )
                  }
                  className="mt-2 inline-flex h-9 shrink-0 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  Record fine payment
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
