"use client";

import { useMemo, useState } from "react";
import { Eye, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { filtersFor } from "@/lib/discussion";
import type { DiscussionPermissions, DiscussionThread } from "@/types/discussion";
import { ThreadCard } from "./thread-card";
import { NewThreadDialog } from "./new-thread-dialog";

/**
 * Thread list — role_based_shared_pages.md PAGE 3 (`<ThreadList>`).
 * Scope pills come from the role's visible scopes; the New Thread button is
 * shown only to roles that can post (`<NewThreadButton>`).
 */
export function ThreadList({
  threads,
  perms,
  emptyHint,
}: {
  threads: DiscussionThread[];
  perms: DiscussionPermissions;
  emptyHint: string;
}) {
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const filters = useMemo(() => filtersFor(perms), [perms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return threads.filter((t) => {
      if (filter === "PINNED" && !t.isPinned) return false;
      if (filter === "RESOLVED" && !t.isResolved) return false;
      if (filter === "UNANSWERED" && t.replyCount > 0) return false;
      if (
        !["ALL", "PINNED", "RESOLVED", "UNANSWERED"].includes(filter) &&
        t.scopeType !== filter
      )
        return false;

      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.author.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q))
      );
    });
  }, [threads, filter, query]);

  const pinned = visible.filter((t) => t.isPinned);
  const rest = visible.filter((t) => !t.isPinned);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[22px] font-bold text-foreground">
            Discussion
          </h1>
          <span className="rounded-full border border-accent-border bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
            {threads.length} {threads.length === 1 ? "thread" : "threads"}
          </span>
        </div>

        {perms.canPost && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Thread
          </button>
        )}
      </div>

      {/* Role note — limited or view-only access */}
      {perms.note && (
        <p className="mb-5 flex items-center gap-2 rounded-field border border-border bg-background px-4 py-2.5 text-[13px] text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          {perms.note}
        </p>
      )}

      {/* Filters + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label="Filter threads"
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
          <span className="sr-only">Search threads</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads…"
            className="h-9 w-full rounded-field border border-border bg-white pl-9 pr-3 text-[13px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </label>
      </div>

      {/* Feed */}
      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-white py-14 text-center">
          <p className="font-display text-[15px] font-bold text-foreground">
            {query || filter !== "ALL" ? "No matching threads" : "No threads yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] text-muted-foreground">
            {query || filter !== "ALL"
              ? "Try a different filter or search term."
              : emptyHint}
          </p>
          {perms.canPost && !query && filter === "ALL" && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start the first thread
            </button>
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
                {pinned.map((t) => (
                  <ThreadCard key={t.id} thread={t} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              {pinned.length > 0 && (
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  All threads
                </h2>
              )}
              <div className="grid gap-4">
                {rest.map((t) => (
                  <ThreadCard key={t.id} thread={t} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {composing && (
        <NewThreadDialog perms={perms} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}
