"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchTeacherAssignment,
  fetchTeacherSubmission,
  fetchTeacherSubmissions,
  reviewTeacherSubmission,
  type TeacherReviewDecision,
} from "@/lib/teacher";
import { AsyncState, EmptyTable, dateTime, statusLabel } from "@/components/principal/principal-ui";

const STATUS_FILTERS = ["", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "RESUBMIT_REQUESTED"] as const;

/** C-TC-15 — every submission for one assignment, with review actions. */
export function TeacherAssignmentSubmissionsPage() {
  const params = useParams<{ id?: string }>();
  const assignmentId = params?.id ?? "";
  const assignment = useResource(
    () => (assignmentId ? fetchTeacherAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const [status, setStatus] = useState<string>("");
  const resource = useResource(
    () => fetchTeacherSubmissions({ assignmentId, status: status || undefined, limit: 100 }),
    [assignmentId, status],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={assignment.data ? `Submissions — ${assignment.data.title}` : "Submissions"}
        subtitle="Review each student's work: approve, reject, or ask for a resubmission."
        action={
          <Link href={`/teacher/assignments/${assignmentId}`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
            Assignment detail
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
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading submissions…">
        {resource.data ? (
          <Card className="!p-0">
            {resource.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Submitted</th>
                      <th className="px-5 py-3">Version</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Score</th>
                      <th className="px-5 py-3"><span className="sr-only">Review</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resource.data.items.map((submission) => (
                      <tr key={submission.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold text-primary">
                          {submission.student_name}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {submission.roll_number ?? "No roll number"}
                            {submission.milestone_title ? ` · ${submission.milestone_title}` : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {dateTime(submission.submitted_at)}
                          {submission.is_late ? (
                            <span className="block text-[11px] font-semibold text-warning-text">
                              Late{submission.late_by_minutes ? ` by ${submission.late_by_minutes} min` : ""}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">v{submission.version}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${submissionStatusClass(submission.status)}`}>
                            {statusLabel(submission.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-primary">
                          {submission.score !== null ? `${submission.score}${submission.grade ? ` · ${submission.grade}` : ""}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/teacher/submissions/${submission.id}`} className="text-xs font-semibold text-accent hover:underline">
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTable text="No submissions match this filter." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}

function submissionStatusClass(status: string): string {
  if (status === "APPROVED") return "bg-success-light text-success-text";
  if (status === "REJECTED") return "bg-destructive-light text-destructive-text";
  if (status === "RESUBMIT_REQUESTED" || status === "CHANGES_REQUESTED") return "bg-warning-light text-warning-text";
  if (status === "UNDER_REVIEW") return "bg-accent-light text-accent";
  return "bg-muted text-muted-foreground";
}

/** C-TC-16 — one submission: files, feedback, score, review history. */
export function TeacherSubmissionDetailPage() {
  const params = useParams<{ id?: string }>();
  const submissionId = params?.id ?? "";
  const resource = useResource(
    () => (submissionId ? fetchTeacherSubmission(submissionId) : Promise.reject(new Error("No submission ID provided"))),
    [submissionId],
  );
  const [form, setForm] = useState({ decision: "APPROVED" as TeacherReviewDecision, score: "", feedback: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewable = resource.data
    ? ["SUBMITTED", "UNDER_REVIEW", "RESUBMIT_REQUESTED"].includes(resource.data.status)
    : false;

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resource.data) return;
    const score = form.score.trim() === "" ? null : Number(form.score);
    if (form.decision === "APPROVED" && score === null) {
      setError("Enter a score to approve the submission.");
      return;
    }
    if (score !== null && (Number.isNaN(score) || score < 0 || score > resource.data.total_marks)) {
      setError(`Score must be between 0 and ${resource.data.total_marks}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await reviewTeacherSubmission(submissionId, {
        decision: form.decision,
        score,
        feedback: form.feedback.trim() || null,
      });
      resource.setData(updated);
      setForm({ decision: "APPROVED", score: "", feedback: "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Submission review" subtitle="One student's work — files, feedback, score and review history." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading submission…">
        {resource.data ? (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-primary">{resource.data.student_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {resource.data.roll_number ?? "No roll number"} · <Link href={`/teacher/assignments/${resource.data.assignment_id}`} className="font-semibold text-accent hover:underline">{resource.data.assignment_title}</Link>
                    {resource.data.milestone_title ? ` · ${resource.data.milestone_title}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submitted {dateTime(resource.data.submitted_at)} · v{resource.data.version}
                    {resource.data.is_late ? (
                      <span className="font-semibold text-warning-text"> · Late{resource.data.late_by_minutes ? ` by ${resource.data.late_by_minutes} min` : ""}</span>
                    ) : null}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${submissionStatusClass(resource.data.status)}`}>
                  {statusLabel(resource.data.status)}
                </span>
              </div>
              {resource.data.text_response ? (
                <div className="mt-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Written response</h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-field bg-muted p-4 text-sm text-primary">{resource.data.text_response}</p>
                </div>
              ) : null}
              {resource.data.files.length ? (
                <div className="mt-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Files</h3>
                  <ul className="mt-2 space-y-2">
                    {resource.data.files.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-3 rounded-field border border-border px-3 py-2.5 text-sm">
                        <span className="truncate font-medium text-primary">{file.file_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB · {file.mime_type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {resource.data.feedback && !reviewable ? (
                <div className="mt-4 rounded-field border border-border bg-muted/50 p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Your feedback</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{resource.data.feedback}</p>
                  {resource.data.score !== null ? (
                    <p className="mt-2 text-sm font-semibold text-primary">
                      Score: {resource.data.score} / {resource.data.total_marks}
                      {resource.data.grade ? ` · Grade ${resource.data.grade}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>

            {reviewable ? (
              <Card>
                <h2 className="font-display text-base font-bold text-primary">Review this submission</h2>
                <form onSubmit={submitReview} className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Review decision">
                    {(
                      [
                        ["APPROVED", "Approve"],
                        ["CHANGES_REQUESTED", "Request changes"],
                        ["REJECTED", "Reject"],
                      ] as [TeacherReviewDecision, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setForm({ ...form, decision: value })}
                        aria-pressed={form.decision === value}
                        className={`h-10 rounded-field border px-4 text-sm font-semibold transition ${
                          form.decision === value
                            ? value === "APPROVED"
                              ? "border-success-border bg-success-light text-success-text"
                              : value === "REJECTED"
                                ? "border-destructive-border bg-destructive-light text-destructive-text"
                                : "border-warning-border bg-warning-light text-warning-text"
                            : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="review-score" className={labelClass}>
                        Score (0–{resource.data.total_marks}){form.decision === "APPROVED" ? " *" : ""}
                      </label>
                      <input
                        id="review-score"
                        type="number"
                        min={0}
                        max={resource.data.total_marks}
                        step={0.5}
                        className={inputClass}
                        value={form.score}
                        onChange={(event) => setForm({ ...form, score: event.target.value })}
                        required={form.decision === "APPROVED"}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="review-feedback" className={labelClass}>Feedback for the student</label>
                      <input
                        id="review-feedback"
                        className={inputClass}
                        maxLength={5000}
                        value={form.feedback}
                        onChange={(event) => setForm({ ...form, feedback: event.target.value })}
                      />
                    </div>
                  </div>
                  {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
                  <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                    {busy ? "Saving…" : "Save review"}
                  </button>
                </form>
              </Card>
            ) : null}

            <Card>
              <h2 className="font-display text-base font-bold text-primary">Review history</h2>
              {resource.data.reviews.length ? (
                <ol className="mt-3 space-y-3">
                  {resource.data.reviews.map((review) => (
                    <li key={review.id} className="border-l-2 border-accent pl-3">
                      <p className="text-sm font-semibold text-primary">
                        {statusLabel(review.decision)}
                        {review.marks_awarded !== null ? ` · ${review.marks_awarded} marks` : ""}
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                          attempt {review.attempt_number} · {review.reviewer_name ?? "Reviewer"} · {dateTime(review.reviewed_at)}
                        </span>
                      </p>
                      {review.feedback ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{review.feedback}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No reviews yet — this is the first pass.</p>
              )}
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
