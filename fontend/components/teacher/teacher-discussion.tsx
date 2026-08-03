"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Lock, Pin, Plus, Search, Trash2, Unlock } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  acceptTeacherReply,
  createTeacherThread,
  fetchTeacherDiscussion,
  fetchTeacherThread,
  fetchTeachingAssignments,
  moderateTeacherThread,
  replyToTeacherThread,
  type TeacherModerationAction,
  type TeacherThreadDetail,
} from "@/lib/teacher";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

/** C-TC-21 — threads in the teacher's subjects and classes. */
export function TeacherDiscussionPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ query: "", scope: "" });
  const resource = useResource(() => {
    const [scopeType, scopeId] = filters.scope.split(":");
    return fetchTeacherDiscussion({
      query: filters.query || undefined,
      scopeType: (scopeType as "CLASS" | "SUBJECT") || undefined,
      scopeId: scopeId || undefined,
      limit: 100,
    });
  }, [filters.query, filters.scope]);
  const [composeOpen, setComposeOpen] = useState(false);

  const scopes = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    const seenClasses = new Set<string>();
    for (const assignment of assignments.data ?? []) {
      if (!seenClasses.has(assignment.class_id)) {
        seenClasses.add(assignment.class_id);
        result.push({ key: `CLASS:${assignment.class_id}`, label: `Class · ${assignment.class_name}` });
      }
      result.push({ key: `SUBJECT:${assignment.subject_id}`, label: `${assignment.subject_code} · ${assignment.subject_name}` });
    }
    return result;
  }, [assignments.data]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Discussion forum"
        subtitle="Threads in the subjects and classes you teach. You can answer, accept answers and moderate your own subjects."
        action={
          <button
            type="button"
            onClick={() => setComposeOpen((open) => !open)}
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" /> New thread
          </button>
        }
      />
      {composeOpen ? (
        <ThreadComposer
          scopes={scopes}
          onCreated={async (thread) => {
            setComposeOpen(false);
            await resource.reload();
            return thread;
          }}
          onCancel={() => setComposeOpen(false)}
        />
      ) : null}
      <Card className="mb-5 !p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search discussions"
              className={`${inputClass} pl-10`}
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="Search title or content"
            />
          </div>
          <select
            aria-label="Filter by class or subject"
            className={inputClass}
            value={filters.scope}
            onChange={(event) => setFilters({ ...filters, scope: event.target.value })}
          >
            <option value="">All my classes &amp; subjects</option>
            {scopes.map((scope) => (
              <option key={scope.key} value={scope.key}>{scope.label}</option>
            ))}
          </select>
        </div>
      </Card>
      <AsyncState loading={resource.loading || assignments.loading} error={resource.error ?? assignments.error} onRetry={resource.reload} loadingLabel="Loading discussions…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="space-y-3">
              {resource.data.items.map((thread) => (
                <Link key={thread.id} href={`/teacher/discussion/${thread.id}`} className="block">
                  <Card className="transition hover:border-accent-border">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {thread.is_pinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">
                          <Pin className="h-3 w-3" /> PINNED
                        </span>
                      ) : null}
                      {thread.is_locked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2.5 py-1 text-[10px] font-bold text-warning-text">
                          <Lock className="h-3 w-3" /> LOCKED
                        </span>
                      ) : null}
                      {thread.is_resolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-[10px] font-bold text-success-text">
                          <CheckCircle2 className="h-3 w-3" /> RESOLVED
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                        {thread.scope_name ?? statusLabel(thread.scope_type)}
                      </span>
                      {thread.mine ? <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">MY THREAD</span> : null}
                    </div>
                    <h2 className="font-display text-base font-bold text-primary">{thread.title}</h2>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{thread.body}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      By {thread.author_name ?? "Deleted user"} · {thread.reply_count} replies · {thread.upvote_count} upvotes · {dateTime(thread.updated_at)}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState text="No discussions match. Start the first thread for your class." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

function ThreadComposer({
  scopes,
  onCreated,
  onCancel,
}: {
  scopes: { key: string; label: string }[];
  onCreated: (thread: TeacherThreadDetail) => Promise<TeacherThreadDetail>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ title: "", body: "", scope: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [scopeType, scopeId] = form.scope.split(":");
    if (!scopeType || !scopeId) {
      setError("Choose the class or subject this thread belongs to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const thread = await createTeacherThread({
        title: form.title.trim(),
        body: form.body.trim(),
        scope_type: scopeType as "CLASS" | "SUBJECT",
        scope_id: scopeId,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
      });
      await onCreated(thread);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post this thread.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="font-display text-base font-bold text-primary">Start a thread</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="thread-title" className={labelClass}>Title</label>
          <input id="thread-title" className={inputClass} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="thread-body" className={labelClass}>Message</label>
          <textarea id="thread-body" className={`${inputClass} min-h-28 py-3`} maxLength={20000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="thread-scope" className={labelClass}>Post in</label>
            <select id="thread-scope" className={inputClass} value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} required>
              <option value="">Choose class or subject</option>
              {scopes.map((scope) => (
                <option key={scope.key} value={scope.key}>{scope.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="thread-tags" className={labelClass}>Tags (comma separated)</label>
            <input id="thread-tags" className={inputClass} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="doubt, unit-3" />
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
            {busy ? "Posting…" : "Post thread"}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

/** C-TC-22 — one thread: replies, accept answer, pin / lock / delete. */
export function TeacherThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;
  const resource = useResource(() => fetchTeacherThread(threadId), [threadId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(action: string, task: () => Promise<TeacherThreadDetail>) {
    setBusy(action);
    setActionError(null);
    try {
      const updated = await task();
      resource.setData(updated);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) return;
    setBusy("reply");
    setActionError(null);
    try {
      await replyToTeacherThread(threadId, reply.trim());
      setReply("");
      await resource.reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not post your reply.");
    } finally {
      setBusy(null);
    }
  }

  const thread = resource.data;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Thread" subtitle="Replies, accepted answer and moderation for your subjects." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading thread…">
        {thread ? (
          <div className="space-y-5">
            <Card>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {thread.is_pinned ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">
                    <Pin className="h-3 w-3" /> PINNED
                  </span>
                ) : null}
                {thread.is_locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-light px-2.5 py-1 text-[10px] font-bold text-warning-text">
                    <Lock className="h-3 w-3" /> LOCKED
                  </span>
                ) : null}
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                  {thread.scope_name ?? statusLabel(thread.scope_type)}
                </span>
                {thread.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">#{tag}</span>
                ))}
              </div>
              <h1 className="font-display text-xl font-bold text-primary">{thread.title}</h1>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{thread.body}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                By {thread.author_name ?? "Deleted user"} · {dateTime(thread.created_at)} · {thread.upvote_count} upvotes · {thread.view_count} views
              </p>
              {thread.can_moderate ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <ModerationButton
                    label={thread.is_pinned ? "Unpin" : "Pin"}
                    icon={Pin}
                    disabled={busy !== null}
                    onClick={() => run("moderate", () => moderateTeacherThread(threadId, thread.is_pinned ? "UNPIN" : "PIN"))}
                  />
                  <ModerationButton
                    label={thread.is_locked ? "Unlock" : "Lock"}
                    icon={thread.is_locked ? Unlock : Lock}
                    disabled={busy !== null}
                    onClick={() => run("moderate", () => moderateTeacherThread(threadId, thread.is_locked ? "UNLOCK" : "LOCK"))}
                  />
                  <ModerationButton
                    label="Delete"
                    icon={Trash2}
                    danger
                    disabled={busy !== null}
                    onClick={() => run("delete", async () => {
                      await moderateTeacherThread(threadId, "DELETE" as TeacherModerationAction);
                      window.history.back();
                      return thread;
                    })}
                  />
                </div>
              ) : null}
            </Card>
            {actionError ? <p role="alert" className="text-sm text-destructive-text">{actionError}</p> : null}

            <Card>
              <h2 className="font-display text-base font-bold text-primary">{thread.replies.length} repl{thread.replies.length === 1 ? "y" : "ies"}</h2>
              {thread.replies.length ? (
                <ul className="mt-4 space-y-4">
                  {thread.replies.map((item) => (
                    <li key={item.id} className={`rounded-field border p-4 ${item.is_accepted_answer ? "border-success-border bg-success-light/50" : "border-border"}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-primary">
                          {item.author_name ?? "Deleted user"}
                          {item.mine ? " (you)" : ""}
                          <span className="ml-2 font-normal text-muted-foreground">{dateTime(item.created_at)}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          {item.is_accepted_answer ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-[10px] font-bold text-success-text">
                              <CheckCircle2 className="h-3 w-3" /> ACCEPTED ANSWER
                            </span>
                          ) : thread.can_moderate ? (
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => run(`accept-${item.id}`, () => acceptTeacherReply(item.id))}
                              className="inline-flex h-7 items-center gap-1 rounded-field border border-border px-2 text-[11px] font-semibold text-primary hover:border-success-border hover:text-success-text disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Accept answer
                            </button>
                          ) : null}
                          <span className="text-[11px] text-muted-foreground">{item.upvote_count} ▲</span>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No replies yet.</p>
              )}
              {thread.is_locked ? (
                <p className="mt-4 rounded-field border border-warning-border bg-warning-light px-4 py-2.5 text-sm text-warning-text">
                  This thread is locked — new replies are disabled.
                </p>
              ) : (
                <form onSubmit={sendReply} className="mt-4 space-y-3 border-t border-border pt-4">
                  <label htmlFor="reply-body" className={labelClass}>Your reply</label>
                  <textarea id="reply-body" className={`${inputClass} min-h-24 py-3`} maxLength={10000} value={reply} onChange={(event) => setReply(event.target.value)} required />
                  <button type="submit" disabled={busy === "reply" || !reply.trim()} className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                    {busy === "reply" ? "Posting…" : "Post reply"}
                  </button>
                </form>
              )}
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function ModerationButton({
  label,
  icon: Icon,
  danger = false,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Pin;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-field border px-3 text-xs font-semibold transition disabled:opacity-60 ${
        danger
          ? "border-destructive-border text-destructive-text hover:bg-destructive-light"
          : "border-border text-primary hover:border-accent hover:text-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
