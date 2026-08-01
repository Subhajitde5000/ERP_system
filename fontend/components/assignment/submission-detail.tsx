"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  MessageSquareQuote,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePreviewHref } from "@/lib/use-preview-href";
import {
  dueDateTime,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONE,
} from "@/lib/assignment";
import { fileSize } from "@/lib/notices";
import { FormAlert } from "@/components/auth/form-alert";
import {
  Card,
  EmptyState,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import type { SubmissionDetail as Detail } from "@/types/assignment";

/**
 * C-TC-16 — Submission Detail.
 * "View one submission, files, add feedback, set score"
 *
 * The review table (C-TC-15) already expands a row into a compact grading
 * form. This page is the same decision with room to make it properly: the
 * full text response instead of a clipped preview, every file listed rather
 * than a wrapped strip, and the earlier versions that explain *why* the work
 * is on its second attempt.
 *
 * It exists as its own URL because a submission is the thing a teacher gets
 * linked to — from a notification, from the dashboard's "pending review"
 * count, or from a colleague. Landing on the assignment and hunting for one
 * student in a table of forty is the workflow this route removes.
 *
 * **Marking is a decision, not a save.** §7.3's `status` enum has three
 * reviewer outcomes (APPROVED / REJECTED / RESUBMIT_REQUESTED) and the form
 * makes all three equally reachable rather than defaulting to approve.
 */
export function SubmissionDetail({ detail }: { detail: Detail }) {
  const { submission: s, assignment, milestone, previousVersions, queue } =
    detail;

  const [score, setScore] = useState(s.score === null ? "" : String(s.score));
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState<string | null>(null);

  // `?role=` is the session while there is no backend. A client-side <Link>
  // that drops it navigates as the default role and 404s on this page, which
  // is fenced to reviewers.
  const href = usePreviewHref();

  const reviewable =
    !decided && (s.status === "SUBMITTED" || s.status === "UNDER_REVIEW");
  const shownStatus = (decided ?? s.status) as typeof s.status;

  async function decide(kind: string) {
    if (busy) return;

    // Validated in JS, not with native `min`/`max` on the number input:
    // the native attributes suppress the form's own message and the field
    // silently refuses to submit. A rejection may legitimately carry no
    // score, so only a *present* value is range-checked.
    if (score.trim() !== "") {
      const value = Number(score);
      if (!Number.isFinite(value)) {
        setError("Score must be a number.");
        return;
      }
      if (value < 0) {
        setError("Score cannot be negative.");
        return;
      }
      if (value > assignment.totalMarks) {
        setError(`Score cannot exceed ${assignment.totalMarks}.`);
        return;
      }
    } else if (kind === "APPROVED") {
      setError("Approving needs a score.");
      return;
    }

    setError(null);
    setBusy(kind);
    // TODO(Dev-B): PATCH /api/v1/assignment/submissions/:id/review — writes
    // `score`, `feedback`, `status`, `reviewed_by` and `reviewed_at` (§7.3).
    await new Promise((r) => setTimeout(r, 700));
    setBusy(null);
    setDecided(kind);
    setNotice(
      `PATCH /assignment/submissions/${s.submissionId}/review { status: "${kind}", score: ${score.trim() === "" ? "null" : score} } — API not connected yet (Dev-B, §9.3).`,
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href={href(`/assignments/${assignment.id}`)}
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {assignment.title}
      </Link>

      <div className="mb-1 flex min-w-0 flex-wrap items-start gap-2">
        <h1 className="min-w-0 font-display text-[22px] font-bold text-foreground">
          {s.studentName}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
          <StatusPill status={shownStatus} />
          {s.version > 1 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#475569]">
              v{s.version}
            </span>
          )}
        </div>
      </div>

      <p className="mb-4 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span className="font-mono">{s.rollNo}</span>
        <span>· {assignment.subjectCode}</span>
        <span>· out of {assignment.totalMarks} marks</span>
        {milestone && <span>· {milestone.title}</span>}
      </p>

      {notice && (
        <FormAlert variant="success" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {/* Late submissions are a grading input, so they lead */}
      {s.isLate && (
        <FormAlert variant="error" className="mb-4">
          Submitted late
          {s.lateByMinutes !== null && ` by ${formatLate(s.lateByMinutes)}`}
          {assignment.allowLateSubmission
            ? " — late submissions are allowed on this assignment."
            : " — this assignment does not allow late submissions."}
        </FormAlert>
      )}

      <div className="grid min-w-0 gap-4">
        {/* 1 — The work itself */}
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Submission
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {s.submittedAt ? dueDateTime(s.submittedAt) : "Not submitted"}
            </span>
          </div>

          {s.textResponse ? (
            <p className="min-w-0 whitespace-pre-line rounded-field border border-border bg-background px-3.5 py-3 text-[13px] leading-6 text-[#334155]">
              {s.textResponse}
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              No written response — the work is in the attached files.
            </p>
          )}

          {/* 2 — Files. Listed, not wrapped into a strip: on this page there
              is room to show the size of each, which is the one signal that
              a file is empty or truncated. */}
          <div className="mt-4 min-w-0 border-t border-border pt-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Files
              <span className="ml-1.5 font-normal normal-case tracking-normal">
                {s.files.length}
              </span>
            </h3>

            {s.files.length === 0 ? (
              <EmptyState message="No files attached to this submission." />
            ) : (
              <ul className="min-w-0 divide-y divide-border border-t border-border">
                {s.files.map((f) => (
                  <li
                    key={f.id}
                    className="flex min-w-0 items-center gap-3 py-2.5"
                  >
                    <Paperclip
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {f.fileName}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {fileSize(f.fileSizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNotice(
                          "GET /storage/:key — presigned download not wired yet (Dev-B, §11.3).",
                        )
                      }
                      className="shrink-0 rounded-field border border-border px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      Download
                      <span className="sr-only"> {f.fileName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* 3 — Earlier versions. §7.3 makes a resubmission a new row, so v2
            without v1's feedback hides why the student was asked again. */}
        {previousVersions.length > 0 && (
          <Card className="min-w-0 p-5 sm:p-6">
            <h2 className="mb-1 flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
              <History className="h-4 w-4 shrink-0" aria-hidden="true" />
              Earlier attempts
            </h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              What was asked for before this version.
            </p>

            <ol className="min-w-0 divide-y divide-border border-t border-border">
              {previousVersions.map((v) => (
                <li key={v.version} className="min-w-0 py-2.5">
                  <p className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 text-[12px] font-semibold text-foreground">
                      Version {v.version}
                    </span>
                    <StatusPill status={v.status} />
                    {v.submittedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {dueDateTime(v.submittedAt)}
                      </span>
                    )}
                  </p>
                  {v.feedback && (
                    <p className="mt-1 min-w-0 text-[12px] leading-5 text-[#475569]">
                      {v.feedback}
                      {v.reviewedByName && (
                        <span className="block text-[11px] text-muted-foreground">
                          — {v.reviewedByName}
                        </span>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* 4 — Feedback + score. The doc's two verbs. */}
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            {reviewable ? "Review" : "Marked"}
          </h2>

          {reviewable ? (
            <div className="grid min-w-0 gap-4">
              <div className="min-w-0">
                <label
                  htmlFor="submission-score"
                  className="text-[13px] font-medium text-[#334155]"
                >
                  Score
                </label>
                <div className="mt-1.5 flex min-w-0 items-center gap-2">
                  <input
                    id="submission-score"
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    value={score}
                    onChange={(e) => {
                      setScore(e.target.value);
                      setError(null);
                    }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "submission-score-error" : undefined}
                    className={cn(
                      "h-11 w-28 min-w-0 rounded-field border bg-white px-3 text-[14px] tabular-nums transition focus:outline-none focus:ring-3",
                      error
                        ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                        : "border-border focus:border-accent focus:ring-accent/15",
                    )}
                  />
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    of {assignment.totalMarks}
                    <span className="ml-1 text-[12px]">
                      (pass at {assignment.passingMarks})
                    </span>
                  </span>
                </div>
                {error && (
                  <p
                    id="submission-score-error"
                    className="mt-1 text-[12px] text-destructive-text"
                  >
                    {error}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="submission-feedback"
                  className="text-[13px] font-medium text-[#334155]"
                >
                  Feedback
                </label>
                <textarea
                  id="submission-feedback"
                  rows={4}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What was good, and what needs changing?"
                  className="mt-1.5 w-full min-w-0 rounded-field border border-border bg-white px-3 py-2.5 text-[14px] leading-6 transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
                <p className="mt-1 text-[12px] text-muted-foreground">
                  The student sees this alongside their score.
                </p>
              </div>

              {/* All three outcomes given equal weight — the enum has three
                  reviewer states (§7.3) and defaulting to approve is how a
                  rushed review becomes a wrong mark. */}
              <div className="flex min-w-0 flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  loading={busy === "APPROVED"}
                  loadingText="Approving…"
                  disabled={busy !== null}
                  onClick={() => decide("APPROVED")}
                  className="w-auto px-4"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => decide("RESUBMIT_REQUESTED")}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-field border border-border px-4 text-[14px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Ask to resubmit
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => decide("REJECTED")}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-4 text-[14px] font-medium text-destructive-text transition-colors hover:bg-destructive-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Reject
                </button>
              </div>
            </div>
          ) : (
            /* Already decided — show the mark, don't offer the form again */
            <div className="grid min-w-0 gap-3">
              <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-3">
                <Figure
                  label="Score"
                  value={
                    s.score === null
                      ? "—"
                      : `${s.score}/${assignment.totalMarks}`
                  }
                />
                <Figure label="Grade" value={s.grade ?? "—"} />
                <Figure
                  label="Reviewed"
                  value={s.reviewedAt ? dueDateTime(s.reviewedAt) : "—"}
                />
              </dl>

              {(feedback || s.feedback) && (
                <p className="flex min-w-0 gap-2 rounded-field bg-accent-light px-3.5 py-3 text-[13px] leading-6 text-[#3730A3]">
                  <MessageSquareQuote
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    {feedback || s.feedback}
                    {s.reviewedByName && (
                      <span className="block text-[12px] opacity-80">
                        — {s.reviewedByName}
                      </span>
                    )}
                  </span>
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Queue navigation — the reason this is a page and not a dialog */}
      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          {queue.total === 0
            ? "Nothing else is awaiting review on this assignment."
            : queue.position === 0
              ? `${queue.total} other ${queue.total === 1 ? "submission is" : "submissions are"} awaiting review.`
              : `${queue.position} of ${queue.total} awaiting review.`}
        </p>

        {queue.nextId ? (
          <Link
            href={href(`/teacher/submissions/${queue.nextId}`)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Next to review
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <Link
            href={href(`/assignments/${assignment.id}`)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field border border-border px-4 text-sm font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Back to all submissions
          </Link>
        )}
      </div>
    </div>
  );
}

/** Same status vocabulary as the review table — one set of labels and tones. */
function StatusPill({ status }: { status: Detail["submission"]["status"] }) {
  const tone = SUBMISSION_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_BG[tone],
        // `muted-foreground` is 4.34:1 on `bg-muted` — below AA. A ternary,
        // not a layered class: `cn()` has no Tailwind conflict resolution.
        tone === "muted" ? "text-[#475569]" : TONE_TEXT[tone],
      )}
    >
      {SUBMISSION_STATUS_LABELS[status]}
    </span>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** "1h 30m" — minutes alone stop being readable past an hour or two. */
function formatLate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
