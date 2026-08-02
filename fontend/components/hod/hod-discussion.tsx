"use client";

import { useState } from "react";
import { Lock, Pin, Search, Trash2, Unlock } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchHodDiscussion, moderateHodDiscussion } from "@/lib/hod";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

/** C-HD-11 — department thread moderation, including soft deletion. */
export function HodDiscussionPage() {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resource = useResource(() => fetchHodDiscussion({ query: query || undefined, limit: 100 }), [query]);

  async function moderate(id: string, action: "PIN" | "UNPIN" | "LOCK" | "UNLOCK" | "DELETE") {
    setBusyId(id); setError(null);
    try {
      const updated = await moderateHodDiscussion(id, action);
      if (!resource.data) return;
      if (action === "DELETE") resource.setData({ ...resource.data, total: Math.max(0, resource.data.total - 1), items: resource.data.items.filter((thread) => thread.id !== id) });
      else resource.setData({ ...resource.data, items: resource.data.items.map((thread) => thread.id === id ? updated : thread) });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not moderate this discussion."); }
    finally { setBusyId(null); }
  }

  return <div className="mx-auto max-w-5xl"><PageHeader title="Department discussion moderation" subtitle="Pin, lock or remove threads in your department classes and subjects." />
    <Card className="mb-5 !p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="search" aria-label="Search department discussions" className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or content" /></div>{error ? <p role="alert" className="mt-3 text-sm text-destructive-text">{error}</p> : null}</Card>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading department discussions…">{resource.data ? resource.data.items.length ? <div className="space-y-3">{resource.data.items.map((thread) => <Card key={thread.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2">{thread.is_pinned ? <span className="rounded-full bg-accent-light px-2 py-1 text-[10px] font-bold text-accent">PINNED</span> : null}{thread.is_locked ? <span className="rounded-full bg-warning-light px-2 py-1 text-[10px] font-bold text-warning-text">LOCKED</span> : null}<span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{statusLabel(thread.scope_type)}</span></div><h2 className="font-display text-base font-bold text-primary">{thread.title}</h2><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{thread.body}</p><p className="mt-3 text-xs text-muted-foreground">By {thread.author_name ?? "Deleted user"} · {thread.reply_count} replies · {dateTime(thread.updated_at)}</p></div><div className="flex shrink-0 flex-wrap gap-2">{thread.is_pinned ? <Action icon={Pin} label="Unpin" disabled={busyId === thread.id} onClick={() => moderate(thread.id, "UNPIN")} /> : <Action icon={Pin} label="Pin" disabled={busyId === thread.id} onClick={() => moderate(thread.id, "PIN")} />}{thread.is_locked ? <Action icon={Unlock} label="Unlock" disabled={busyId === thread.id} onClick={() => moderate(thread.id, "UNLOCK")} /> : <Action icon={Lock} label="Lock" disabled={busyId === thread.id} onClick={() => moderate(thread.id, "LOCK")} />}<Action icon={Trash2} label="Delete" danger disabled={busyId === thread.id} onClick={() => moderate(thread.id, "DELETE")} /></div></div></Card>)}</div> : <EmptyState text="No department discussions match this search." /> : null}</AsyncState>
  </div>;
}

function Action({ icon: Icon, label, danger = false, disabled, onClick }: { icon: typeof Pin; label: string; danger?: boolean; disabled: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex h-8 items-center gap-1 rounded-field border px-2.5 text-xs font-semibold disabled:opacity-50 ${danger ? "border-destructive-border text-destructive-text hover:bg-destructive-light" : "border-border text-primary hover:border-accent hover:text-accent"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }
