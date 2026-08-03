"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createTeacherContent,
  deleteTeacherContent,
  fetchTeacherContent,
  fetchTeacherMarkContext,
  updateTeacherContent,
  type ContentType,
  type TeacherContentRow,
} from "@/lib/teacher";
import { AsyncState, StatusPill, dateOnly } from "@/components/teacher/teacher-ui";

/** C-TC-17 — the notes, slides and links this teacher has published. */
export function TeacherContentPage() {
  const [subjectId, setSubjectId] = useState("");
  const load = useCallback(
    () => fetchTeacherContent({ subjectId: subjectId || undefined }),
    [subjectId],
  );
  const resource = useResource(load, [subjectId]);
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleVisible(item: TeacherContentRow) {
    setBusy(item.id);
    setError(null);
    try {
      await updateTeacherContent(item.id, { is_visible: !item.is_visible });
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the resource.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: TeacherContentRow) {
    setBusy(item.id);
    setError(null);
    try {
      await deleteTeacherContent(item.id);
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the resource.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Content library"
        subtitle="Notes, slides, videos and links for your subjects."
        action={
          <Link
            href="/teacher/content/upload"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Add resource
          </Link>
        }
      />

      <Card className="mb-5">
        <label className={labelClass} htmlFor="content-subject">
          Subject
        </label>
        <select
          id="content-subject"
          className={`${inputClass} sm:max-w-md`}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          <option value="">All my subjects</option>
          {(context.data?.subjects ?? []).map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.class_name} · {subject.code} · {subject.name}
            </option>
          ))}
        </select>
      </Card>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading content…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold text-primary">{item.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {item.class_name} · {item.subject_code}
                      {item.chapter ? ` · ${item.chapter}` : ""} · {item.content_type.toLowerCase()}
                    </p>
                    {item.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {dateOnly(item.created_at)} · {item.view_count} views
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill
                      status={item.is_visible ? "VISIBLE" : "HIDDEN"}
                      tone={item.is_visible ? "success" : "default"}
                    />
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => toggleVisible(item)}
                      aria-label={item.is_visible ? "Hide from students" : "Show to students"}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {item.is_visible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => remove(item)}
                      aria-label={`Remove ${item.title}`}
                      className="rounded p-1.5 text-destructive-text hover:bg-destructive-light disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="You have not published any content for this subject yet." />
        )}
      </AsyncState>
    </div>
  );
}

const CONTENT_TYPES: ContentType[] = ["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"];

/**
 * C-TC-18 — publish a resource.
 *
 * The form takes a storage key or an external URL rather than performing the
 * upload itself: `ARCHITECTURE.md` §11 puts files on S3 behind a presigned
 * PUT, so the browser uploads directly and only the resulting key reaches the
 * API. Wiring the binary through the API would double the egress bill and put
 * a 200 MB video through the request pipeline.
 */
export function TeacherContentUploadPage() {
  const router = useRouter();
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject_id: "",
    content_type: "PDF" as ContentType,
    file_key: "",
    external_url: "",
    chapter: "",
    is_visible: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLink = form.content_type === "LINK";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTeacherContent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject_id: form.subject_id,
        content_type: form.content_type,
        file_key: isLink ? null : form.file_key.trim(),
        external_url: isLink ? form.external_url.trim() : null,
        chapter: form.chapter.trim() || null,
        is_visible: form.is_visible,
      });
      router.push("/teacher/content");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish the resource.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add a resource"
        subtitle="Tag it by chapter so students can browse subject → chapter → type."
      />
      <AsyncState
        loading={context.loading}
        error={context.error}
        onRetry={context.reload}
        loadingLabel="Loading your subjects…"
      >
        <form onSubmit={submit} className="space-y-5">
          <Card className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="content-title">
                Title
              </label>
              <input
                id="content-title"
                className={inputClass}
                required
                minLength={2}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="content-subject-select">
                  Subject
                </label>
                <select
                  id="content-subject-select"
                  className={inputClass}
                  required
                  value={form.subject_id}
                  onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
                >
                  <option value="">Select subject</option>
                  {(context.data?.subjects ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.class_name} · {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="content-type">
                  Type
                </label>
                <select
                  id="content-type"
                  className={inputClass}
                  value={form.content_type}
                  onChange={(event) =>
                    setForm({ ...form, content_type: event.target.value as ContentType })
                  }
                >
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLink ? (
              <div>
                <label className={labelClass} htmlFor="content-url">
                  External URL
                </label>
                <input
                  id="content-url"
                  type="url"
                  required
                  className={inputClass}
                  placeholder="https://…"
                  value={form.external_url}
                  onChange={(event) => setForm({ ...form, external_url: event.target.value })}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="content-key">
                  File key
                </label>
                <input
                  id="content-key"
                  required
                  className={inputClass}
                  placeholder="uploads/cs201/week-3-notes.pdf"
                  value={form.file_key}
                  onChange={(event) => setForm({ ...form, file_key: event.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload the file to storage first, then paste its key here.
                </p>
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="content-chapter">
                Chapter (optional)
              </label>
              <input
                id="content-chapter"
                className={inputClass}
                value={form.chapter}
                onChange={(event) => setForm({ ...form, chapter: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="content-description">
                Description (optional)
              </label>
              <textarea
                id="content-description"
                rows={3}
                className={`${inputClass} h-auto py-2.5`}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.is_visible}
                onChange={(event) => setForm({ ...form, is_visible: event.target.checked })}
                className="h-4 w-4 rounded border-border text-accent"
              />
              Visible to students straight away
            </label>
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
            {busy ? "Publishing…" : "Publish resource"}
          </button>
        </form>
      </AsyncState>
    </div>
  );
}
