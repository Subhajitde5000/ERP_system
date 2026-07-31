"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/dashboard/primitives";
import { AssignmentCard } from "./assignment-card";
import type {
  AssignmentPermissions,
  AssignmentStatus,
  AssignmentSummary,
} from "@/types/assignment";

/**
 * Assignment list — PAGE 7.
 * Shared by Teacher (own), HOD (dept) and Principal/VP drill-down; the data is
 * scoped upstream so this only owns filtering and search.
 */

const FILTERS: { key: AssignmentStatus | "ALL" | "REVIEW"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "REVIEW", label: "Needs review" },
  { key: "DRAFT", label: "Draft" },
  { key: "PUBLISHED", label: "Open" },
  { key: "CLOSED", label: "Closed" },
];

export function AssignmentList({
  assignments,
  perms,
  showOwner = false,
  emptyHint,
}: {
  assignments: AssignmentSummary[];
  perms: AssignmentPermissions;
  showOwner?: boolean;
  emptyHint: string;
}) {
  const [filter, setFilter] = useState<AssignmentStatus | "ALL" | "REVIEW">(
    "ALL",
  );
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      ALL: assignments.length,
      REVIEW: assignments.filter((a) => a.pendingReview > 0).length,
    };
    for (const a of assignments) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [assignments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (filter === "REVIEW" && a.pendingReview === 0) return false;
      if (filter !== "ALL" && filter !== "REVIEW" && a.status !== filter)
        return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.subjectCode.toLowerCase().includes(q) ||
        a.subjectName.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q) ||
        a.teacherName.toLowerCase().includes(q)
      );
    });
  }, [assignments, filter, query]);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter assignments"
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
          <span className="sr-only">Search assignments</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assignments…"
            className="h-9 w-full rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <p className="font-display text-[15px] font-bold text-foreground">
            {query || filter !== "ALL"
              ? "No matching assignments"
              : "No assignments yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-muted-foreground">
            {query || filter !== "ALL"
              ? "Try a different filter or search term."
              : emptyHint}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visible.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              perms={perms}
              showOwner={showOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
