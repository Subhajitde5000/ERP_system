"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, LockOpen, MessageSquare, Pin, PinOff, Plus } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  acceptTeacherAnswer,
  createTeacherThread,
  fetchTeacherMarkContext,
  fetchTeacherThread,
  fetchTeacherThreads,
  moderateTeacherThread,
  replyToTeacherThread,
  type TeacherThreadDetail,
} from "@/lib/teacher";
import { AsyncState, StatusPill, dateTime } from "@/components/teacher/teacher-ui";

/** C-TC-21 — threads in the teacher's own classes and subjects. */
export function TeacherDiscussionPage() {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const load = useCallback(() => fetchTeacherThreads({ query: query || undefined }), [query]);
  const resource = useResource(load, [query]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Discussion forum"
        subtitle="Questions from your classes and subjects. Accept an answer to close a thread out."
        action={
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {composing ? "Cancel" : "New thread"}
          </button>
        }
      />

      {composing ? (
        <ThreadComposer
          onCreated={() => {
            setComposing(false);
            resource.reload();
          }}
        />
      ) : null}

      <Card className="mb-5">
        <label className={labelClass} htmlFor="thread-search">
          Search
        </label>
        <input
          id="thread-search"
          className={inputClass}
          placeholder="Search titles and bodies"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </Card>

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading threads…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((thread) => (
              <Card key={thread.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/teacher/discussion/${thread.id}`}
                      className="flex items-center gap-1.5 font-display text-sm font-bold text-primary hover:text-accent"
                    >
                      {thread.is_pinned ? (
                        <Pin className="h-3.5 w-3.5 text-accent" aria-label="Pinned" />
                      ) : null}
                      {thread.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {thread.author_name ?? "—"} · {thread.scope_name ?? thread.scope_type} ·{" "}
                      {dateTime(thread.created_at)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {thread.is_resolved ? <StatusPill status="RESOLVED" tone="success" /> : null}
                    {thread.is_locked ? <StatusPill status="LOCKED" tone="default" /> : null}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> {thread.reply_count}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No threads yet in your classes." />
        )}
      </AsyncState>
    </div>
  );
}

function ThreadComposer({ onCreated }: { onCreated: () => void }) {
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const [scopeType, scopeId] = target.split(":");
    setBusy(true);
    setError(null);
    try {
      await createTeacherThread({
        title: title.trim(),
        body: text.trim(),
        scope_type: scopeType as "CLASS" | "SUBJECT",
        scope_id: scopeId!,
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the thread.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="new-thread-title">
            Title
          </label>
          <input
            id="new-thread-title"
            className={inputClass}
            required
            minLength={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="new-thread-body">
            Message
          </label>
          <textarea
            id="new-thread-body"
            rows={4}
            required
            className={`${inputClass} h-auto py-2.5`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="new-thread-scope">
            Post to
          </label>
          <select
            id="new-thread-scope"
            className={inputClass}
            required
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="">Select a class or subject</option>
            {(context.data?.classes ?? []).map((option) => (
              <option key={`class-${option.id}`} value={`CLASS:${option.id}`}>
                Class · {option.name}
              </option>
            ))}
            {(context.data?.subjects ?? []).map((option) => (
              <option key={`subject-${option.id}`} value={`SUBJECT:${option.id}`}>
                Subject · {option.class_name} · {option.code}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive-text">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Posting…" : "Post thread"}
        </button>
      </form>
    </Card>
  );
}

/** C-TC-22 — replies, accepting an answer, and moderating your own thread. */
export function TeacherThreadDetailPage({ threadId }: { threadId: string }) {
  const load = useCallback(() => fetchTeacherThread(threadId), [threadId]);
  const resource = useResource(load, [threadId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<TeacherThreadDetail>) {
    setBusy(true);
    setError(null);
    try {
      resource.setData(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete that action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Thread"
        subtitle="Reply, accept the answer that resolved it, and moderate threads you started."
        action={
          <Link href="/teacher/discussion" className="text-sm font-semibold text-accent hover:underline">
            Back to forum
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading thread…"
      >
        {resource.data ? (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-primary">
                    {resource.data.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {resource.data.author_name ?? "—"} ·{" "}
                    {resource.data.scope_name ?? resource.data.scope_type} ·{" "}
                    {dateTime(resource.data.created_at)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {resource.data.is_resolved ? (
                    <StatusPill status="RESOLVED" tone="success" />
                  ) : null}
                  {resource.data.is_locked ? <StatusPill status="LOCKED" /> : null}
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-foreground">
                {resource.data.body}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <ModerationButton
                  busy={busy}
                  icon={resource.data.is_pinned ? PinOff : Pin}
                  label={resource.data.is_pinned ? "Unpin" : "Pin"}
                  onClick={() =>
                    act(() =>
                      moderateTeacherThread(threadId, resource.data!.is_pinned ? "UNPIN" : "PIN"),
                    )
                  }
                />
                <ModerationButton
                  busy={busy}
                  icon={resource.data.is_locked ? LockOpen : Lock}
                  label={resource.data.is_locked ? "Unlock" : "Lock"}
                  onClick={() =>
                    act(() =>
                      moderateTeacherThread(threadId, resource.data!.is_locked ? "UNLOCK" : "LOCK"),
                    )
                  }
                />
                <ModerationButton
                  busy={busy}
                  icon={CheckCircle2}
                  label={resource.data.is_resolved ? "Reopen" : "Mark resolved"}
                  onClick={() =>
                    act(() =>
                      moderateTeacherThread(
                        threadId,
                        resource.data!.is_resolved ? "REOPEN" : "RESOLVE",
                      ),
                    )
                  }
                />
              </div>
            </Card>

            {resource.data.replies.length ? (
              <ol className="space-y-3">
                {resource.data.replies.map((item) => (
                  <Card
                    key={item.id}
                    className={item.is_accepted_answer ? "border-success" : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">
                          {item.author_name ?? "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {dateTime(item.created_at)}
                        </p>
                      </div>
                      {item.is_accepted_answer ? (
                        <StatusPill status="ACCEPTED" tone="success" label="Accepted answer" />
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(() => acceptTeacherAnswer(threadId, item.id))}
                          className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                        >
                          Accept as answer
                        </button>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
                  </Card>
                ))}
              </ol>
            ) : (
              <EmptyState text="No replies yet." />
            )}

            {error ? (
              <p role="alert" className="text-sm text-destructive-text">
                {error}
              </p>
            ) : null}

            {!resource.data.is_locked ? (
              <Card>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!reply.trim()) return;
                    await act(() => replyToTeacherThread(threadId, reply));
                    setReply("");
                  }}
                  className="space-y-3"
                >
                  <label className={labelClass} htmlFor="thread-reply">
                    Your reply
                  </label>
                  <textarea
                    id="thread-reply"
                    rows={4}
                    className={`${inputClass} h-auto py-2.5`}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={busy || !reply.trim()}
                    className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Posting…" : "Post reply"}
                  </button>
                </form>
              </Card>
            ) : null}
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function ModerationButton({
  busy,
  icon: Icon,
  label,
  onClick,
}: {
  busy: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent disabled:opacity-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
