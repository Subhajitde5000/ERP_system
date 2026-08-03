"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchTeacherSubmission,
  reviewTeacherSubmission,
  type TeacherSubmissionDetail,
} from "@/lib/teacher";
import { AsyncState, StatusPill, dateTime, statusLabel } from "@/components/teacher/teacher-ui";

type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

/**
 * C-TC-16 — one submission: files, response, feedback and the score.
 *
 * The review history is shown in full rather than only the latest verdict,
 * because a resubmit cycle is the interesting part: a student who was asked
 * for changes twice and then approved tells a different story from one who
 * was approved first time.
 */
export function TeacherSubmissionDetailPage({ submissionId }: { submissionId: string }) {
  const load = useCallback(() => fetchTeacherSubmission(submissionId), [submissionId]);
  const resource = useResource(load, [submissionId]);
  const [decision, setDecision] = useState<Decision>("APPROVED");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await reviewTeacherSubmission(submissionId, {
        decision,
        score: decision === "APPROVED" ? Number(score) : score ? Number(score) : null,
        feedback: feedback.trim() || null,
      });
      resource.setData(next);
      setFeedback("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Submission" subtitle="Read the work, then score it and send feedback." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading submission…"
      >
        {resource.data ? (
          <div className="space-y-5">
            <SubmissionSummary submission={resource.data} />

            <Card>
              <h3 className="mb-4 font-display text-sm font-bold text-primary">Review</h3>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="review-decision">
                      Decision
                    </label>
                    <select
                      id="review-decision"
                      className={inputClass}
                      value={decision}
                      onChange={(event) => setDecision(event.target.value as Decision)}
                    >
                      <option value="APPROVED">Approve</option>
                      <option value="CHANGES_REQUESTED">Request changes</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="review-score">
                      Score / {resource.data.total_marks}
                    </label>
                    <input
                      id="review-score"
                      type="number"
                      min={0}
                      max={resource.data.total_marks}
                      step={0.5}
                      required={decision === "APPROVED"}
                      className={inputClass}
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="review-feedback">
                    Feedback{decision === "APPROVED" ? " (optional)" : ""}
                  </label>
                  <textarea
                    id="review-feedback"
                    rows={4}
                    required={decision !== "APPROVED"}
                    className={`${inputClass} h-auto py-2.5`}
                    placeholder={
                      decision === "APPROVED"
                        ? "What was done well?"
                        : "Explain what needs to change."
                    }
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                  />
                </div>
                {resource.data.is_late ? (
                  <p className="rounded-field border border-warning-border bg-warning-light px-3 py-2 text-xs text-warning-text">
                    This submission was late. The assignment&apos;s late penalty is applied to the
                    score automatically.
                  </p>
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
                  {busy ? "Saving…" : "Record review"}
                </button>
              </form>
            </Card>

            {resource.data.reviews.length ? (
              <Card>
                <h3 className="mb-3 font-display text-sm font-bold text-primary">
                  Review history
                </h3>
                <ol className="space-y-3">
                  {resource.data.reviews.map((review) => (
                    <li key={review.id} className="border-l-2 border-border pl-3">
                      <p className="text-sm font-semibold text-primary">
                        Attempt {review.attempt_number} · {statusLabel(review.decision)}
                        {review.marks_awarded !== null ? ` · ${review.marks_awarded} marks` : ""}
                      </p>
                      {review.feedback ? (
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                          {review.feedback}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {review.reviewer_name ?? "—"} · {dateTime(review.reviewed_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            ) : null}

            <Link
              href={`/teacher/assignments/${resource.data.assignment_id}/submissions`}
              className="inline-block text-sm font-semibold text-accent hover:underline"
            >
              Back to all submissions
            </Link>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function SubmissionSummary({ submission }: { submission: TeacherSubmissionDetail }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-primary">
            {submission.student_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {submission.roll_number ?? "—"} · {submission.class_name} ·{" "}
            {submission.assignment_title}
            {submission.milestone_title ? ` · ${submission.milestone_title}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {dateTime(submission.submitted_at)} · version {submission.version}
            {submission.is_late && submission.late_by_minutes
              ? ` · ${Math.round(submission.late_by_minutes / 60)}h late`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={submission.status} />
          <p className="font-display text-lg font-bold text-primary">
            {submission.score === null ? "—" : `${submission.score}/${submission.total_marks}`}
          </p>
        </div>
      </div>

      {submission.text_response ? (
        <div className="mt-4 rounded-field border border-border bg-muted/40 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Response</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {submission.text_response}
          </p>
        </div>
      ) : null}

      {submission.files.length ? (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {submission.files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-foreground">{file.file_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
          No files were attached.
        </p>
      )}
    </Card>
  );
}
