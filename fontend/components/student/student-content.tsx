"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, ExternalLink, Eye, Link2, PlayCircle, Search } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchDiscussionScopes,
  fetchStudentContent,
  fetchStudentContentItem,
} from "@/lib/student";
import { AsyncState, dateTime, statusLabel } from "@/components/principal/principal-ui";

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  PDF: BookOpen,
  VIDEO: PlayCircle,
  SLIDE: BookOpen,
  LINK: Link2,
  IMAGE: Eye,
  AUDIO: PlayCircle,
  ZIP: BookOpen,
};

/** C-ST-13 — browse content for the student's class, filtered by subject/chapter. */
export function StudentContentPage() {
  const scopes = useResource(fetchDiscussionScopes, []);
  const subjects = useMemo(
    () => (scopes.data ?? []).filter((scope) => scope.scope_type === "SUBJECT"),
    [scopes.data],
  );
  const [filters, setFilters] = useState({ subjectId: "", chapter: "", contentType: "", query: "" });
  const resource = useResource(
    () =>
      fetchStudentContent({
        subjectId: filters.subjectId || undefined,
        chapter: filters.chapter || undefined,
        contentType: filters.contentType || undefined,
        query: filters.query || undefined,
        limit: 100,
      }),
    [filters.subjectId, filters.chapter, filters.contentType, filters.query],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Content library" subtitle="Notes, videos and slides your teachers published for your class." />
      <Card className="mb-5 !p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="library-subject" className={labelClass}>Subject</label>
            <select id="library-subject" className={inputClass} value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value, chapter: "" })}>
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.scope_id} value={subject.scope_id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-chapter" className={labelClass}>Chapter</label>
            <select id="library-chapter" className={inputClass} value={filters.chapter} onChange={(event) => setFilters({ ...filters, chapter: event.target.value })}>
              <option value="">All chapters</option>
              {(resource.data?.chapters ?? []).map((chapter) => (
                <option key={chapter} value={chapter}>{chapter}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-type" className={labelClass}>Type</label>
            <select id="library-type" className={inputClass} value={filters.contentType} onChange={(event) => setFilters({ ...filters, contentType: event.target.value })}>
              <option value="">All types</option>
              {["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"].map((type) => (
                <option key={type} value={type}>{statusLabel(type)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="library-query" className={labelClass}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="library-query" type="search" className={`${inputClass} pl-10`} value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search titles" />
            </div>
          </div>
        </div>
      </Card>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the library…">
        {resource.data ? (
          resource.data.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resource.data.items.map((item) => {
                const Icon = TYPE_ICONS[item.content_type] ?? BookOpen;
                return (
                  <Link key={item.id} href={`/student/content/${item.id}`}>
                    <Card className="flex h-full flex-col transition hover:border-accent">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">{item.content_type}</span>
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <h2 className="font-display text-base font-bold text-primary">{item.title}</h2>
                      {item.description ? <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{item.description}</p> : null}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {item.subject_code}
                        {item.chapter ? ` · ${item.chapter}` : ""} · {item.uploader_name ?? "Teacher"}
                      </p>
                      {item.tags.length ? (
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">#{tag}</span>
                          ))}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState text="No content matches these filters yet." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </div>
  );
}

/** C-ST-14 — inline viewer (video/image) or open/download for the rest. View is logged server-side. */
export function StudentContentPlayerPage() {
  const params = useParams<{ id?: string }>();
  const contentId = params?.id ?? "";
  const resource = useResource(
    () => (contentId ? fetchStudentContentItem(contentId) : Promise.reject(new Error("No content ID provided"))),
    [contentId],
  );
  const item = resource.data;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={item ? item.title : "Content"} subtitle="Your views are logged for your teacher." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading content…">
        {item ? (
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-bold text-accent">{item.content_type}</span>
              {item.chapter ? <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{item.chapter}</span> : null}
            </div>
            {item.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p> : null}
            <div className="mt-4">
              {item.content_type === "VIDEO" && item.external_url ? (
                <video controls className="w-full rounded-card border border-border" src={item.external_url}>
                  Your browser does not support video playback.
                </video>
              ) : item.content_type === "AUDIO" && item.external_url ? (
                <audio controls className="w-full" src={item.external_url}>
                  Your browser does not support audio playback.
                </audio>
              ) : item.content_type === "IMAGE" && item.external_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.external_url} alt={item.title} className="w-full rounded-card border border-border" />
              ) : item.external_url ? (
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
                >
                  <ExternalLink className="h-4 w-4" /> Open {item.content_type === "LINK" ? "link" : "file"}
                </a>
              ) : (
                <p className="rounded-field border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                  Stored file: <span className="font-mono text-xs">{item.file_key}</span> — download will appear here once downloads are enabled.
                </p>
              )}
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-muted-foreground">Subject</dt>
                <dd className="font-medium text-primary">{item.subject_code} · {item.subject_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-muted-foreground">Shared by</dt>
                <dd className="font-medium text-primary">{item.uploader_name ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-muted-foreground">Added</dt>
                <dd className="font-medium text-primary">{dateTime(item.created_at)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium text-muted-foreground">Views</dt>
                <dd className="font-medium text-primary">{item.view_count}</dd>
              </div>
              {item.duration_seconds ? (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 font-medium text-muted-foreground">Duration</dt>
                  <dd className="font-medium text-primary">{Math.round(item.duration_seconds / 60)} min</dd>
                </div>
              ) : null}
              {item.file_size_bytes ? (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 font-medium text-muted-foreground">Size</dt>
                  <dd className="font-medium text-primary">{(item.file_size_bytes / (1024 * 1024)).toFixed(2)} MB</dd>
                </div>
              ) : null}
            </dl>
            {item.tags.length ? (
              <p className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">#{tag}</span>
                ))}
              </p>
            ) : null}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}
