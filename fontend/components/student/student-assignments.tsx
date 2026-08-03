"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Lock, Paperclip, Plus, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchStudentAssignment,
  fetchStudentAssignments,
  submitStudentAssignment,
  type StudentAssignmentDetail,
} from "@/lib/student";
import { AsyncState, MetricCard, StatusPill, dateTime } from "@/components/teacher/teacher-ui";

/** C-ST-10 — every published assignment for this learner's class. */
export function StudentAssignmentsPage() {
  const [status, setStatus] = useState("");
  const load = useCallback(
    () => fetchStudentAssignments({ status: status || undefined }),
    [status],
  );
  const resource = useResource(load, [status]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Assignments"
        subtitle="What is due, what you have sent, and what came back for changes."
      />

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading assignments…"
      >
        {resource.data ? (
          <>
            <section className="mb-5 grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="To submit"
                value={resource.data.pending_count}
                tone={resource.data.pending_count ? "warning" : "success"}
              />
              <MetricCard label="Submitted" value={resource.data.submitted_count} tone="default" />
            </section>

            <Card className="mb-5">
              <label className={labelClass} htmlFor="student-assignment-status">
                Status
              </label>
              <select
                id="student-assignment-status"
                className={`${inputClass} sm:max-w-xs`}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All</option>
                <option value="PENDING">Not submitted</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_REVIEW">Under review</option>
                <option value="APPROVED">Approved</option>
                <option value="RESUBMIT_REQUESTED">Changes requested</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </Card>

            {resource.data.items.length ? (
              <div className="space-y-3">
                {resource.data.items.map((assignment) => (
                  <Card key={assignment.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/student/assignments/${assignment.id}`}
                          className="font-display text-sm font-bold text-primary hover:text-accent"
                        >
                          {assignment.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {assignment.subject_code} · {assignment.teacher_name ?? "—"} ·{" "}
                          {assignment.total_marks} marks
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
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusPill status={assignment.my_status} />
                        {assignment.my_score !== null ? (
                          <p className="text-sm font-semibold text-primary">
                            {assignment.my_score}/{assignment.total_marks}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {assignment.can_submit ? (
                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="mt-3 inline-flex h-9 items-center rounded-field bg-accent px-4 text-sm font-semibold text-white"
                      >
                        {assignment.my_status === "PENDING" ? "Submit work" : "Resubmit"}
                      </Link>
                    ) : null}
                  </Card>
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

interface FileDraft {
  file_name: string;
  file_key: string;
  file_size_bytes: number;
  mime_type: string;
}

/**
 * C-ST-11 / C-ST-12 — the brief, the milestone stepper and the submit form.
 *
 * Milestones and submission live on one page because a milestone project is
 * submitted *per stage*: separating them would mean the student picks a stage
 * on one screen and uploads on another with no way to tell which is unlocked.
 */
export function StudentAssignmentDetailPage({ assignmentId }: { assignmentId: string }) {
  const load = useCallback(() => fetchStudentAssignment(assignmentId), [assignmentId]);
  const resource = useResource(load, [assignmentId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Assignment"
        subtitle="Read the brief, then attach your work."
        action={
          <Link href="/student/assignments" className="text-sm font-semibold text-accent hover:underline">
            All assignments
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
            onSubmitted={(next) => resource.setData(next)}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

function AssignmentBody({
  assignment,
  onSubmitted,
}: {
  assignment: StudentAssignmentDetail;
  onSubmitted: (next: StudentAssignmentDetail) => void;
}) {
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMilestone = assignment.milestones.length > 0;
  const openMilestones = assignment.milestones.filter(
    (milestone) =>
      !milestone.is_locked &&
      (milestone.submission_status === null ||
        ["REJECTED", "RESUBMIT_REQUESTED"].includes(milestone.submission_status)),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await submitStudentAssignment(assignment.id, {
        milestone_id: isMilestone ? milestoneId || openMilestones[0]?.id : null,
        text_response: text.trim() || null,
        files,
      });
      onSubmitted(next);
      setText("");
      setFiles([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-primary">{assignment.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {assignment.subject_code} · {assignment.teacher_name ?? "—"} ·{" "}
              {assignment.total_marks} marks
            </p>
            <time
              className={`mt-1 block text-xs font-medium ${
                assignment.is_overdue ? "text-destructive-text" : "text-accent"
              }`}
            >
              Due {dateTime(assignment.due_date)}
            </time>
          </div>
          <StatusPill status={assignment.my_status} />
        </div>
        <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-foreground">
          {assignment.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Accepts {assignment.allowed_file_types.join(", ") || "any file"} up to{" "}
          {assignment.max_file_size_mb} MB.
          {assignment.allow_late_submission
            ? ` Late work is accepted with a ${assignment.late_penalty_percent}% penalty.`
            : " Late work is not accepted."}
        </p>
      </Card>

      {isMilestone ? (
        <Card>
          {/* Anchor for `/student/assignments/:id/milestones` (C-ST-12). */}
          <h3 id="milestones" className="mb-3 scroll-mt-24 font-display text-sm font-bold text-primary">
            Milestones
          </h3>
          <ol className="space-y-2">
            {assignment.milestones.map((milestone) => (
              <li
                key={milestone.id}
                className={`rounded-field border px-3 py-2.5 ${
                  milestone.is_locked ? "border-border bg-muted/40" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-primary">
                      {milestone.is_locked ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" />
                      ) : null}
                      {milestone.sort_order}. {milestone.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {milestone.marks} marks
                      {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                    </p>
                    {milestone.feedback ? (
                      <p className="mt-1 text-xs text-muted-foreground">{milestone.feedback}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {milestone.submission_status ? (
                      <StatusPill status={milestone.submission_status} />
                    ) : milestone.is_locked ? (
                      <StatusPill status="LOCKED" tone="default" label="Locked" />
                    ) : (
                      <StatusPill status="PENDING" tone="warning" label="Open" />
                    )}
                    {milestone.score !== null ? (
                      <span className="text-sm font-semibold text-primary">
                        {milestone.score}/{milestone.marks}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            A stage unlocks once the previous one is approved.
          </p>
        </Card>
      ) : null}

      {assignment.submissions.length ? (
        <Card>
          <h3 className="mb-3 font-display text-sm font-bold text-primary">Your submissions</h3>
          <ol className="space-y-3">
            {assignment.submissions.map((submission) => (
              <li key={submission.id} className="border-l-2 border-border pl-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                  Version {submission.version}
                  {submission.milestone_title ? ` · ${submission.milestone_title}` : ""}
                  <StatusPill status={submission.status} />
                  {submission.is_late ? <StatusPill status="LATE" tone="warning" /> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {dateTime(submission.submitted_at)}
                  {submission.score !== null ? ` · scored ${submission.score}` : ""}
                </p>
                {submission.feedback ? (
                  <p className="mt-1 rounded-field border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {submission.feedback}
                  </p>
                ) : null}
                {submission.files.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {submission.files.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <Paperclip className="h-3 w-3" />
                        {file.file_name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {assignment.can_submit ? (
        <Card>
          <h3 className="mb-4 font-display text-sm font-bold text-primary">Submit your work</h3>
          <form onSubmit={submit} className="space-y-4">
            {isMilestone ? (
              <div>
                <label className={labelClass} htmlFor="submission-milestone">
                  Milestone
                </label>
                <select
                  id="submission-milestone"
                  className={inputClass}
                  required
                  value={milestoneId}
                  onChange={(event) => setMilestoneId(event.target.value)}
                >
                  <option value="">Select the stage you are submitting</option>
                  {openMilestones.map((milestone) => (
                    <option key={milestone.id} value={milestone.id}>
                      {milestone.sort_order}. {milestone.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className={labelClass} htmlFor="submission-text">
                Your response
              </label>
              <textarea
                id="submission-text"
                rows={5}
                className={`${inputClass} h-auto py-2.5`}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>

            <FileList
              files={files}
              allowed={assignment.allowed_file_types}
              maxMb={assignment.max_file_size_mb}
              onAdd={(file) => setFiles((current) => [...current, file])}
              onRemove={(index) =>
                setFiles((current) => current.filter((_item, position) => position !== index))
              }
            />

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
              {busy ? "Submitting…" : "Submit"}
            </button>
          </form>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            {assignment.my_status === "APPROVED"
              ? "This assignment has been approved. Nothing further is needed."
              : assignment.is_overdue && !assignment.allow_late_submission
                ? "The due date has passed and late submissions are not accepted."
                : "Your submission is with your teacher."}
          </p>
        </Card>
      )}
    </div>
  );
}

/**
 * Files are recorded by storage key rather than uploaded through this form:
 * `ARCHITECTURE.md` §11 puts binaries on S3 behind a presigned PUT so a 50 MB
 * PDF never travels through the API.
 */
function FileList({
  files,
  allowed,
  maxMb,
  onAdd,
  onRemove,
}: {
  files: FileDraft[];
  allowed: string[];
  maxMb: number;
  onAdd: (file: FileDraft) => void;
  onRemove: (index: number) => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [size, setSize] = useState("");

  return (
    <div className="rounded-field border border-border p-3">
      <p className={labelClass}>Attachments</p>
      {files.length ? (
        <ul className="mb-3 space-y-1.5">
          {files.map((file, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{file.file_name}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${file.file_name}`}
                className="rounded p-1 text-destructive-text hover:bg-destructive-light"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_2.5rem]">
        <input
          className={inputClass}
          placeholder="File name (report.pdf)"
          aria-label="File name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Storage key"
          aria-label="Storage key"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <input
          className={inputClass}
          type="number"
          min={0}
          placeholder="Bytes"
          aria-label="File size in bytes"
          value={size}
          onChange={(event) => setSize(event.target.value)}
        />
        <button
          type="button"
          aria-label="Add attachment"
          disabled={!name.trim() || !key.trim()}
          onClick={() => {
            onAdd({
              file_name: name.trim(),
              file_key: key.trim(),
              file_size_bytes: Number(size || 0),
              mime_type: "application/octet-stream",
            });
            setName("");
            setKey("");
            setSize("");
          }}
          className="flex h-11 items-center justify-center rounded-field border border-border text-accent hover:border-accent disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Allowed: {allowed.join(", ") || "any"} · max {maxMb} MB each.
      </p>
    </div>
  );
}
