"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchStudentNotices, markStudentNoticeRead } from "@/lib/student";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

/** C-ST-18 — read notices for the student's class/department/institution; mark as read. */
export function StudentNoticesPage() {
  const [query, setQuery] = useState("");
  const resource = useResource(
    () => fetchStudentNotices({ query: query || undefined, limit: 100 }),
    [query],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function markRead(noticeId: string) {
    setBusyId(noticeId);
    setActionError(null);
    try {
      const updated = await markStudentNoticeRead(noticeId);
      if (resource.data) {
        const wasUnread = resource.data.items.some((notice) => notice.id === noticeId && !notice.is_read);
        resource.setData({
          ...resource.data,
          unread_count: wasUnread ? Math.max(0, resource.data.unread_count - 1) : resource.data.unread_count,
          items: resource.data.items.map((notice) => (notice.id === noticeId ? { ...notice, ...updated, is_read: true } : notice)),
        });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not mark this notice as read.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Notice board" subtitle="Notices for you, your class and your department." />
      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search notices"
            className={`${inputClass} pl-10`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or notice text"
          />
        </div>
        {resource.data ? (
          <span className="shrink-0 rounded-full bg-accent-light px-3 py-1.5 text-xs font-bold text-accent">
            {resource.data.unread_count} unread
          </span>
        ) : null}
      </div>
      {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading notices…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="space-y-3">
              {resource.data.items.map((notice) => (
                <Card key={notice.id} className={notice.is_read ? "" : "border-accent/40 bg-accent-light/20"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {notice.is_pinned ? <span aria-label="Pinned" title="Pinned">📌</span> : null}
                        {notice.priority === "URGENT" ? (
                          <span className="rounded-full bg-destructive-light px-2.5 py-1 text-[10px] font-bold text-destructive-text">URGENT</span>
                        ) : notice.priority === "IMPORTANT" ? (
                          <span className="rounded-full bg-warning-light px-2.5 py-1 text-[10px] font-bold text-warning-text">IMPORTANT</span>
                        ) : null}
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                          {notice.target_name ?? statusLabel(notice.target_scope)}
                        </span>
                        {!notice.is_read ? <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" /> : null}
                      </div>
                      <h2 className="font-display text-base font-bold text-primary">{notice.title}</h2>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{notice.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {notice.author_name ?? "Institution"} · {dateTime(notice.published_at)}
                        {notice.expires_at ? ` · expires ${dateTime(notice.expires_at)}` : ""}
                      </p>
                    </div>
                    {!notice.is_read ? (
                      <button
                        type="button"
                        disabled={busyId === notice.id}
                        onClick={() => markRead(notice.id)}
                        className="inline-flex h-9 shrink-0 items-center rounded-field border border-border px-3 text-xs font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        {busyId === notice.id ? "Marking…" : "Mark as read"}
                      </button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState text="No notices for you right now." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}
