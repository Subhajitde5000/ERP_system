"use client";

import { useState } from "react";
import { BookMarked, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { availabilityTone } from "@/lib/library";
import { FormAlert } from "@/components/auth/form-alert";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  DetailBackLink,
  DetailHeader,
} from "@/components/shared/detail-layout";
import {
  AvailabilityPanel,
  BookInfoPanel,
  CirculationStatsPanel,
  CopiesPanel,
  IssueHistoryPanel,
  ReaderNoticePanel,
} from "./book-panels";
import type { BookDetail, BookPermissions } from "@/types/library";

/**
 * Library book detail — role_based_shared_pages.md PAGE 24 (C-RB-24).
 *
 * "One URL. Different actions."
 *
 *   Librarian → copies + accession numbers · issue history · borrowers,
 *               with issue / return / condition / edit
 *   Everyone  → title · availability · location, view only
 *
 * The view kind is resolved server-side; sections a role isn't entitled to
 * are absent from the payload, so there is nothing here to hide.
 */
export function BookDetailView({
  detail,
  perms,
}: {
  detail: BookDetail;
  perms: BookPermissions;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const { book, copies, issues, stats, ownLoan } = detail;
  const tone = availabilityTone(book.availableCopies, book.totalCopies);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <DetailBackLink href="/library" label="Library" />

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      <DetailHeader
        initial={book.title.charAt(0)}
        title={book.title}
        badge={
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TONE_BG[tone],
              TONE_TEXT[tone],
            )}
          >
            {book.availableCopies > 0
              ? `${book.availableCopies} AVAILABLE`
              : "ALL OUT"}
          </span>
        }
        subtitle={
          <>
            <BookMarked
              className="mr-1 inline h-3 w-3 align-[-1px]"
              aria-hidden="true"
            />
            {book.authors.join(", ")}
          </>
        }
        meta={
          <>
            {book.edition && (
              <span className="text-muted-foreground">
                {book.edition} edition
                {book.publicationYear && ` · ${book.publicationYear}`}
              </span>
            )}
            {book.locationCode && (
              <span>
                <span className="font-mono font-bold text-foreground">
                  {book.locationCode}
                </span>{" "}
                <span className="text-muted-foreground">shelf</span>
              </span>
            )}
            {book.subjectArea && (
              <span className="text-muted-foreground">{book.subjectArea}</span>
            )}
          </>
        }
        actions={
          perms.canEditBook ? (
            <button
              type="button"
              onClick={() =>
                setStatus(
                  "PATCH /library/books/:id — API not connected yet (Dev-B, §8.1).",
                )
              }
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit book
            </button>
          ) : undefined
        }
      />

      <div className="mt-4 grid min-w-0 gap-4">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    /* ── Librarian ────────────────────────────────────────────────────── */
    if (perms.view === "MANAGE" && copies && issues && stats) {
      return (
        <>
          <CirculationStatsPanel stats={stats} />
          <AvailabilityPanel book={book} detailed />
          <CopiesPanel
            copies={copies}
            canCirculate={perms.canCirculate}
            canSetCondition={perms.canSetCondition}
            onAction={setStatus}
          />
          <IssueHistoryPanel
            issues={issues}
            stats={stats}
            onAction={setStatus}
          />
          <BookInfoPanel book={book} />
        </>
      );
    }

    /* ── Student / Staff — catalogue entry, view only ─────────────────── */
    return (
      <>
        <AvailabilityPanel book={book} detailed={false} />
        <ReaderNoticePanel ownLoan={ownLoan ?? null} />
        <BookInfoPanel book={book} />
      </>
    );
  }
}
