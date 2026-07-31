"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FolderOpen, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { groupBySubject } from "@/lib/content";
import { Card } from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import { ContentRow } from "./content-row";
import type { ContentItem, ContentPermissions, ContentType } from "@/types/content";

/**
 * Content library — PAGE 8, shared by all five roles.
 *
 * Material is grouped subject → chapter (the browse tree students need), and
 * the same tree serves the teacher's own list and the oversight views. Row
 * actions vary by `perms`, the structure doesn't — so one component, not five.
 */

const TYPE_FILTERS: (ContentType | "ALL")[] = [
  "ALL",
  "PDF",
  "VIDEO",
  "SLIDE",
  "LINK",
  "AUDIO",
  "ZIP",
];

export function ContentLibrary({
  items,
  perms,
  showOwner = false,
  emptyHint,
}: {
  items: ContentItem[];
  perms: ContentPermissions;
  showOwner?: boolean;
  emptyHint: string;
}) {
  const [type, setType] = useState<ContentType | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length };
    for (const i of items) c[i.contentType] = (c[i.contentType] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (type !== "ALL" && i.contentType !== type) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false) ||
        i.subjectCode.toLowerCase().includes(q) ||
        i.chapter.toLowerCase().includes(q) ||
        i.uploadedBy.toLowerCase().includes(q) ||
        i.tags.some((t) => t.includes(q))
      );
    });
  }, [items, type, query]);

  const subjects = useMemo(() => groupBySubject(visible), [visible]);

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {/* Type filter + search */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter by type"
          className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1"
        >
          {TYPE_FILTERS.filter((t) => t === "ALL" || counts[t]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition",
                type === t
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent hover:text-foreground",
              )}
            >
              {t === "ALL" ? "All" : t}
              <span className="ml-1.5 opacity-70">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <label className="relative flex shrink-0 items-center sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <span className="sr-only">Search material</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search material…"
            className="h-9 w-full rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
      </div>

      {subjects.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <p className="font-display text-[15px] font-bold text-foreground">
            {query || type !== "ALL" ? "No matching material" : "No material yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-muted-foreground">
            {query || type !== "ALL"
              ? "Try a different type or search term."
              : emptyHint}
          </p>
        </Card>
      ) : (
        subjects.map((subject) => {
          const isCollapsed = collapsed[subject.subjectCode] ?? false;

          return (
            <Card key={subject.subjectCode} className="min-w-0 p-5 sm:p-6">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({
                    ...c,
                    [subject.subjectCode]: !isCollapsed,
                  }))
                }
                aria-expanded={!isCollapsed}
                className="flex w-full min-w-0 items-center gap-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-accent-light">
                  <FolderOpen className="h-4 w-4 text-accent" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] font-bold text-foreground">
                    <span className="font-mono text-[13px]">
                      {subject.subjectCode}
                    </span>{" "}
                    {subject.subjectName}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {subject.itemCount} item{subject.itemCount === 1 ? "" : "s"} ·{" "}
                    {subject.chapters.length} chapter
                    {subject.chapters.length === 1 ? "" : "s"}
                    {showOwner && ` · ${subject.teacherName}`}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isCollapsed && "-rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>

              {!isCollapsed && (
                <div className="mt-4 space-y-4 border-t border-border pt-2">
                  {subject.chapters.map((chapter) => (
                    <div key={chapter.chapter} className="min-w-0">
                      <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {chapter.chapter}
                      </h3>
                      <ul className="min-w-0 divide-y divide-border">
                        {chapter.items.map((item) => (
                          <ContentRow
                            key={item.id}
                            item={item}
                            perms={perms}
                            showOwner={showOwner}
                            onAction={setStatus}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
