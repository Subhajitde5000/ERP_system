"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Megaphone, Pin, Plus, Search } from "lucide-react";

import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchCoordinatorNotices,
  type CoordinatorNoticeRow,
} from "@/lib/coordinator-api";

export function CoordinatorNoticeFeedPage() {
  const [query, setQuery] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);

  const resource = useResource(
    () =>
      fetchCoordinatorNotices({
        query: query.trim() || undefined,
        include_expired: includeExpired,
        limit: 50,
      }),
    [query, includeExpired],
  );

  const notices = resource.data?.items ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Notice feed"
        subtitle="Academic announcements and notices posted for institution classes."
        action={
          <Link
            href="/coordinator/notices/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden /> Post notice
          </Link>
        }
      />

      {/* Filter and search bar */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notice by title or content…"
              className="h-10 w-full rounded-field border border-border bg-white pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeExpired}
              onChange={(e) => setIncludeExpired(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
            />
            <span>Include expired notices</span>
          </label>
        </div>
      </Card>

      {/* Feed list state */}
      {resource.loading ? (
        <Card>
          <p className="text-sm text-muted-foreground">Loading notice feed…</p>
        </Card>
      ) : resource.error ? (
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
      ) : notices.length === 0 ? (
        <Card>
          <EmptyState text="No academic notices found." />
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeCard({ notice }: { notice: CoordinatorNoticeRow }) {
  const isExpired =
    notice.expires_at && new Date(notice.expires_at) < new Date();

  return (
    <Card className={`relative transition hover:shadow-md ${isExpired ? "opacity-60 bg-muted/20" : ""}`}>
      <div className="flex flex-col gap-3">
        {/* Header Badges & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {notice.is_pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                <Pin className="h-3 w-3 fill-accent" aria-hidden /> Pinned
              </span>
            ) : null}

            <PriorityBadge priority={notice.priority} />

            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
              {notice.target_name ? `Class: ${notice.target_name}` : notice.target_scope}
            </span>

            {isExpired ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                Expired
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden /> {notice.read_count} read{notice.read_count === 1 ? "" : "s"}
            </span>
            <span>
              {new Date(notice.published_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Title & Author */}
        <div>
          <h3 className="font-display text-base font-bold text-primary flex items-center gap-2">
            <Megaphone className="h-4.5 w-4.5 text-accent shrink-0" aria-hidden />
            {notice.title}
          </h3>
          {notice.author_name ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Posted by <span className="font-medium text-foreground">{notice.author_name}</span>
            </p>
          ) : null}
        </div>

        {/* Body Content */}
        <div className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/20 p-3.5 rounded-lg border border-border/40">
          {notice.body}
        </div>

        {/* Expiry detail */}
        {notice.expires_at ? (
          <p className="text-[11px] text-muted-foreground">
            Expires:{" "}
            {new Date(notice.expires_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: CoordinatorNoticeRow["priority"];
}) {
  switch (priority) {
    case "URGENT":
      return (
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          Urgent
        </span>
      );
    case "IMPORTANT":
      return (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Important
        </span>
      );
    case "NORMAL":
    default:
      return (
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          Normal
        </span>
      );
  }
}
