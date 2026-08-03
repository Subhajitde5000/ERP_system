"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin, Plus } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { createTeacherNotice, fetchTeacherMarkContext, fetchTeacherNotices } from "@/lib/teacher";
import { AsyncState, StatusPill, dateTime } from "@/components/teacher/teacher-ui";

/** C-TC-19 — the notice feed that actually reaches this teacher's rooms. */
export function TeacherNoticesPage() {
  const resource = useResource(() => fetchTeacherNotices(), []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Notice board"
        subtitle="Institution notices plus the department and class notices for your rooms."
        action={
          <Link
            href="/teacher/notices/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Post notice
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading notices…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((notice) => (
              <Card key={notice.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-primary">
                      {notice.is_pinned ? (
                        <Pin className="h-3.5 w-3.5 text-accent" aria-label="Pinned" />
                      ) : null}
                      {notice.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {notice.author_name ?? "Institution"} · {dateTime(notice.published_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <StatusPill status={notice.target_scope} tone="default" />
                    {notice.priority !== "NORMAL" ? (
                      <StatusPill
                        status={notice.priority}
                        tone={notice.priority === "URGENT" ? "danger" : "warning"}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{notice.body}</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No notices reach your classes right now." />
        )}
      </AsyncState>
    </div>
  );
}

/**
 * C-TC-20 — post a notice to one of the teacher's own classes.
 *
 * There is no scope selector: §4.5 grants "post to assigned classes" and
 * nothing wider, so the only choice is *which* class. Pinning is absent for
 * the same reason — a class notice must not outrank the Principal's.
 */
export function TeacherNoticeComposerPage() {
  const router = useRouter();
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const [form, setForm] = useState({
    title: "",
    body: "",
    class_id: "",
    priority: "NORMAL" as "NORMAL" | "IMPORTANT" | "URGENT",
    expires_at: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTeacherNotice({
        title: form.title.trim(),
        body: form.body.trim(),
        class_id: form.class_id,
        priority: form.priority,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      });
      router.push("/teacher/notices");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post the notice.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Post a notice"
        subtitle="Notices you post are scoped to one of your own classes."
      />
      <AsyncState
        loading={context.loading}
        error={context.error}
        onRetry={context.reload}
        loadingLabel="Loading your classes…"
      >
        <form onSubmit={submit} className="space-y-5">
          <Card className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="notice-title">
                Title
              </label>
              <input
                id="notice-title"
                className={inputClass}
                required
                minLength={3}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="notice-body">
                Message
              </label>
              <textarea
                id="notice-body"
                rows={6}
                required
                className={`${inputClass} h-auto py-2.5`}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="notice-class">
                  Class
                </label>
                <select
                  id="notice-class"
                  className={inputClass}
                  required
                  value={form.class_id}
                  onChange={(event) => setForm({ ...form, class_id: event.target.value })}
                >
                  <option value="">Select class</option>
                  {(context.data?.classes ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="notice-priority">
                  Priority
                </label>
                <select
                  id="notice-priority"
                  className={inputClass}
                  value={form.priority}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority: event.target.value as "NORMAL" | "IMPORTANT" | "URGENT",
                    })
                  }
                >
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="notice-expiry">
                  Expires (optional)
                </label>
                <input
                  id="notice-expiry"
                  type="datetime-local"
                  className={inputClass}
                  value={form.expires_at}
                  onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
                />
              </div>
            </div>
          </Card>

          {error ? (
            <p role="alert" className="text-sm text-destructive-text">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Posting…" : "Post notice"}
          </button>
        </form>
      </AsyncState>
    </div>
  );
}
