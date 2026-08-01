"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileDown, MonitorPlay } from "lucide-react";

import { formatDate } from "@/lib/utils";
import { E_RESOURCE_LABELS, E_RESOURCE_TONE } from "@/lib/library";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  FilterSelect,
  FilterBar,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import {
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureHeader,
} from "@/components/structure/structure-bits";
import type { EResourceShelf, EResourceType } from "@/types/library";

/**
 * C-LB-08 — E-Resources. Digital holdings from `e_resources` (DB §8.1).
 *
 * §8.1 stores either a `url` (an external subscription) or a `file_key` (an
 * object the library uploaded), never both, so a row renders as a link out or
 * a download accordingly — an "Open" button that resolves to nothing would be
 * the same dead end this batch exists to remove.
 *
 * Unlike the rest of the console this page is **not** librarian-only: readers
 * are the audience for a journal subscription. `canManage` only adds the
 * upload affordance.
 */
export function EResourcesView({ shelf }: { shelf: EResourceShelf }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [subject, setSubject] = useState("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shelf.resources.filter((r) => {
      if (type !== "ALL" && r.resourceType !== type) return false;
      if (subject !== "ALL" && r.subjectArea !== subject) return false;
      if (!q) return true;
      return [r.title, r.subjectArea ?? "", r.uploadedByName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [shelf.resources, query, type, subject]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="E-resources"
        description="Journals, e-books and papers the library subscribes to or hosts."
        action={shelf.canManage ? undefined : <ReadOnlyNote />}
      />

      <StructureCard>
        <SearchBox
          id="er-search"
          label="Search e-resources"
          value={query}
          onChange={setQuery}
          placeholder="Search by title or subject..."
        />

        <FilterBar>
          <FilterSelect
            id="er-type"
            label="Type"
            value={type}
            onChange={setType}
            allLabel="Every type"
            options={(
              ["EBOOK", "JOURNAL", "PAPER", "LINK"] as EResourceType[]
            ).map((t) => [t, E_RESOURCE_LABELS[t]] as [string, string])}
          />
          <FilterSelect
            id="er-subject"
            label="Subject"
            value={subject}
            onChange={setSubject}
            allLabel="Every subject"
            options={shelf.subjects.map((s) => [s, s] as [string, string])}
          />
        </FilterBar>

        <ResultCount count={filtered.length} noun="resource" />

        {filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="No resource matches those filters." />
          </div>
        ) : (
          <ul className="mt-4 grid min-w-0 gap-3">
            {filtered.map((r) => {
              const external = r.url !== null;
              return (
                <li
                  key={r.id}
                  className="min-w-0 rounded-field border border-border bg-white p-4"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-display text-[15px] font-bold text-foreground">
                        {r.title}
                      </p>
                      <p className="mt-0.5 break-words text-[12px] text-muted-foreground">
                        {r.subjectArea ?? "General"} · added{" "}
                        {formatDate(r.createdAt)} by {r.uploadedByName}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <StructureChip tone={E_RESOURCE_TONE[r.resourceType]}>
                        {E_RESOURCE_LABELS[r.resourceType]}
                      </StructureChip>

                      {external ? (
                        <a
                          href={r.url!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Open
                          <span className="sr-only"> {r.title} (opens in a new tab)</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                        >
                          <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                          Download
                          <span className="sr-only"> {r.title}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
        <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Subscription links open on the publisher&apos;s site and may ask you
          to sign in through the institution. Hosted files download directly.
        </span>
      </p>
    </div>
  );
}
