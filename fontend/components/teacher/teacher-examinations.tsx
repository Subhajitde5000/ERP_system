"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createTeacherExam,
  fetchTeacherExam,
  fetchTeacherExams,
  fetchTeachingAssignments,
  publishTeacherExam,
  updateTeacherExam,
  type TeacherExamDetail,
  type TeacherExamRow,
} from "@/lib/teacher";
import { AsyncState, EmptyTable, dateTime, statusLabel } from "@/components/principal/principal-ui";

const STATUS_FILTERS = ["", "DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "RESULTS_RELEASED"] as const;

/** C-TC-07 — every exam this teacher created, filterable by status. */
export function TeacherExamsPage() {
  const [status, setStatus] = useState<string>("");
  const resource = useResource(
    () => fetchTeacherExams({ status: status || undefined, limit: 100 }),
    [status],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Examinations"
        subtitle="Exams you created for your subjects. Drafts stay invisible to students until published."
        action={
          <Link
            href="/teacher/examinations/new"
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" /> Create exam
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option || "ALL"}
            type="button"
            onClick={() => setStatus(option)}
            aria-pressed={status === option}
            className={`h-9 rounded-field border px-4 text-xs font-semibold transition ${
              status === option
                ? "border-accent bg-accent-light text-accent"
                : "border-border text-muted-foreground hover:border-accent hover:text-accent"
            }`}
          >
            {option ? statusLabel(option) : "All"}
          </button>
        ))}
      </div>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your exams…">
        {resource.data ? (
          <Card className="!p-0">
            {resource.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Exam</th>
                      <th className="px-5 py-3">Class · Subject</th>
                      <th className="px-5 py-3">Scheduled</th>
                      <th className="px-5 py-3">Marks</th>
                      <th className="px-5 py-3">Questions</th>
                      <th className="px-5 py-3">Attempts</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resource.data.items.map((exam: TeacherExamRow) => (
                      <tr key={exam.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold text-primary">
                          {exam.title}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {statusLabel(exam.exam_type)} · {exam.mode}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{exam.class_name} · {exam.subject_code}</td>
                        <td className="px-5 py-3 text-muted-foreground">{dateTime(exam.scheduled_at)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{exam.total_marks} (pass {exam.passing_marks})</td>
                        <td className="px-5 py-3 text-muted-foreground">{exam.question_count}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {exam.attempt_count}
                          {exam.pending_grading_count ? (
                            <span className="block text-[11px] font-semibold text-warning-text">{exam.pending_grading_count} to grade</span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${examStatusClass(exam.status)}`}>
                            {statusLabel(exam.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/teacher/examinations/${exam.id}`} className="text-xs font-semibold text-accent hover:underline">
                            {exam.status === "DRAFT" ? "Edit" : "Open"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTable text="No exams here yet. Create your first exam to get started." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}

function examStatusClass(status: string): string {
  if (status === "DRAFT") return "bg-muted text-muted-foreground";
  if (status === "PUBLISHED" || status === "ONGOING") return "bg-accent-light text-accent";
  if (status === "RESULTS_RELEASED") return "bg-success-light text-success-text";
  if (status === "CANCELLED") return "bg-destructive-light text-destructive-text";
  return "bg-warning-light text-warning-text";
}

interface ExamFormState {
  title: string;
  classSubject: string;
  exam_type: string;
  mode: string;
  total_marks: string;
  passing_marks: string;
  duration_minutes: string;
  scheduled_at: string;
  window_end_at: string;
  instructions: string;
  allow_review: boolean;
  show_score_immediately: boolean;
  shuffle_questions: boolean;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** One form powers both the create (C-TC-08) and edit (C-TC-09) pages. */
function ExamForm({
  initial,
  examId,
}: {
  initial: TeacherExamDetail | null;
  examId: string | null;
}) {
  const router = useRouter();
  const assignments = useResource(fetchTeachingAssignments, []);
  const [form, setForm] = useState<ExamFormState>(() => ({
    title: initial?.title ?? "",
    classSubject: initial ? `${initial.subject_id}:${initial.class_id}` : "",
    exam_type: initial?.exam_type ?? "MIXED",
    mode: initial?.mode ?? "ONLINE",
    total_marks: initial ? String(initial.total_marks) : "50",
    passing_marks: initial ? String(initial.passing_marks) : "20",
    duration_minutes: initial ? String(initial.duration_minutes) : "60",
    scheduled_at: initial ? toDatetimeLocal(initial.scheduled_at) : "",
    window_end_at: initial ? toDatetimeLocal(initial.window_end_at) : "",
    instructions: initial?.instructions ?? "",
    allow_review: initial?.allow_review ?? false,
    show_score_immediately: initial?.show_score_immediately ?? false,
    shuffle_questions: initial?.shuffle_questions ?? false,
  }));
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

  const editable = !initial || initial.status === "DRAFT";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [subjectId, classId] = form.classSubject.split(":");
    if (!subjectId || !classId) {
      setError("Select the class and subject for this exam.");
      return;
    }
    if (!form.scheduled_at) {
      setError("Pick when the exam starts.");
      return;
    }
    const total = Number(form.total_marks);
    const passing = Number(form.passing_marks);
    if (passing > total) {
      setError("Passing marks cannot exceed total marks.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = {
        title: form.title.trim(),
        exam_type: form.exam_type as "MCQ" | "DESCRIPTIVE" | "MIXED" | "QUIZ",
        mode: form.mode as "ONLINE" | "OFFLINE",
        total_marks: total,
        passing_marks: passing,
        duration_minutes: Number(form.duration_minutes),
        instructions: form.instructions.trim() || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        window_end_at: form.window_end_at ? new Date(form.window_end_at).toISOString() : null,
        allow_review: form.allow_review,
        show_score_immediately: form.show_score_immediately,
        shuffle_questions: form.shuffle_questions,
      };
      if (examId) {
        await updateTeacherExam(examId, base);
        router.replace(`/teacher/examinations/${examId}`);
        router.refresh();
      } else {
        const created = await createTeacherExam({ ...base, subject_id: subjectId, class_id: classId });
        router.replace(`/teacher/examinations/${created.id}/questions`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this exam.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AsyncState loading={assignments.loading} error={assignments.error} onRetry={assignments.reload} loadingLabel="Loading your teaching scope…">
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="exam-title" className={labelClass}>Exam title</label>
            <input id="exam-title" className={inputClass} maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required disabled={!editable} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exam-class-subject" className={labelClass}>Class &amp; subject</label>
              <select
                id="exam-class-subject"
                className={inputClass}
                value={form.classSubject}
                onChange={(event) => setForm({ ...form, classSubject: event.target.value })}
                required
                disabled={!!examId || !editable}
              >
                <option value="">Select class and subject</option>
                {options.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              {examId ? <p className="mt-1 text-[11px] text-muted-foreground">Class and subject are fixed once the exam is created.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="exam-type" className={labelClass}>Type</label>
                <select id="exam-type" className={inputClass} value={form.exam_type} onChange={(event) => setForm({ ...form, exam_type: event.target.value })} disabled={!editable}>
                  <option value="MCQ">MCQ</option>
                  <option value="DESCRIPTIVE">Descriptive</option>
                  <option value="MIXED">Mixed</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </div>
              <div>
                <label htmlFor="exam-mode" className={labelClass}>Mode</label>
                <select id="exam-mode" className={inputClass} value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })} disabled={!editable}>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="exam-total" className={labelClass}>Total marks</label>
              <input id="exam-total" type="number" min={1} max={1000} className={inputClass} value={form.total_marks} onChange={(event) => setForm({ ...form, total_marks: event.target.value })} required disabled={!editable} />
            </div>
            <div>
              <label htmlFor="exam-passing" className={labelClass}>Passing marks</label>
              <input id="exam-passing" type="number" min={0} max={1000} className={inputClass} value={form.passing_marks} onChange={(event) => setForm({ ...form, passing_marks: event.target.value })} required disabled={!editable} />
            </div>
            <div>
              <label htmlFor="exam-duration" className={labelClass}>Duration (minutes)</label>
              <input id="exam-duration" type="number" min={5} max={600} className={inputClass} value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} required disabled={!editable} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="exam-scheduled" className={labelClass}>Starts at</label>
              <input id="exam-scheduled" type="datetime-local" className={inputClass} value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} required disabled={!editable} />
            </div>
            <div>
              <label htmlFor="exam-window-end" className={labelClass}>Window ends (optional)</label>
              <input id="exam-window-end" type="datetime-local" className={inputClass} value={form.window_end_at} onChange={(event) => setForm({ ...form, window_end_at: event.target.value })} disabled={!editable} />
            </div>
          </div>
          <div>
            <label htmlFor="exam-instructions" className={labelClass}>Instructions (optional)</label>
            <textarea id="exam-instructions" className={`${inputClass} min-h-28 py-3`} maxLength={20000} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} disabled={!editable} />
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-medium text-primary">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-accent" checked={form.allow_review} onChange={(event) => setForm({ ...form, allow_review: event.target.checked })} disabled={!editable} />
              Allow answer review
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-primary">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-accent" checked={form.show_score_immediately} onChange={(event) => setForm({ ...form, show_score_immediately: event.target.checked })} disabled={!editable} />
              Show score immediately
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-primary">
              <input type="checkbox" className="h-4 w-4 rounded border-border accent-accent" checked={form.shuffle_questions} onChange={(event) => setForm({ ...form, shuffle_questions: event.target.checked })} disabled={!editable} />
              Shuffle questions
            </label>
          </fieldset>
          {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
          {editable ? (
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                {busy ? "Saving…" : examId ? "Save changes" : "Create exam & add questions"}
              </button>
              <Link href={examId ? `/teacher/examinations/${examId}` : "/teacher/examinations"} className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
                Cancel
              </Link>
            </div>
          ) : null}
        </form>
      </Card>
    </AsyncState>
  );
}

/** C-TC-08 — create exam. */
export function TeacherCreateExamPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create exam" subtitle="Draft first — publish only after the questions are in place." />
      <ExamForm initial={null} examId={null} />
    </div>
  );
}

/** C-TC-09 — exam detail: edit draft, publish, jump to questions & results. */
export function TeacherExamDetailPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const resource = useResource(() => fetchTeacherExam(examId), [examId]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await publishTeacherExam(examId);
      if (resource.data) resource.setData({ ...resource.data, ...updated });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not publish this exam.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={resource.data ? resource.data.title : "Exam"}
        subtitle="Edit the draft, manage its questions, then publish. Attempts and grading live under Results."
        action={
          resource.data ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/teacher/examinations/${examId}/questions`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
                Questions ({resource.data.question_count})
              </Link>
              <Link href={`/teacher/examinations/${examId}/results`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
                Results
              </Link>
              {resource.data.status === "DRAFT" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={publish}
                  className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> {busy ? "Publishing…" : "Publish"}
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading exam…">
        {resource.data ? <ExamForm initial={resource.data} examId={examId} key={`${resource.data.id}:${resource.data.status}`} /> : null}
      </AsyncState>
    </div>
  );
}
