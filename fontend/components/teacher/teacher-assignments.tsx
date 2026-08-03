"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createTeacherAssignment,
  fetchTeacherAssignment,
  fetchTeacherAssignments,
  fetchTeacherMarkContext,
  fetchTeacherSubmissions,
  updateTeacherAssignment,
  type TeacherAssignmentDetail,
  type TeacherAssignmentRow,
  type TeacherSubmissionBoard,
} from "@/lib/teacher";
import {
  AsyncState,
  MetricCard,
  StatusPill,
  dateTime,
  percent,
} from "@/components/teacher/teacher-ui";

/** C-TC-12 — every assignment this teacher authored. */
export function TeacherAssignmentsPage() {
  const [status, setStatus] = useState("");
  const load = useCallback(
    () => fetchTeacherAssignments({ status: status || undefined }),
    [status],
  );
  const resource = useResource(load, [status]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Assignments"
        subtitle="Coursework you have set, with the review queue for each."
        action={
          <Link
            href="/teacher/assignments/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Create assignment
          </Link>
        }
      />

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading assignments…"
      >
        {resource.data ? (
          <>
            <section className="mb-5 grid gap-4 sm:grid-cols-3">
              <MetricCard label="Active" value={resource.data.active_count} tone="default" />
              <MetricCard
                label="Awaiting review"
                value={resource.data.pending_review_count}
                tone={resource.data.pending_review_count ? "warning" : "success"}
              />
              <MetricCard
                label="Overdue"
                value={resource.data.overdue_count}
                tone={resource.data.overdue_count ? "danger" : "success"}
              />
            </section>

            <Card className="mb-5">
              <label className={labelClass} htmlFor="assignment-status">
                Status
              </label>
              <select
                id="assignment-status"
                className={`${inputClass} sm:max-w-xs`}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="CLOSED">Closed</option>
              </select>
            </Card>

            {resource.data.items.length ? (
              <div className="space-y-3">
                {resource.data.items.map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
              </div>
            ) : (
              <EmptyState text="No assignments match this filter." />
            )}
          </>
        ) : null}
      </AsyncState>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: TeacherAssignmentRow }) {
  const submittedPct = assignment.class_strength
    ? (assignment.submission_count * 100) / assignment.class_strength
    : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/teacher/assignments/${assignment.id}`}
            className="font-display text-base font-bold text-primary hover:text-accent"
          >
            {assignment.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {assignment.class_name} · {assignment.subject_code} ·{" "}
            {assignment.assignment_type.toLowerCase()} · {assignment.total_marks} marks
          </p>
          <time
            className={`mt-1 block text-[11px] font-medium ${
              assignment.is_overdue ? "text-destructive-text" : "text-accent"
            }`}
          >
            Due {dateTime(assignment.due_date)}
            {assignment.is_overdue ? " · overdue" : ""}
          </time>
        </div>
        <StatusPill status={assignment.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Stat label="Class size" value={assignment.class_strength} />
        <Stat
          label="Submitted"
          value={`${assignment.submission_count}${
            submittedPct !== null ? ` (${percent(submittedPct)})` : ""
          }`}
        />
        <Stat
          label="To review"
          value={assignment.pending_review_count}
          tone={assignment.pending_review_count ? "warning" : "default"}
        />
        <Stat label="Approved" value={assignment.approved_count} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-sm font-semibold">
        <Link href={`/teacher/assignments/${assignment.id}`} className="text-accent hover:underline">
          Edit
        </Link>
        <Link
          href={`/teacher/assignments/${assignment.id}/submissions`}
          className="text-accent hover:underline"
        >
          Review submissions
        </Link>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 font-display text-base font-bold ${
          tone === "warning" && value ? "text-warning-text" : "text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

interface MilestoneDraft {
  title: string;
  description: string;
  marks: string;
  due_date: string;
}

/** C-TC-13 — create an assignment, optionally as a milestone project. */
export function TeacherAssignmentFormPage() {
  const router = useRouter();
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject_id: "",
    assignment_type: "REGULAR",
    total_marks: "100",
    passing_marks: "40",
    due_date: "",
    allow_late_submission: false,
    late_penalty_percent: "0",
    max_file_size_mb: "10",
    allowed_file_types: "pdf, docx, zip",
    publish: true,
  });
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMilestone = form.assignment_type === "MILESTONE";
  const allocated = milestones.reduce((total, item) => total + Number(item.marks || 0), 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createTeacherAssignment({
        title: form.title.trim(),
        description: form.description.trim(),
        subject_id: form.subject_id,
        assignment_type: form.assignment_type,
        total_marks: Number(form.total_marks),
        passing_marks: Number(form.passing_marks),
        due_date: new Date(form.due_date).toISOString(),
        allow_late_submission: form.allow_late_submission,
        late_penalty_percent: Number(form.late_penalty_percent),
        max_file_size_mb: Number(form.max_file_size_mb),
        allowed_file_types: form.allowed_file_types
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        publish: form.publish,
        milestones: isMilestone
          ? milestones.map((item) => ({
              title: item.title.trim(),
              description: item.description.trim() || null,
              marks: Number(item.marks),
              due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
            }))
          : [],
      });
      router.push(`/teacher/assignments/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the assignment.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Create assignment"
        subtitle="Set the brief, the due date and the late-submission policy."
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
              <label className={labelClass} htmlFor="assignment-title">
                Title
              </label>
              <input
                id="assignment-title"
                className={inputClass}
                required
                minLength={3}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="assignment-description">
                Brief
              </label>
              <textarea
                id="assignment-description"
                rows={5}
                required
                className={`${inputClass} h-auto py-2.5`}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="assignment-subject">
                  Subject
                </label>
                <select
                  id="assignment-subject"
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
                <label className={labelClass} htmlFor="assignment-type">
                  Type
                </label>
                <select
                  id="assignment-type"
                  className={inputClass}
                  value={form.assignment_type}
                  onChange={(event) =>
                    setForm({ ...form, assignment_type: event.target.value })
                  }
                >
                  <option value="REGULAR">Regular</option>
                  <option value="MILESTONE">Milestone project</option>
                  <option value="GROUP">Group</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="assignment-total">
                  Total marks
                </label>
                <input
                  id="assignment-total"
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.total_marks}
                  onChange={(event) => setForm({ ...form, total_marks: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="assignment-pass">
                  Passing marks
                </label>
                <input
                  id="assignment-pass"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.passing_marks}
                  onChange={(event) => setForm({ ...form, passing_marks: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="assignment-due">
                  Due date
                </label>
                <input
                  id="assignment-due"
                  type="datetime-local"
                  required
                  className={inputClass}
                  value={form.due_date}
                  onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display text-sm font-bold text-primary">Submission policy</h2>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.allow_late_submission}
                onChange={(event) =>
                  setForm({ ...form, allow_late_submission: event.target.checked })
                }
                className="h-4 w-4 rounded border-border text-accent"
              />
              Accept submissions after the due date
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="assignment-penalty">
                  Late penalty (%)
                </label>
                <input
                  id="assignment-penalty"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!form.allow_late_submission}
                  className={inputClass}
                  value={form.late_penalty_percent}
                  onChange={(event) =>
                    setForm({ ...form, late_penalty_percent: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="assignment-size">
                  Max file size (MB)
                </label>
                <input
                  id="assignment-size"
                  type="number"
                  min={1}
                  max={200}
                  className={inputClass}
                  value={form.max_file_size_mb}
                  onChange={(event) =>
                    setForm({ ...form, max_file_size_mb: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="assignment-types">
                  Allowed file types
                </label>
                <input
                  id="assignment-types"
                  className={inputClass}
                  value={form.allowed_file_types}
                  onChange={(event) =>
                    setForm({ ...form, allowed_file_types: event.target.value })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(event) => setForm({ ...form, publish: event.target.checked })}
                className="h-4 w-4 rounded border-border text-accent"
              />
              Publish immediately (otherwise saved as a draft)
            </label>
          </Card>

          {isMilestone ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-bold text-primary">Milestones</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Stages unlock in order; marks must add up to {form.total_marks}.
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    allocated === Number(form.total_marks)
                      ? "text-success-text"
                      : "text-warning-text"
                  }`}
                >
                  {allocated} / {form.total_marks}
                </p>
              </div>
              {milestones.map((milestone, index) => (
                <div key={index} className="rounded-field border border-border p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_6rem_11rem_2.5rem]">
                    <input
                      className={inputClass}
                      placeholder={`Stage ${index + 1} title`}
                      value={milestone.title}
                      aria-label={`Milestone ${index + 1} title`}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, position) =>
                            position === index ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      placeholder="Marks"
                      aria-label={`Milestone ${index + 1} marks`}
                      value={milestone.marks}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, position) =>
                            position === index ? { ...item, marks: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      className={inputClass}
                      type="datetime-local"
                      aria-label={`Milestone ${index + 1} due date`}
                      value={milestone.due_date}
                      onChange={(event) =>
                        setMilestones((current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, due_date: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={`Remove milestone ${index + 1}`}
                      onClick={() =>
                        setMilestones((current) =>
                          current.filter((_item, position) => position !== index),
                        )
                      }
                      className="flex h-11 items-center justify-center rounded-field text-destructive-text hover:bg-destructive-light"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setMilestones((current) => [
                    ...current,
                    { title: "", description: "", marks: "", due_date: "" },
                  ])
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground hover:border-accent"
              >
                <Plus className="h-4 w-4" /> Add milestone
              </button>
            </Card>
          ) : null}

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
            {busy ? "Creating…" : "Create assignment"}
          </button>
        </form>
      </AsyncState>
    </div>
  );
}

/** C-TC-14 — the brief, its milestones and the status controls. */
export function TeacherAssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const load = useCallback(() => fetchTeacherAssignment(assignmentId), [assignmentId]);
  const resource = useResource(load, [assignmentId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: "DRAFT" | "PUBLISHED" | "CLOSED") {
    setBusy(true);
    setError(null);
    try {
      resource.setData(await updateTeacherAssignment(assignmentId, { status }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Assignment"
        subtitle="The brief students see, and the stages they must clear in order."
        action={
          <Link
            href={`/teacher/assignments/${assignmentId}/submissions`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Review submissions
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading assignment…"
      >
        {resource.data ? (
          <AssignmentBody
            assignment={resource.data}
            busy={busy}
            error={error}
            onStatus={setStatus}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

function AssignmentBody({
  assignment,
  busy,
  error,
  onStatus,
}: {
  assignment: TeacherAssignmentDetail;
  busy: boolean;
  error: string | null;
  onStatus: (status: "DRAFT" | "PUBLISHED" | "CLOSED") => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-primary">{assignment.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {assignment.class_name} · {assignment.subject_code} · {assignment.total_marks} marks
            </p>
            <time className="mt-1 block text-xs font-medium text-accent">
              Due {dateTime(assignment.due_date)}
            </time>
          </div>
          <StatusPill status={assignment.status} />
        </div>
        <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-foreground">
          {assignment.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Accepts {assignment.allowed_file_types.join(", ") || "any"} up to{" "}
          {assignment.max_file_size_mb} MB ·{" "}
          {assignment.allow_late_submission
            ? `late submissions allowed with a ${assignment.late_penalty_percent}% penalty`
            : "no late submissions"}
        </p>
      </Card>

      {assignment.milestones.length ? (
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold text-primary">Milestones</h3>
          <ol className="space-y-2">
            {assignment.milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {milestone.sort_order}. {milestone.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {milestone.marks} marks
                    {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {milestone.submitted_count} submitted · {milestone.approved_count} approved
                </p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <Card>
        <h3 className="mb-3 font-display text-sm font-bold text-primary">Status</h3>
        <div className="flex flex-wrap gap-2">
          {(["DRAFT", "PUBLISHED", "CLOSED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy || assignment.status === status}
              onClick={() => onStatus(status)}
              className={`h-9 rounded-field border px-3 text-sm font-semibold transition disabled:opacity-50 ${
                assignment.status === status
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-white text-foreground hover:border-accent"
              }`}
            >
              {status[0] + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** C-TC-15 — the submission board for one assignment. */
export function TeacherSubmissionsPage({ assignmentId }: { assignmentId: string }) {
  const load = useCallback(() => fetchTeacherSubmissions(assignmentId), [assignmentId]);
  const resource = useResource(load, [assignmentId]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Submissions"
        subtitle="Open one to read the work, score it and send feedback."
        action={
          <Link
            href={`/teacher/assignments/${assignmentId}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Assignment brief
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading submissions…"
      >
        {resource.data ? <SubmissionBoard board={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function SubmissionBoard({ board }: { board: TeacherSubmissionBoard }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Class size" value={board.assignment.class_strength} />
        <MetricCard
          label="Submitted"
          value={board.submissions.length}
          hint={`${board.not_submitted.length} still to hand in`}
        />
        <MetricCard
          label="Awaiting review"
          value={board.assignment.pending_review_count}
          tone={board.assignment.pending_review_count ? "warning" : "success"}
        />
      </section>

      <Card className="!p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-bold text-primary">Received</h2>
        </div>
        {board.submissions.length ? (
          <ul className="divide-y divide-border">
            {board.submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/teacher/submissions/${submission.id}`}
                    className="text-sm font-semibold text-primary hover:text-accent"
                  >
                    {submission.student_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {submission.roll_number ?? "—"}
                    {submission.milestone_title ? ` · ${submission.milestone_title}` : ""} ·{" "}
                    {dateTime(submission.submitted_at)}
                    {submission.version > 1 ? ` · v${submission.version}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {submission.is_late ? <StatusPill status="LATE" tone="warning" /> : null}
                  <StatusPill status={submission.status} />
                  <p className="w-16 text-right text-sm font-semibold text-primary">
                    {submission.score === null
                      ? "—"
                      : `${submission.score}/${board.assignment.total_marks}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No submissions yet.
          </div>
        )}
      </Card>

      {board.not_submitted.length ? (
        <Card className="border-warning-border">
          <h2 className="font-display text-sm font-bold text-primary">Not submitted</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {board.not_submitted.map((student) => (
              <li
                key={student.student_id}
                className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-semibold text-warning-text"
              >
                {student.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
