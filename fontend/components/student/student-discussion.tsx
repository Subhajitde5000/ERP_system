"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Lock, Pin, Plus, Search, ThumbsUp } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createStudentThread,
  fetchDiscussionScopes,
  fetchStudentDiscussion,
  fetchStudentThread,
  replyToStudentThread,
  toggleStudentVote,
} from "@/lib/student";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

/** C-ST-19 — ask questions across class/subject; accepted answers surface first. */
export function StudentDiscussionPage() {
  const scopes = useResource(fetchDiscussionScopes, []);
  const [filters, setFilters] = useState({ query: "", scopeId: "" });
  const resource = useResource(
    () => fetchStudentDiscussion({ query: filters.query || undefined, scopeId: filters.scopeId || undefined, limit: 100 }),
    [filters.query, filters.scopeId],
  );
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Discussion forum"
        subtitle="Ask questions in your class or a subject — everyone in scope can answer and upvote."
        action={
          <button
            type="button"
            onClick={() => setComposeOpen((open) => !open)}
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" /> Ask a question
          </button>
        }
      />
      {composeOpen && scopes.data?.length ? (
        <ThreadComposer
          scopes={scopes.data}
          onCreated={async () => {
            setComposeOpen(false);
            await resource.reload();
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
            value={filters.scopeId}
            onChange={(event) => setFilters({ ...filters, scopeId: event.target.value })}
          >
            <option value="">All my scopes</option>
            {(scopes.data ?? []).map((scope) => (
              <option key={scope.scope_id} value={scope.scope_id}>
                {scope.scope_type === "CLASS" ? "Class · " : ""}{scope.name}
              </option>
            ))}
          </select>
        </div>
      </Card>
      <AsyncState loading={resource.loading || scopes.loading} error={resource.error ?? scopes.error} onRetry={resource.reload} loadingLabel="Loading discussions…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="space-y-3">
              {resource.data.items.map((thread) => (
                <Link key={thread.id} href={`/student/discussion/${thread.id}`} className="block">
                  <Card className="transition hover:border-accent">
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
                          <CheckCircle2 className="h-3 w-3" /> ANSWERED
                        </span>
                      ) : null}
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                        {thread.scope_name ?? statusLabel(thread.scope_type)}
                      </span>
                    </div>
                    <h2 className="font-display text-base font-bold text-primary">{thread.title}</h2>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{thread.body}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      By {thread.mine ? "you" : thread.author_name ?? "Deleted user"} · {thread.reply_count} replies · {thread.upvote_count} upvotes · {dateTime(thread.updated_at)}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState text="No discussions yet — ask the first question." />
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
  scopes: Awaited<ReturnType<typeof fetchDiscussionScopes>>;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ title: "", body: "", scopeId: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = scopes.find((item) => item.scope_id === form.scopeId);
    if (!scope || (scope.scope_type !== "CLASS" && scope.scope_type !== "SUBJECT")) {
      setError("Choose where to post — your class or one of your subjects.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createStudentThread({
        title: form.title.trim(),
        body: form.body.trim(),
        scope_type: scope.scope_type as "CLASS" | "SUBJECT",
        scope_id: scope.scope_id,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post your question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="font-display text-base font-bold text-primary">Ask a question</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="question-title" className={labelClass}>Title</label>
          <input id="question-title" className={inputClass} minLength={3} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </div>
        <div>
          <label htmlFor="question-body" className={labelClass}>Details</label>
          <textarea id="question-body" className={`${inputClass} min-h-28 py-3`} maxLength={20000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="question-scope" className={labelClass}>Post in</label>
            <select id="question-scope" className={inputClass} value={form.scopeId} onChange={(event) => setForm({ ...form, scopeId: event.target.value })} required>
              <option value="">Choose class or subject</option>
              {scopes.map((scope) => (
                <option key={scope.scope_id} value={scope.scope_id}>
                  {scope.scope_type === "CLASS" ? "Class · " : ""}{scope.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="question-tags" className={labelClass}>Tags (comma separated)</label>
            <input id="question-tags" className={inputClass} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="doubt, unit-3" />
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
            {busy ? "Posting…" : "Post question"}
          </button>
          <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

/** Thread detail with replies, upvotes and the accepted answer. */
export function StudentThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const threadId = params.id;
  const resource = useResource(() => fetchStudentThread(threadId), [threadId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function vote(targetType: "THREAD" | "REPLY", targetId: string) {
    setBusy(`vote-${targetId}`);
    setActionError(null);
    try {
      const updated = await toggleStudentVote(targetType, targetId);
      resource.setData(updated);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not record your vote.");
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
      const updated = await replyToStudentThread(threadId, reply.trim());
      resource.setData(updated);
      setReply("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not post your reply.");
    } finally {
      setBusy(null);
    }
  }

  const thread = resource.data;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Question" subtitle="Upvote helpful answers; the accepted answer is pinned to the top." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the question…">
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  By {thread.mine ? "you" : thread.author_name ?? "Deleted user"} · {dateTime(thread.created_at)}
                </p>
                <VoteButton count={thread.upvote_count} active={thread.my_vote} disabled={busy === `vote-${thread.id}`} onClick={() => vote("THREAD", thread.id)} label="question" />
              </div>
            </Card>
            {actionError ? <p role="alert" className="text-sm text-destructive-text">{actionError}</p> : null}
            <Card>
              <h2 className="font-display text-base font-bold text-primary">
                {thread.replies.length} answer{thread.replies.length === 1 ? "" : "s"}
              </h2>
              {thread.replies.length ? (
                <ul className="mt-4 space-y-4">
                  {thread.replies.map((item) => (
                    <li key={item.id} className={`rounded-field border p-4 ${item.is_accepted_answer ? "border-success-border bg-success-light/50" : "border-border"}`}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-primary">
                          {item.mine ? "You" : item.author_name ?? "Deleted user"}
                          <span className="ml-2 font-normal text-muted-foreground">{dateTime(item.created_at)}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          {item.is_accepted_answer ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-1 text-[10px] font-bold text-success-text">
                              <CheckCircle2 className="h-3 w-3" /> ACCEPTED ANSWER
                            </span>
                          ) : null}
                          <VoteButton count={item.upvote_count} active={item.my_vote} disabled={busy === `vote-${item.id}`} onClick={() => vote("REPLY", item.id)} label="answer" />
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No answers yet — be the first to help.</p>
              )}
              {thread.is_locked ? (
                <p className="mt-4 rounded-field border border-warning-border bg-warning-light px-4 py-2.5 text-sm text-warning-text">
                  This thread is locked by a teacher — new answers are disabled.
                </p>
              ) : (
                <form onSubmit={sendReply} className="mt-4 space-y-3 border-t border-border pt-4">
                  <label htmlFor="student-reply" className={labelClass}>Your answer</label>
                  <textarea id="student-reply" className={`${inputClass} min-h-24 py-3`} maxLength={10000} value={reply} onChange={(event) => setReply(event.target.value)} required />
                  <button type="submit" disabled={busy === "reply" || !reply.trim()} className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                    {busy === "reply" ? "Posting…" : "Post answer"}
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

function VoteButton({
  count,
  active,
  disabled,
  onClick,
  label,
}: {
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${active ? "Remove your vote from" : "Upvote"} this ${label}`}
      className={`inline-flex h-8 items-center gap-1.5 rounded-field border px-2.5 text-xs font-semibold transition disabled:opacity-60 ${
        active ? "border-accent bg-accent-light text-accent" : "border-border text-muted-foreground hover:border-accent hover:text-accent"
      }`}
    >
      <ThumbsUp className="h-3.5 w-3.5" /> {count}
    </button>
  );
}
