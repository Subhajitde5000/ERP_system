"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Search, Trash2, Upload } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createTeacherContent,
  deleteTeacherContent,
  fetchTeacherContent,
  fetchTeachingAssignments,
  updateTeacherContent,
  type TeacherContentType,
} from "@/lib/teacher";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

const CONTENT_TYPES: TeacherContentType[] = ["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"];

/** C-TC-17 — the teacher's uploaded notes / videos / slides per subject. */
export function TeacherContentPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ classSubject: "", contentType: "", query: "" });
  const resource = useResource(() => {
    const [subjectId, classId] = filters.classSubject.split(":");
    return fetchTeacherContent({
      subjectId: subjectId || undefined,
      classId: classId || undefined,
      contentType: filters.contentType || undefined,
      query: filters.query || undefined,
      limit: 100,
    });
  }, [filters.classSubject, filters.contentType, filters.query]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        key: `${assignment.subject_id}:${assignment.class_id}`,
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  async function toggleVisibility(itemId: string, visible: boolean) {
    setBusyId(itemId);
    setActionError(null);
    try {
      const updated = await updateTeacherContent(itemId, { is_visible: visible });
      if (resource.data) {
        resource.setData({ ...resource.data, items: resource.data.items.map((item) => (item.id === itemId ? updated : item)) });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update this item.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    setActionError(null);
    try {
      await deleteTeacherContent(itemId);
      if (resource.data) {
        resource.setData({
          ...resource.data,
          total: Math.max(0, resource.data.total - 1),
          items: resource.data.items.filter((item) => item.id !== itemId),
        });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not delete this item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Content library"
        subtitle="Notes, videos and slides you shared with your classes."
        action={
          <Link
            href="/teacher/content/upload"
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Upload className="h-4 w-4" /> Upload content
          </Link>
        }
      />
      <Card className="mb-5 !p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="content-scope" className={labelClass}>Class &amp; subject</label>
            <select id="content-scope" className={inputClass} value={filters.classSubject} onChange={(event) => setFilters({ ...filters, classSubject: event.target.value })}>
              <option value="">All my classes</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="content-type" className={labelClass}>Type</label>
            <select id="content-type" className={inputClass} value={filters.contentType} onChange={(event) => setFilters({ ...filters, contentType: event.target.value })}>
              <option value="">All types</option>
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>{statusLabel(type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="content-query" className={labelClass}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="content-query" type="search" className={`${inputClass} pl-10`} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search titles" />
            </div>
          </div>
        </div>
      </Card>
      {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your content…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="space-y-3">
              {resource.data.items.map((item) => (
                <Card key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">{item.content_type}</span>
                        {!item.is_visible ? (
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">HIDDEN</span>
                        ) : null}
                        {item.chapter ? <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{item.chapter}</span> : null}
                        <span className="text-[11px] text-muted-foreground">{item.subject_code} · {item.class_name}</span>
                      </div>
                      <h2 className="font-display text-base font-bold text-primary">{item.title}</h2>
                      {item.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.view_count} views · {item.download_count} downloads · added {dateTime(item.created_at)}
                        {item.external_url ? (
                          <>
                            {" · "}
                            <a href={item.external_url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                              Open link
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => toggleVisibility(item.id, !item.is_visible)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border px-3 text-xs font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        {item.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {item.is_visible ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => remove(item.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState text="Nothing here yet — upload your first piece of content." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

/** C-TC-18 — upload a file reference or link, tagged by chapter. */
export function TeacherContentUploadPage() {
  const router = useRouter();
  const assignments = useResource(fetchTeachingAssignments, []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    classSubject: "",
    content_type: "PDF" as TeacherContentType,
    file_key: "",
    external_url: "",
    chapter: "",
    tags: "",
    is_visible: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        key: `${assignment.subject_id}:${assignment.class_id}`,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [subjectId, classId] = form.classSubject.split(":");
    if (!subjectId || !classId) {
      setError("Select the class and subject this content belongs to.");
      return;
    }
    if (!form.file_key.trim() && !form.external_url.trim()) {
      setError("Provide a file key or an external link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTeacherContent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject_id: subjectId,
        class_id: classId,
        content_type: form.content_type,
        file_key: form.file_key.trim() || null,
        external_url: form.external_url.trim() || null,
        chapter: form.chapter.trim() || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        is_visible: form.is_visible,
      });
      router.replace("/teacher/content");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Upload content" subtitle="Attach a stored file key or an external link, and tag it by chapter so students can find it." />
      <AsyncState loading={assignments.loading} error={assignments.error} onRetry={assignments.reload} loadingLabel="Loading your teaching scope…">
        <Card>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="upload-title" className={labelClass}>Title</label>
              <input id="upload-title" className={inputClass} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </div>
            <div>
              <label htmlFor="upload-description" className={labelClass}>Description (optional)</label>
              <textarea id="upload-description" className={`${inputClass} min-h-24 py-3`} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="upload-scope" className={labelClass}>Class &amp; subject</label>
                <select id="upload-scope" className={inputClass} value={form.classSubject} onChange={(event) => setForm({ ...form, classSubject: event.target.value })} required>
                  <option value="">Select class and subject</option>
                  {options.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="upload-type" className={labelClass}>Content type</label>
                <select id="upload-type" className={inputClass} value={form.content_type} onChange={(event) => setForm({ ...form, content_type: event.target.value as TeacherContentType })}>
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>{statusLabel(type)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="upload-file-key" className={labelClass}>File key (from storage)</label>
                <input id="upload-file-key" className={inputClass} value={form.file_key} onChange={(event) => setForm({ ...form, file_key: event.target.value })} placeholder="tenant/class/subject/file.pdf" />
              </div>
              <div>
                <label htmlFor="upload-url" className={labelClass}>External link</label>
                <input id="upload-url" type="url" className={inputClass} value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} placeholder="https://…" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Provide at least one of a file key or an external link.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="upload-chapter" className={labelClass}>Chapter (optional)</label>
                <input id="upload-chapter" className={inputClass} maxLength={100} value={form.chapter} onChange={(event) => setForm({ ...form, chapter: event.target.value })} placeholder="Chapter 3 — Trees" />
              </div>
              <div>
                <label htmlFor="upload-tags" className={labelClass}>Tags (comma separated)</label>
                <input id="upload-tags" className={inputClass} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="graphs, bfs, revision" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-primary">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-accent" checked={form.is_visible} onChange={(event) => setForm({ ...form, is_visible: event.target.checked })} />
              Visible to students immediately
            </label>
            {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                <Plus className="h-4 w-4" /> {busy ? "Uploading…" : "Upload content"}
              </button>
              <Link href="/teacher/content" className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      </AsyncState>
    </div>
  );
}
