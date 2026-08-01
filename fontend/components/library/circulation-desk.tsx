"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookPlus, CalendarClock, Undo2 } from "lucide-react";

import { cn, rupees } from "@/lib/utils";
import { DUE_SOON_DAYS, daysUntil } from "@/lib/library";
import { usePreviewHref } from "@/lib/use-preview-href";
import { EmptyState, Kpi } from "@/components/dashboard/primitives";
import {
  FilterTabs,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import {
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureHeader,
} from "@/components/structure/structure-bits";
import type { CirculationDesk, LoanRow } from "@/types/library";

type Tab = "OUT" | "OVERDUE" | "DUE_SOON" | "RETURNED";

/**
 * C-LB-06 Issued Books List and C-LB-07 Overdue List.
 *
 * One component, because "overdue" is a **filter over the same rows** rather
 * than a different query — two screens reading two sources would eventually
 * disagree about how many books are late. `/library/overdue` opens on the
 * overdue tab; `/library/issues` opens on everything out.
 */
export function CirculationDeskView({
  desk,
  initialTab = "OUT",
  title,
  description,
}: {
  desk: CirculationDesk;
  initialTab?: Tab;
  title: string;
  description: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const href = usePreviewHref();

  const dueSoon = useMemo(
    () =>
      desk.outstanding.filter((l) => {
        const d = daysUntil(l.dueDate, desk.today);
        return d >= 0 && d <= DUE_SOON_DAYS;
      }),
    [desk.outstanding, desk.today],
  );

  const rows = useMemo(() => {
    const base =
      tab === "RETURNED"
        ? desk.returned
        : tab === "OVERDUE"
          ? desk.outstanding.filter((l) => l.isOverdue)
          : tab === "DUE_SOON"
            ? dueSoon
            : desk.outstanding;

    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((l) =>
      [l.bookTitle, l.borrowerName, l.borrowerRef, l.accessionNumber]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [tab, query, desk.outstanding, desk.returned, dueSoon]);

  const tabs = [
    ["OUT", "On loan", desk.totals.onLoan],
    ["OVERDUE", "Overdue", desk.totals.overdue],
    ["DUE_SOON", "Due soon", dueSoon.length],
    ["RETURNED", "Returned", desk.returned.length],
  ] as const;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title={title}
        description={description}
        action={
          desk.canManage ? (
            <Link
              href={href("/library/issues/new")}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <BookPlus className="h-4 w-4" aria-hidden="true" />
              Issue a book
            </Link>
          ) : (
            <ReadOnlyNote />
          )
        }
      />

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="On loan" value={String(desk.totals.onLoan)} hint="copies out" />
        <Kpi
          label="Overdue"
          value={String(desk.totals.overdue)}
          hint="past their due date"
          tone={desk.totals.overdue > 0 ? "danger" : "success"}
        />
        <Kpi
          label="Due this week"
          value={String(desk.totals.dueThisWeek)}
          hint="not yet late"
          tone={desk.totals.dueThisWeek > 0 ? "warning" : "muted"}
        />
        <Kpi
          label="Fines owed"
          value={rupees(desk.totals.outstandingFines)}
          hint="unpaid, all loans"
          tone={desk.totals.outstandingFines > 0 ? "warning" : "success"}
        />
      </div>

      <StructureCard>
        <SearchBox
          id="desk-search"
          label="Search loans"
          value={query}
          onChange={setQuery}
          placeholder="Search by book, borrower or accession..."
        />

        <FilterTabs
          label="Filter loans"
          tabs={tabs}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        <ResultCount count={rows.length} noun="loan" />

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              message={
                query
                  ? "No loan matches that search."
                  : tab === "OVERDUE"
                    ? "Nothing is overdue — every book is back or still in time."
                    : "Nothing here."
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid min-w-0 gap-3">
            {rows.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                today={desk.today}
                canManage={desk.canManage}
              />
            ))}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Fines accrue daily while a book is out and are recalculated when it
          comes back, so the figure on a return can be higher than the one
          recorded when the loan started.
        </span>
      </p>
    </div>
  );
}

function LoanCard({
  loan,
  today,
  canManage,
}: {
  loan: LoanRow;
  today: string;
  canManage: boolean;
}) {
  const href = usePreviewHref();
  const open = loan.returnedAt === null;
  const left = daysUntil(loan.dueDate, today);

  return (
    <li
      className={cn(
        "min-w-0 rounded-field border p-4",
        loan.isOverdue
          ? "border-destructive-border bg-white"
          : open
            ? "border-border bg-white"
            : "border-border bg-muted/40",
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={href(`/library/books/${loan.bookId}`)}
            className="font-display text-[15px] font-bold text-foreground transition-colors hover:text-accent"
          >
            {loan.bookTitle}
          </Link>
          <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
            {loan.accessionNumber} · {loan.borrowerName} ({loan.borrowerRef})
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {loan.isOverdue ? (
            <StructureChip tone="danger">
              {loan.overdueDays} {loan.overdueDays === 1 ? "day" : "days"} late
            </StructureChip>
          ) : open ? (
            <StructureChip tone={left <= DUE_SOON_DAYS ? "warning" : "success"}>
              {left === 0 ? "Due today" : `Due in ${left}d`}
            </StructureChip>
          ) : (
            <StructureChip tone="muted">Returned</StructureChip>
          )}

          {open && canManage && (
            <Link
              href={href(`/library/issues/${loan.id}/return`)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              Return
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[12px] sm:grid-cols-2">
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-muted-foreground">Issued</dt>
          <dd className="min-w-0 font-medium text-foreground">
            {loan.issuedAt.slice(0, 10)} by {loan.issuedByName}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-muted-foreground">Due</dt>
          <dd className="min-w-0 font-medium text-foreground">{loan.dueDate}</dd>
        </div>
        {loan.returnedAt && (
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-muted-foreground">Returned</dt>
            <dd className="min-w-0 font-medium text-foreground">
              {loan.returnedAt.slice(0, 10)}
              {loan.returnedToName ? ` to ${loan.returnedToName}` : ""}
            </dd>
          </div>
        )}
        {loan.fineAmount > 0 && (
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-muted-foreground">Fine</dt>
            <dd
              className={cn(
                "min-w-0 font-medium",
                loan.finePaid ? "text-success-text" : "text-destructive-text",
              )}
            >
              {rupees(loan.fineAmount)} {loan.finePaid ? "· paid" : "· unpaid"}
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
