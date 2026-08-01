"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookPlus, Library } from "lucide-react";

import { cn } from "@/lib/utils";
import { availabilityTone } from "@/lib/library";
import { usePreviewHref } from "@/lib/use-preview-href";
import { EmptyState, Kpi, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  FilterBar,
  FilterSelect,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import {
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureHeader,
} from "@/components/structure/structure-bits";
import type { BookCatalogue } from "@/types/library";

/**
 * C-LB-02 — Book Catalogue. "list + add + edit"
 *
 * The book *detail* page (PAGE 24) already exists; nothing listed the titles,
 * so "Add Book" on the Librarian dashboard had nowhere to go. Availability is
 * the column that matters at a desk, so it leads each row.
 */
export function BookCatalogueView({ catalogue }: { catalogue: BookCatalogue }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("ALL");
  const [availability, setAvailability] = useState("ALL");
  const href = usePreviewHref();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue.books.filter((b) => {
      if (subject !== "ALL" && b.subjectArea !== subject) return false;
      if (availability === "AVAILABLE" && b.availableCopies === 0) return false;
      if (availability === "OUT" && b.availableCopies > 0) return false;
      if (!q) return true;
      return [b.title, b.authors.join(" "), b.isbn ?? "", b.locationCode ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [catalogue.books, query, subject, availability]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Book catalogue"
        description="Every title the library holds, with live availability."
        action={
          catalogue.canManage ? (
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
        <Kpi label="Titles" value={String(catalogue.totals.titles)} hint="in the catalogue" />
        <Kpi
          label="Available"
          value={String(catalogue.totals.available)}
          hint="copies on the shelf"
          tone={catalogue.totals.available > 0 ? "success" : "danger"}
        />
        <Kpi
          label="On loan"
          value={String(catalogue.totals.onLoan)}
          hint="copies out"
          tone="cyan"
        />
        <Kpi
          label="Out of circulation"
          value={String(catalogue.totals.outOfCirculation)}
          hint="damaged or lost"
          tone={catalogue.totals.outOfCirculation > 0 ? "warning" : "muted"}
        />
      </div>

      <StructureCard>
        <SearchBox
          id="cat-search"
          label="Search the catalogue"
          value={query}
          onChange={setQuery}
          placeholder="Search by title, author, ISBN or shelf..."
        />

        <FilterBar>
          <FilterSelect
            id="cat-subject"
            label="Subject"
            value={subject}
            onChange={setSubject}
            allLabel="Every subject"
            options={catalogue.subjects.map((s) => [s, s] as [string, string])}
          />
          <FilterSelect
            id="cat-availability"
            label="Availability"
            value={availability}
            onChange={setAvailability}
            allLabel="Any availability"
            options={[
              ["AVAILABLE", "On the shelf"],
              ["OUT", "All copies out"],
            ]}
          />
        </FilterBar>

        <ResultCount count={filtered.length} noun="title" />

        {filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No title matches those filters." />
          </div>
        ) : (
          <ul className="mt-4 grid min-w-0 gap-3">
            {filtered.map((book) => {
              const tone = availabilityTone(book.availableCopies, book.totalCopies);
              return (
                <li
                  key={book.id}
                  className="min-w-0 rounded-field border border-border bg-white p-4"
                >
                  {/*
                    Stacked below `sm`: a truncating title beside a shrink-0
                    chip collapses to ~50px at 320. flex-wrap does not protect
                    it — only stacking does.
                  */}
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={href(`/library/books/${book.id}`)}
                        className="font-display text-[15px] font-bold text-foreground transition-colors hover:text-accent"
                      >
                        {book.title}
                      </Link>
                      <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
                        {book.authors.join(", ")}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <StructureChip tone={tone}>
                        {book.availableCopies} of {book.totalCopies} free
                      </StructureChip>
                    </div>
                  </div>

                  <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[12px] sm:grid-cols-2">
                    <Row label="Shelf" value={book.locationCode ?? "—"} />
                    <Row label="ISBN" value={book.isbn ?? "—"} />
                    <Row
                      label="Subject"
                      value={book.subjectArea ?? "—"}
                    />
                    <Row
                      label="Edition"
                      value={
                        book.edition
                          ? `${book.edition}${book.publicationYear ? ` · ${book.publicationYear}` : ""}`
                          : "—"
                      }
                    />
                    {book.issuedCopies > 0 && (
                      <div className="flex min-w-0 gap-1.5">
                        <dt className="shrink-0 text-muted-foreground">On loan</dt>
                        <dd className={cn("min-w-0 font-medium", TONE_TEXT.cyan)}>
                          {book.issuedCopies}
                        </dd>
                      </div>
                    )}
                    {book.unavailableCopies > 0 && (
                      <div className="flex min-w-0 gap-1.5">
                        <dt className="shrink-0 text-muted-foreground">
                          Out of circulation
                        </dt>
                        <dd className={cn("min-w-0 font-medium", TONE_TEXT.warning)}>
                          {book.unavailableCopies}
                        </dd>
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
        <Library className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Availability counts physical copies. A copy marked damaged or lost is
          withdrawn from circulation, so free + on loan can be fewer than the
          total.
        </span>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}
