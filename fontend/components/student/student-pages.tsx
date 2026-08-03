"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, MessageSquare, Pin, Plus, ThumbsUp } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createStudentThread,
  fetchStudentContent,
  fetchStudentFees,
  fetchStudentNotices,
  fetchStudentProfile,
  fetchStudentResult,
  fetchStudentResults,
  fetchStudentThread,
  fetchStudentThreads,
  fetchStudentTimetable,
  markStudentNoticeRead,
  openStudentContent,
  replyToStudentThread,
  updateStudentProfile,
  voteOnStudentDiscussion,
  type StudentFeeAccountView,
  type StudentProfile,
  type StudentResultDetail,
  type StudentThreadDetail,
} from "@/lib/student";
import {
  AsyncState,
  MetricCard,
  StatusPill,
  WeeklyGrid,
  dateOnly,
  dateTime,
} from "@/components/teacher/teacher-ui";

const rupees = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `₹${value.toLocaleString("en-IN")}`;

// ── C-ST-06 timetable ───────────────────────────────────────────────────────

export function StudentTimetablePage() {
  const resource = useResource(fetchStudentTimetable, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My timetable"
        subtitle={
          resource.data
            ? `${resource.data.class_name}${
                resource.data.academic_year ? ` · ${resource.data.academic_year}` : ""
              }`
            : "Your weekly class schedule"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your timetable…"
      >
        {resource.data ? (
          <WeeklyGrid
            slots={resource.data.slots.map((slot) => ({
              id: slot.id,
              day_of_week: slot.day_of_week,
              period_number: slot.period_number,
              start_time: slot.start_time,
              end_time: slot.end_time,
              subject_code: slot.subject_code,
              subject_name: slot.subject_name,
              room_no: slot.room_no,
              slot_type: slot.slot_type,
              // A learner needs the teacher's name, not their own class.
              secondary: slot.teacher_name,
            }))}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

// ── C-ST-13 / C-ST-14 content ───────────────────────────────────────────────

export function StudentContentPage() {
  const [subjectId, setSubjectId] = useState("");
  const [chapter, setChapter] = useState("");
  const load = useCallback(
    () =>
      fetchStudentContent({
        subjectId: subjectId || undefined,
        chapter: chapter || undefined,
      }),
    [subjectId, chapter],
  );
  const resource = useResource(load, [subjectId, chapter]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Content library"
        subtitle="Notes, slides, videos and links your teachers have published."
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="content-subject-filter">
              Subject
            </label>
            <select
              id="content-subject-filter"
              className={inputClass}
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">All subjects</option>
              {(resource.data?.subjects ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="content-chapter-filter">
              Chapter
            </label>
            <select
              id="content-chapter-filter"
              className={inputClass}
              value={chapter}
              onChange={(event) => setChapter(event.target.value)}
            >
              <option value="">All chapters</option>
              {(resource.data?.chapters ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

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
                      {item.subject_code}
                      {item.chapter ? ` · ${item.chapter}` : ""} · {item.content_type.toLowerCase()}
                      {item.uploaded_by_name ? ` · ${item.uploaded_by_name}` : ""}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/student/content/${item.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-accent hover:border-accent"
                  >
                    <FileText className="h-4 w-4" /> Open
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No study material has been published for this filter." />
        )}
      </AsyncState>
    </div>
  );
}

/** C-ST-14 — open one resource; the API counts the view. */
export function StudentContentViewerPage({ contentId }: { contentId: string }) {
  const load = useCallback(() => openStudentContent(contentId), [contentId]);
  const resource = useResource(load, [contentId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Study material"
        subtitle="Open in a new tab, or download for offline study."
        action={
          <Link href="/student/content" className="text-sm font-semibold text-accent hover:underline">
            Back to library
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading resource…"
      >
        {resource.data ? (
          <Card>
            <h2 className="font-display text-lg font-bold text-primary">{resource.data.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {resource.data.subject_code} · {resource.data.subject_name}
              {resource.data.chapter ? ` · ${resource.data.chapter}` : ""}
            </p>
            {resource.data.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                {resource.data.description}
              </p>
            ) : null}
            <dl className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <Field label="Type" value={resource.data.content_type} />
              <Field
                label="Size"
                value={
                  resource.data.file_size_bytes
                    ? `${(resource.data.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                    : "—"
                }
              />
              <Field
                label="Duration"
                value={
                  resource.data.duration_seconds
                    ? `${Math.round(resource.data.duration_seconds / 60)} min`
                    : "—"
                }
              />
            </dl>
            {resource.data.external_url ? (
              <a
                href={resource.data.external_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
              >
                <ExternalLink className="h-4 w-4" /> Open link
              </a>
            ) : (
              <p className="mt-4 rounded-field border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Stored as{" "}
                <code className="font-mono text-foreground">{resource.data.file_key}</code>. Your
                institution serves it through a signed download link.
              </p>
            )}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}

// ── C-ST-15 … C-ST-17 results ───────────────────────────────────────────────

export function StudentResultsPage() {
  const resource = useResource(fetchStudentResults, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My results"
        subtitle="Published results only. A result appears once the Principal has approved it."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading results…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((result) => (
              <Card key={result.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/student/results/${result.id}`}
                      className="font-display text-sm font-bold text-primary hover:text-accent"
                    >
                      {result.publication_title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Published {dateTime(result.published_at)}
                      {result.rank ? ` · rank ${result.rank}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill status={result.result} />
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-primary">
                        {result.percentage}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {result.total_marks_obtained}/{result.total_marks_possible} · {result.grade}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No results have been published for you yet." />
        )}
      </AsyncState>
    </div>
  );
}

/** C-ST-16 / C-ST-17 — the subject breakdown, printable as a grade card. */
export function StudentResultDetailPage({ resultId }: { resultId: string }) {
  const load = useCallback(() => fetchStudentResult(resultId), [resultId]);
  const resource = useResource(load, [resultId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Grade card"
        subtitle="Subject scores, grade and rank."
        action={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent"
          >
            Print / save PDF
          </button>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading grade card…"
      >
        {resource.data ? <GradeCard result={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function GradeCard({ result }: { result: StudentResultDetail }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">
            {result.publication_title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.class_name} · published {dateTime(result.published_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-extrabold text-primary">{result.percentage}%</p>
          <p className="text-sm text-muted-foreground">
            {result.total_marks_obtained}/{result.total_marks_possible} · grade {result.grade}
            {result.rank ? ` · rank ${result.rank}` : ""}
          </p>
          <div className="mt-1.5 flex justify-end">
            <StatusPill status={result.result} />
          </div>
        </div>
      </div>

      {result.subjects.length ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="pb-2">
                Subject
              </th>
              <th scope="col" className="pb-2 text-right">
                Obtained
              </th>
              <th scope="col" className="pb-2 text-right">
                Out of
              </th>
              <th scope="col" className="pb-2 text-right">
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {result.subjects.map((subject, index) => (
              <tr key={index} className="border-b border-border last:border-0">
                <td className="py-2 text-foreground">
                  {subject.subject_code ? `${subject.subject_code} · ` : ""}
                  {subject.subject_name ?? "—"}
                </td>
                <td className="py-2 text-right font-medium text-primary">
                  {subject.marks_obtained ?? "—"}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {subject.marks_possible ?? "—"}
                </td>
                <td className="py-2 text-right font-medium text-primary">
                  {subject.grade ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          A subject-level breakdown was not recorded for this publication.
        </p>
      )}

      {result.remarks ? (
        <p className="mt-4 rounded-field border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {result.remarks}
        </p>
      ) : null}
    </Card>
  );
}

// ── C-ST-18 notices ─────────────────────────────────────────────────────────

export function StudentNoticesPage() {
  const resource = useResource(() => fetchStudentNotices(), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function markRead(id: string) {
    setBusy(id);
    try {
      await markStudentNoticeRead(id);
      await resource.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notice board"
        subtitle="Institution, department and class notices, newest and pinned first."
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
              <Card
                key={notice.id}
                className={notice.is_read ? undefined : "border-accent-border bg-accent-light/30"}
              >
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
                {!notice.is_read ? (
                  <button
                    type="button"
                    disabled={busy === notice.id}
                    onClick={() => markRead(notice.id)}
                    className="mt-3 text-sm font-semibold text-accent hover:underline disabled:opacity-50"
                  >
                    Mark as read
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No notices for your class right now." />
        )}
      </AsyncState>
    </div>
  );
}

// ── C-ST-19 discussion ──────────────────────────────────────────────────────

export function StudentDiscussionPage() {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const load = useCallback(() => fetchStudentThreads({ query: query || undefined }), [query]);
  const resource = useResource(load, [query]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Discussion forum"
        subtitle="Ask a question in your class or a subject, and upvote answers that helped."
        action={
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {composing ? "Cancel" : "Ask a question"}
          </button>
        }
      />

      {composing ? (
        <StudentThreadComposer
          onCreated={() => {
            setComposing(false);
            resource.reload();
          }}
        />
      ) : null}

      <Card className="mb-5">
        <label className={labelClass} htmlFor="student-thread-search">
          Search
        </label>
        <input
          id="student-thread-search"
          className={inputClass}
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
                      href={`/student/discussion/${thread.id}`}
                      className="flex items-center gap-1.5 font-display text-sm font-bold text-primary hover:text-accent"
                    >
                      {thread.is_pinned ? (
                        <Pin className="h-3.5 w-3.5 text-accent" aria-label="Pinned" />
                      ) : null}
                      {thread.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {thread.is_mine ? "You" : (thread.author_name ?? "—")} ·{" "}
                      {thread.scope_name ?? thread.scope_type} · {dateTime(thread.created_at)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {thread.is_resolved ? <StatusPill status="RESOLVED" tone="success" /> : null}
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3.5 w-3.5" /> {thread.upvote_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> {thread.reply_count}
                      </span>
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No one has asked anything yet. Be first." />
        )}
      </AsyncState>
    </div>
  );
}

function StudentThreadComposer({ onCreated }: { onCreated: () => void }) {
  const profile = useResource(fetchStudentDashboardSubjects, []);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createStudentThread({
        title: title.trim(),
        body: text.trim(),
        subject_id: subjectId || null,
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post your question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="student-thread-title">
            Question
          </label>
          <input
            id="student-thread-title"
            className={inputClass}
            required
            minLength={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="student-thread-body">
            Details
          </label>
          <textarea
            id="student-thread-body"
            rows={4}
            required
            className={`${inputClass} h-auto py-2.5`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="student-thread-subject">
            Subject (optional — otherwise posted to your class)
          </label>
          <select
            id="student-thread-subject"
            className={inputClass}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">My class</option>
            {(profile.data ?? []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
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
          {busy ? "Posting…" : "Post question"}
        </button>
      </form>
    </Card>
  );
}

/** The composer only needs the subject list, not the whole dashboard payload. */
async function fetchStudentDashboardSubjects() {
  const { subjects } = await fetchStudentContent({ limit: 1 });
  return subjects;
}

export function StudentThreadDetailPage({ threadId }: { threadId: string }) {
  const load = useCallback(() => fetchStudentThread(threadId), [threadId]);
  const resource = useResource(load, [threadId]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<StudentThreadDetail>) {
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
        subtitle="Read the answers, add your own, and upvote what helped."
        action={
          <Link href="/student/discussion" className="text-sm font-semibold text-accent hover:underline">
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
                    {resource.data.is_mine ? "You" : (resource.data.author_name ?? "—")} ·{" "}
                    {resource.data.scope_name ?? resource.data.scope_type} ·{" "}
                    {dateTime(resource.data.created_at)}
                  </p>
                </div>
                {resource.data.is_resolved ? (
                  <StatusPill status="RESOLVED" tone="success" />
                ) : null}
              </div>
              <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-foreground">
                {resource.data.body}
              </p>
              <VoteButton
                busy={busy}
                count={resource.data.upvote_count}
                active={resource.data.has_upvoted}
                onClick={() => act(() => voteOnStudentDiscussion("THREAD", threadId))}
              />
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
                          {item.is_mine ? "You" : (item.author_name ?? "—")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {dateTime(item.created_at)}
                        </p>
                      </div>
                      {item.is_accepted_answer ? (
                        <StatusPill status="ACCEPTED" tone="success" label="Accepted answer" />
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
                    <VoteButton
                      busy={busy}
                      count={item.upvote_count}
                      active={item.has_upvoted}
                      onClick={() => act(() => voteOnStudentDiscussion("REPLY", item.id))}
                    />
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
                    await act(() => replyToStudentThread(threadId, reply));
                    setReply("");
                  }}
                  className="space-y-3"
                >
                  <label className={labelClass} htmlFor="student-reply">
                    Your reply
                  </label>
                  <textarea
                    id="student-reply"
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
            ) : (
              <Card>
                <p className="text-sm text-muted-foreground">
                  This thread is locked. No further replies can be added.
                </p>
              </Card>
            )}
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function VoteButton({
  busy,
  count,
  active,
  onClick,
}: {
  busy: boolean;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-pressed={active}
      className={`mt-3 inline-flex h-8 items-center gap-1.5 rounded-field border px-2.5 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? "border-accent bg-accent-light text-accent"
          : "border-border bg-white text-muted-foreground hover:border-accent"
      }`}
    >
      <ThumbsUp className="h-3.5 w-3.5" />
      {count}
    </button>
  );
}

// ── C-ST-20 fees ────────────────────────────────────────────────────────────

export function StudentFeesPage() {
  const resource = useResource(fetchStudentFees, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My fee account"
        subtitle="What is paid, what is due, and every receipt on record."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your fee account…"
      >
        {resource.data ? <FeesBody account={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function FeesBody({ account }: { account: StudentFeeAccountView }) {
  if (!account.has_account) {
    return (
      <EmptyState text="No fee account has been created for you. Your institution may not use the finance module." />
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total fee" value={rupees(account.total_fee)} hint={account.academic_year ?? ""} />
        <MetricCard
          label="Concession"
          value={rupees((account.concession_amount ?? 0) + (account.scholarship_amount ?? 0))}
          hint="Concession + scholarship"
        />
        <MetricCard label="Paid" value={rupees(account.total_paid)} tone="success" />
        <MetricCard
          label="Balance due"
          value={rupees(account.balance_due)}
          tone={account.balance_due ? "warning" : "success"}
        />
      </section>

      <Card className="!p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-bold text-primary">Installments</h2>
        </div>
        {account.installments.length ? (
          <ul className="divide-y divide-border">
            {account.installments.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">
                    {item.installment_number}. {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due {dateOnly(item.due_date)}
                    {item.late_fine ? ` · late fine ${rupees(item.late_fine)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={item.is_overdue ? "OVERDUE" : item.status} />
                  <p className="w-28 text-right text-sm font-semibold text-primary">
                    {rupees(item.paid_amount)}
                    <span className="text-muted-foreground"> / {rupees(item.amount)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No installment plan has been set.
          </div>
        )}
      </Card>

      <Card className="!p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-bold text-primary">Payments</h2>
        </div>
        {account.payments.length ? (
          <ul className="divide-y divide-border">
            {account.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">
                    Receipt {payment.receipt_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateOnly(payment.payment_date)} · {payment.payment_mode.toLowerCase()}
                    {payment.transaction_reference ? ` · ${payment.transaction_reference}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold text-success-text">{rupees(payment.amount)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        )}
      </Card>
    </div>
  );
}

// ── C-ST-02 profile ─────────────────────────────────────────────────────────

export function StudentProfilePage() {
  const resource = useResource(fetchStudentProfile, []);
  const [form, setForm] = useState({ phone: "", address: "", avatar_url: "" });
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (resource.data && !seeded) {
    setSeeded(true);
    setForm({
      phone: resource.data.phone ?? "",
      address: resource.data.address ?? "",
      avatar_url: resource.data.avatar_url ?? "",
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      resource.setData(
        await updateStudentProfile({
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
        }),
      );
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="My profile"
        subtitle="Your institution record, plus the contact details you can maintain yourself."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your profile…"
      >
        {resource.data ? (
          <div className="space-y-5">
            <ProfileRecord profile={resource.data} />

            <Card>
              <h2 className="mb-4 font-display text-sm font-bold text-primary">Contact details</h2>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="profile-phone">
                    Phone
                  </label>
                  <input
                    id="profile-phone"
                    className={inputClass}
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-address">
                    Address
                  </label>
                  <textarea
                    id="profile-address"
                    rows={3}
                    className={`${inputClass} h-auto py-2.5`}
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="profile-avatar">
                    Photo URL
                  </label>
                  <input
                    id="profile-avatar"
                    type="url"
                    className={inputClass}
                    value={form.avatar_url}
                    onChange={(event) => setForm({ ...form, avatar_url: event.target.value })}
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive-text">
                    {error}
                  </p>
                ) : null}
                {saved ? <p className="text-sm text-success-text">Saved.</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </form>
              <p className="mt-3 text-xs text-muted-foreground">
                Your name, roll number and class are institution records — ask the office to change
                them.
              </p>
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function ProfileRecord({ profile }: { profile: StudentProfile }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">{profile.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{profile.email ?? "—"}</p>
        </div>
        <StatusPill status={profile.enrollment_status} />
      </div>
      <dl className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
        <Field label="Roll number" value={profile.roll_number ?? "—"} />
        <Field label="Class" value={profile.class_name} />
        <Field label="Department" value={profile.department_name ?? "—"} />
        <Field label="Academic year" value={profile.academic_year ?? "—"} />
        <Field
          label="Enrolled"
          value={profile.enrollment_date ? dateOnly(profile.enrollment_date) : "—"}
        />
        <Field label="Mentor" value={profile.mentor_name ?? "Not assigned"} />
        <Field
          label="Date of birth"
          value={profile.date_of_birth ? dateOnly(profile.date_of_birth) : "—"}
        />
        <Field label="Gender" value={profile.gender ?? "—"} />
        <Field label="Phone" value={profile.phone ?? "—"} />
      </dl>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
