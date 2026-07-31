"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { EXAM_STATUS_LABELS } from "@/lib/examination";
import { Card } from "@/components/dashboard/primitives";
import { ExamCard } from "./exam-card";
import type { ExamPermissions, ExamStatus, ExamSummary } from "@/types/examination";

/**
 * Exam list — PAGE 6.
 * Shared by Teacher (own), Exam Controller (all), HOD (dept) and
 * Principal/VP (institution); the data is scoped upstream, the chrome here.
 */

const FILTERS: { key: ExamStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "PUBLISHED", label: "Published" },
  { key: "ONGOING", label: "Ongoing" },
  { key: "COMPLETED", label: "Completed" },
  { key: "RESULTS_RELEASED", label: "Released" },
];

export function ExamList({
  exams,
  perms,
  showOwner = false,
  emptyHint,
}: {
  exams: ExamSummary[];
  perms: ExamPermissions;
  showOwner?: boolean;
  emptyHint: string;
}) {
  const [filter, setFilter] = useState<ExamStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: exams.length };
    for (const e of exams) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [exams]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter((e) => {
      if (filter !== "ALL" && e.status !== filter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.subjectCode.toLowerCase().includes(q) ||
        e.subjectName.toLowerCase().includes(q) ||
        e.className.toLowerCase().includes(q) ||
        e.createdBy.toLowerCase().includes(q)
      );
    });
  }, [exams, filter, query]);

  return (
    <div className="grid min-w-0 gap-4">
      {/* Filters + search */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter exams"
          className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1"
        >
          {FILTERS.filter((f) => f.key === "ALL" || counts[f.key]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition",
                filter === f.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <label className="relative flex shrink-0 items-center sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <span className="sr-only">Search exams</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams…"
            className="h-9 w-full rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <p className="font-display text-[15px] font-bold text-foreground">
            {query || filter !== "ALL" ? "No matching exams" : "No exams yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-muted-foreground">
            {query || filter !== "ALL"
              ? "Try a different filter or search term."
              : emptyHint}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visible.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              perms={perms}
              showOwner={showOwner}
            />
          ))}
        </div>
      )}

      {filter !== "ALL" && visible.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          Showing {visible.length} {EXAM_STATUS_LABELS[filter].toLowerCase()} exam
          {visible.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
