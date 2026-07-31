"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { filtersFor } from "@/lib/notices";
import type { Notice, NoticePermissions } from "@/types/notice";
import { NoticeCard } from "./notice-card";

/**
 * Notice feed — Notice_Board_design.md §4, §7, §10.
 * One URL for all 18 roles; the Post button, filter pills and empty-state copy
 * all come from the role's permissions.
 */
export function NoticeFeed({
  notices,
  perms,
  emptyHint,
}: {
  notices: Notice[];
  perms: NoticePermissions;
  /** Role-specific empty copy, e.g. "…haven't posted notices for FY-A" (§10) */
  emptyHint: string;
}) {
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const filters = useMemo(() => filtersFor(perms), [perms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return notices.filter((n) => {
      if (filter === "PINNED" && !n.isPinned) return false;
      if (filter === "URGENT" && n.priority !== "URGENT") return false;
      if (
        filter !== "ALL" &&
        filter !== "PINNED" &&
        filter !== "URGENT" &&
        n.targetScope !== filter
      )
        return false;

      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.author.name.toLowerCase().includes(q)
      );
    });
  }, [notices, filter, query]);

  const pinned = visible.filter((n) => n.isPinned);
  const rest = visible.filter((n) => !n.isPinned);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Notice Board
          </h1>
          <span className="rounded-full border border-accent-border bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
            {notices.length} {notices.length === 1 ? "notice" : "notices"}
          </span>
        </div>

        {perms.canPost && (
          <Link
            href="/notices/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Post Notice
          </Link>
        )}
      </div>

      {/* View-only banner (§10) */}
      {!perms.canPost && perms.note && (
        <p className="mb-5 flex items-center gap-2 rounded-field border border-border bg-background px-4 py-2.5 text-[13px] text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          {perms.note}
        </p>
      )}

      {/* Filters + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter notices"
          className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1"
        >
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-medium transition",
                filter === f.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="relative flex shrink-0 items-center sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-[#94A3B8]"
            aria-hidden="true"
          />
          <span className="sr-only">Search notices</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices…"
            className="h-9 w-full rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
      </div>

      {/* Empty state (§10) */}
      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-white py-14 text-center">
          <p className="font-display text-[15px] font-bold text-foreground">
            {query || filter !== "ALL" ? "No matching notices" : "No notices yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-muted-foreground">
            {query || filter !== "ALL"
              ? "Try a different filter or search term."
              : emptyHint}
          </p>
          {perms.canPost && !query && filter === "ALL" && (
            <Link
              href="/notices/new"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Post the first notice
            </Link>
          )}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pinned
              </h2>
              <div className="grid gap-4">
                {pinned.map((n) => (
                  <NoticeCard
                    key={n.id}
                    notice={n}
                    canModerate={perms.canModerate}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  All notices
                </h2>
              )}
              <div className="grid gap-4">
                {rest.map((n) => (
                  <NoticeCard
                    key={n.id}
                    notice={n}
                    canModerate={perms.canModerate}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
