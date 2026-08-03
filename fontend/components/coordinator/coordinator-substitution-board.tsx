"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus, RefreshCw, Trash2, UserCheck } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  deleteCoordinatorSubstitution,
  fetchCoordinatorSubstitutionBoard,
  type CoordinatorSubstitutionBoard,
  type CoordinatorSubstitutionRow,
  type CoordinatorSubstitutionWhen,
} from "@/lib/coordinator-api";
import { dateLabel } from "@/lib/coordinator";
import { formatTime } from "@/lib/timetable";

/** C-AC-05 — today's / upcoming substitutions, served by the live API. */
export function CoordinatorSubstitutionBoardPage() {
  const resource = useResource(fetchCoordinatorSubstitutionBoard, []);
  const [tab, setTab] = useState<CoordinatorSubstitutionWhen | "ALL">("TODAY");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Substitutions"
        subtitle="Cover arranged for teachers who are away, across every class."
        action={
          <Link
            href="/coordinator/substitutions/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add substitution
          </Link>
        }
      />

      <BoardState
        resource={resource}
        tab={tab}
        setTab={setTab}
        query={query}
        setQuery={setQuery}
        deletingId={deletingId}
        onDelete={async (id) => {
          setDeletingId(id);
          try {
            await deleteCoordinatorSubstitution(id);
            await resource.reload();
          } finally {
            setDeletingId(null);
          }
        }}
      />
    </div>
  );
}

function BoardState({
  resource,
  tab,
  setTab,
  query,
  setQuery,
  deletingId,
  onDelete,
}: {
  resource: ReturnType<typeof useResource<CoordinatorSubstitutionBoard>>;
  tab: CoordinatorSubstitutionWhen | "ALL";
  setTab: (value: CoordinatorSubstitutionWhen | "ALL") => void;
  query: string;
  setQuery: (value: string) => void;
  deletingId: string | null;
  onDelete: (id: string) => Promise<void>;
}) {
  if (resource.loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Loading substitutions…</p>
      </Card>
    );
  }
  if (resource.error) {
    return (
      <Card>
        <EmptyState text={resource.error} />
        <button
          type="button"
          onClick={resource.reload}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Try again
        </button>
      </Card>
    );
  }
  if (!resource.data) {
    return null;
  }

  const filtered = resource.data.rows.filter((row) => {
    if (tab !== "ALL" && row.when !== tab) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [
      row.substitute_teacher_name,
      row.original_teacher_name,
      row.class_name,
      row.subject_code ?? "",
      row.subject_name ?? "",
      row.reason ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Today"
          value={String(resource.data.counts.today)}
          hint="periods covered"
          tone={resource.data.counts.today > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Upcoming"
          value={String(resource.data.counts.upcoming)}
          hint="already arranged"
          tone="default"
        />
        <StatTile
          label="Covering teachers"
          value={String(resource.data.counts.covering_teachers)}
          hint="today or later"
          tone="accent"
        />
        <StatTile
          label="Past"
          value={String(resource.data.counts.past)}
          hint="this view"
          tone="muted"
        />
      </section>

      <Card className="!p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by teacher, class or subject…"
              className="h-10 rounded-field border border-border bg-white px-3 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <FilterTabs tab={tab} setTab={setTab} counts={resource.data.counts} />
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          {filtered.length} match{filtered.length === 1 ? "" : "es"} of {resource.data.rows.length} total
        </p>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState text="Nothing to show for this filter." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <SubstitutionCard
              key={row.id}
              row={row}
              showDate={tab !== "TODAY"}
              deleting={deletingId === row.id}
              onDelete={() => onDelete(row.id)}
            />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          A substitution replaces the teacher for one period on one date. The
          timetable itself is unchanged — edit the slot instead if the change
          is permanent.
        </span>
      </p>
    </>
  );
}

function FilterTabs({
  tab,
  setTab,
  counts,
}: {
  tab: CoordinatorSubstitutionWhen | "ALL";
  setTab: (value: CoordinatorSubstitutionWhen | "ALL") => void;
  counts: CoordinatorSubstitutionBoard["counts"];
}) {
  const tabs: Array<{ key: CoordinatorSubstitutionWhen | "ALL"; label: string; count: number }> = [
    { key: "TODAY", label: "Today", count: counts.today },
    { key: "UPCOMING", label: "Upcoming", count: counts.upcoming },
    { key: "PAST", label: "Past", count: counts.past },
    { key: "ALL", label: "All", count: counts.total },
  ];
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Filter
      </span>
      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
              tab === entry.key
                ? "bg-accent text-white shadow-accent"
                : "border border-border bg-white text-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {entry.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === entry.key
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {entry.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "default" | "accent" | "muted" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-primary",
    accent: "text-accent",
    muted: "text-muted-foreground",
    warning: "text-warning-text",
    success: "text-success-text",
  }[tone];
  return (
    <Card className="!p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 font-display text-2xl font-extrabold ${toneClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function SubstitutionCard({
  row,
  showDate,
  deleting,
  onDelete,
}: {
  row: CoordinatorSubstitutionRow;
  showDate: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-field border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold text-foreground">
            <span>{row.substitute_teacher_name}</span>{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              covering
            </span>{" "}
            <span>{row.original_teacher_name}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {row.subject_code ? `${row.subject_code} · ` : ""}
            {row.subject_name ?? "—"} · {row.class_name}
            {row.room_no ? ` · Room ${row.room_no}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WhenChip when={row.when} />
          {row.slot_type !== "CLASS" ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {row.slot_type}
            </span>
          ) : null}
        </div>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[12px] sm:grid-cols-2">
        <Detail term="Period">
          {row.period_number} · {formatTime(row.start_time)}–
          {formatTime(row.end_time)}
        </Detail>
        {showDate ? <Detail term="Date">{dateLabel(row.date)}</Detail> : null}
        {row.reason ? (
          <Detail term="Reason" wide>
            {row.reason}
          </Detail>
        ) : null}
        {row.arranged_by_name ? (
          <Detail term="Arranged by" wide>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" aria-hidden /> {row.arranged_by_name}
            </span>
          </Detail>
        ) : null}
      </dl>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex h-8 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-[12px] font-semibold text-destructive transition hover:border-destructive disabled:opacity-60"
        >
          {deleting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {deleting ? "Removing…" : "Cancel cover"}
        </button>
      </div>
    </li>
  );
}

function Detail({
  term,
  children,
  wide,
}: {
  term: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`flex gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="shrink-0 text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function WhenChip({ when }: { when: CoordinatorSubstitutionWhen }) {
  const toneClass = {
    TODAY: "bg-warning-light text-warning-text border-warning-border",
    UPCOMING: "bg-accent-light text-accent border-accent-border",
    PAST: "bg-muted text-muted-foreground border-border",
  }[when];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}
    >
      {when === "TODAY" ? "Today" : when === "UPCOMING" ? "Upcoming" : "Past"}
    </span>
  );
}
