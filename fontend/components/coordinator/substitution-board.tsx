"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Repeat, UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { dateLabel, WHEN_LABELS } from "@/lib/coordinator";
import { formatTime, SLOT_TYPE_LABELS } from "@/lib/timetable";
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
import type {
  Substitution,
  SubstitutionBoard as Board,
  SubstitutionWhen,
} from "@/types/coordinator";

/**
 * C-AC-05 — Substitution Management.
 * "List of today's / upcoming substitutions"
 *
 * The timetable grid (PAGE 10) already flags a substituted cell, but a grid
 * cannot answer the question this page exists for: *what cover is in place
 * right now, and who is carrying it?* That needs the rows listed by date, not
 * scattered across a week's worth of cells.
 *
 * Today first, then upcoming, then past — the order a coordinator actually
 * reads them in on a weekday morning.
 */
export function SubstitutionBoardView({ board }: { board: Board }) {
  const [tab, setTab] = useState<SubstitutionWhen | "ALL">("TODAY");
  const [query, setQuery] = useState("");
  const href = usePreviewHref();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.rows.filter((r) => {
      if (tab !== "ALL" && r.when !== tab) return false;
      if (!q) return true;
      return [
        r.substituteTeacherName,
        r.originalTeacherName,
        r.className,
        r.subjectCode ?? "",
        r.subjectName ?? "",
        r.reason ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [board.rows, tab, query]);

  const tabs = [
    ["TODAY", `Today`, board.counts.today],
    ["UPCOMING", `Upcoming`, board.counts.upcoming],
    ["PAST", `Past`, board.counts.past],
    ["ALL", `All`, board.rows.length],
  ] as const;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Substitutions"
        description="Cover arranged for teachers who are away, across every class."
        action={
          board.canEdit ? (
            <Link
              href={href("/coordinator/substitutions/new")}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <Repeat className="h-4 w-4" aria-hidden="true" />
              Add substitution
            </Link>
          ) : (
            <ReadOnlyNote />
          )
        }
      />

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Today"
          value={String(board.counts.today)}
          hint="periods covered"
          tone={board.counts.today > 0 ? "warning" : "success"}
        />
        <Kpi
          label="Upcoming"
          value={String(board.counts.upcoming)}
          hint="already arranged"
        />
        <Kpi
          label="Teachers covering"
          value={String(board.counts.coveringTeachers)}
          hint="today or later"
          tone="cyan"
        />
        <Kpi
          label="Past"
          value={String(board.counts.past)}
          hint="this week"
          tone="muted"
        />
      </div>

      <StructureCard>
        <SearchBox
          id="sub-search"
          label="Search substitutions"
          value={query}
          onChange={setQuery}
          placeholder="Search by teacher, class or subject..."
        />

        <FilterTabs
          label="Filter substitutions by when they fall"
          tabs={tabs}
          value={tab}
          onChange={(v) => setTab(v as SubstitutionWhen | "ALL")}
        />

        <ResultCount count={filtered.length} noun="substitution" />

        {filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              message={
                query
                  ? "No substitution matches that search."
                  : tab === "TODAY"
                    ? "No cover is needed today — every class has its own teacher."
                    : "Nothing here yet."
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid min-w-0 gap-3">
            {filtered.map((row) => (
              <SubstitutionRow key={row.id} row={row} showDate={tab !== "TODAY"} />
            ))}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          A substitution replaces the teacher for one period on one date. The
          timetable itself is unchanged — edit the slot instead if the change is
          permanent.
        </span>
      </p>
    </div>
  );
}

/** One substitution, read as "who is covering whose period, and when". */
function SubstitutionRow({
  row,
  showDate,
}: {
  row: Substitution;
  showDate: boolean;
}) {
  const past = row.when === "PAST";

  return (
    <li
      className={cn(
        "min-w-0 rounded-field border p-4",
        past ? "border-border bg-muted/40" : "border-border bg-white",
      )}
    >
      {/*
        Stacked below `sm`. A truncating name beside a shrink-0 chip collapses
        to ~50px at 320 — `flex-wrap` does not protect it, only stacking does.
      */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="min-w-0 font-display text-[15px] font-bold text-foreground">
            <span className="break-words">{row.substituteTeacherName}</span>
            <span className="font-sans font-normal text-muted-foreground">
              {" "}
              covering{" "}
            </span>
            <span className="break-words">{row.originalTeacherName}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {row.subjectCode ? `${row.subjectCode} — ` : ""}
            {row.subjectName} · {row.className}
            {row.roomNo ? ` · Room ${row.roomNo}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StructureChip tone={past ? "muted" : row.when === "TODAY" ? "warning" : "accent"}>
            {WHEN_LABELS[row.when]}
          </StructureChip>
          {row.slotType !== "CLASS" && (
            <StructureChip tone="muted">
              {SLOT_TYPE_LABELS[row.slotType]}
            </StructureChip>
          )}
        </div>
      </div>

      <dl className="mt-3 grid min-w-0 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[12px] sm:grid-cols-2">
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-muted-foreground">Period</dt>
          <dd className="min-w-0 font-medium text-foreground">
            {row.periodNumber} · {formatTime(row.startTime)}–
            {formatTime(row.endTime)}
          </dd>
        </div>
        {showDate && (
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 text-muted-foreground">Date</dt>
            <dd className="min-w-0 font-medium text-foreground">
              {dateLabel(row.date)}
            </dd>
          </div>
        )}
        {row.reason && (
          <div className="flex min-w-0 gap-1.5 sm:col-span-2">
            <dt className="shrink-0 text-muted-foreground">Reason</dt>
            <dd className="min-w-0 break-words text-foreground">{row.reason}</dd>
          </div>
        )}
        {row.arrangedByName && (
          <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2">
            <UserCheck
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <dt className="sr-only">Arranged by</dt>
            <dd className="min-w-0 break-words text-muted-foreground">
              Arranged by {row.arrangedByName}
            </dd>
          </div>
        )}
      </dl>
    </li>
  );
}
