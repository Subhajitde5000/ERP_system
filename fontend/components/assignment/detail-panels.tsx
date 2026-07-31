"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Layers,
  Lock,
  MessageSquareQuote,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fileSize } from "@/lib/notices";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONE,
  dueDateTime,
} from "@/lib/assignment";
import { Button } from "@/components/ui/button";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  AssignmentProgress,
  AssignmentSummary,
  Milestone,
  SubmissionRow,
} from "@/types/assignment";

/**
 * Assignment detail panels — role_based_shared_pages.md PAGE 22 (C-RB-22).
 *
 * Teacher: "milestone list, submission table per student" with
 *          "edit milestones, review submissions, approve/reject".
 * HOD:     "overview of submissions, completion rate | view only".
 */

/** Status pill, same shape as the other detail pages. */
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t] ?? TONE_BG.muted,
        TONE_TEXT[t] ?? TONE_TEXT.muted,
      )}
    >
      {children}
    </span>
  );
}

/* ── Progress / completion rate ─────────────────────────────────────────── */

/**
 * PAGE 22's "overview of submissions, completion rate". The HOD sees exactly
 * this and nothing else; the Teacher sees it above their table.
 */
export function AssignmentProgressPanel({
  assignment,
  progress,
}: {
  assignment: AssignmentSummary;
  progress: AssignmentProgress;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Submission rate", `${progress.submissionRate}%`, "text-foreground",
            `${progress.submitted} of ${progress.enrolled} students`],
          ["Completion rate", `${progress.completionRate}%`, "text-success",
            `${progress.approved} approved`],
          ["Awaiting review", String(progress.pendingReview),
            progress.pendingReview > 0 ? "text-warning" : "text-muted-foreground",
            progress.pendingReview > 0 ? "needs your attention" : "all clear"],
        ].map(([label, value, tone, hint]) => (
          <Card key={label} className="min-w-0 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-2 font-display text-2xl font-bold", tone)}>
              {value}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {hint}
            </p>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Class progress
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {progress.submitted}/{progress.enrolled} submitted
          </span>
        </div>

        <ProgressBar value={progress.submitted} max={progress.enrolled} />

        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            ["Not submitted", progress.notSubmitted, "muted"],
            ["Approved", progress.approved, "success"],
            ["Needs changes", progress.rejected, "danger"],
            ["Late", progress.late, "warning"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="min-w-0">
              <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd
                className={cn(
                  "mt-0.5 font-display text-lg font-bold tabular-nums",
                  TONE_TEXT[tone as keyof typeof TONE_TEXT],
                )}
              >
                {value as number}
              </dd>
            </div>
          ))}
        </dl>

        {progress.averageScore !== null && (
          <p className="mt-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
            Marks so far — average{" "}
            <span className="font-semibold text-foreground">
              {progress.averageScore}
            </span>
            , high{" "}
            <span className="font-semibold text-foreground">
              {progress.highestScore}
            </span>
            , low{" "}
            <span className="font-semibold text-foreground">
              {progress.lowestScore}
            </span>{" "}
            out of {assignment.totalMarks}
          </p>
        )}
      </Card>
    </div>
  );
}

/* ── Milestone list / editor ────────────────────────────────────────────── */

/**
 * PAGE 22's "milestone list" with "edit milestones".
 *
 * Editing is gated on `editable` — §9.3 makes approving a milestone unlock
 * the next, so re-ordering the chain after students have started would
 * invalidate approved work. The reason is shown rather than silently hiding
 * the controls.
 */
export function MilestoneListPanel({
  milestones,
  editable,
  lockReason,
  canReview,
  onAction,
}: {
  milestones: Milestone[];
  editable: boolean;
  lockReason: string | null;
  canReview: boolean;
  onAction: (message: string) => void;
}) {
  const total = milestones.reduce((a, m) => a + m.marks, 0);
  const done = milestones.filter((m) => m.status === "APPROVED").length;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <Layers className="h-4 w-4 text-secondary" aria-hidden="true" />
            Milestones
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {done}/{milestones.length} approved · {total} marks
          </p>
        </div>

        {editable ? (
          <button
            type="button"
            onClick={() =>
              onAction(
                "POST /assignment/assignments/:id/milestones — API not connected yet (Dev-B, §9.3).",
              )
            }
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add milestone
          </button>
        ) : (
          lockReason && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              {lockReason}
            </span>
          )
        )}
      </div>

      <ol className="min-w-0 divide-y divide-border border-t border-border">
        {milestones.map((m) => {
          const approved = m.status === "APPROVED";

          return (
            <li key={m.id} className="flex min-w-0 items-start gap-3 py-3">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  approved
                    ? "bg-success text-white"
                    : m.isLocked
                      ? "bg-muted text-[#94A3B8]"
                      : "bg-accent-light text-accent",
                )}
                aria-hidden="true"
              >
                {approved ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : m.isLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  m.sortOrder
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    m.isLocked ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {m.title}
                </p>
                {m.description && (
                  <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                    {m.description}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.marks} marks
                  {m.dueDate && ` · due ${dueDateTime(m.dueDate)}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Pill
                  tone={
                    m.isLocked ? "muted" : SUBMISSION_STATUS_TONE[m.status]
                  }
                >
                  {m.isLocked
                    ? "LOCKED"
                    : SUBMISSION_STATUS_LABELS[m.status].toUpperCase()}
                </Pill>

                {editable && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onAction(
                          "PATCH /assignment/milestones/:id — API not connected yet (Dev-B).",
                        )
                      }
                      aria-label={`Edit ${m.title}`}
                      className="rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onAction(
                          "DELETE /assignment/milestones/:id — API not connected yet (Dev-B).",
                        )
                      }
                      aria-label={`Delete ${m.title}`}
                      className="rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive-border hover:bg-destructive-light hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </>
                )}

                {/* A submitted stage is reviewable even when the chain is frozen */}
                {!editable &&
                  canReview &&
                  (m.status === "SUBMITTED" || m.status === "UNDER_REVIEW") && (
                    <button
                      type="button"
                      onClick={() =>
                        onAction(
                          "PATCH /assignment/submissions/:id/review — API not connected yet (Dev-B, §9.3).",
                        )
                      }
                      className="rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      Review
                    </button>
                  )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ── Submission table (Teacher) ─────────────────────────────────────────── */

type Filter = "ALL" | "PENDING" | "REVIEWED" | "MISSING";

/**
 * PAGE 22's "submission table per student" with "review submissions,
 * approve/reject". Each row expands into the reviewer form so grading never
 * leaves the page.
 */
export function SubmissionTablePanel({
  assignment,
  rows,
  onAction,
}: {
  assignment: AssignmentSummary;
  rows: SubmissionRow[];
  onAction: (message: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [open, setOpen] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, string>>({});

  const isPending = (r: SubmissionRow) =>
    r.status === "SUBMITTED" || r.status === "UNDER_REVIEW";
  const isReviewed = (r: SubmissionRow) =>
    r.status === "APPROVED" ||
    r.status === "REJECTED" ||
    r.status === "RESUBMIT_REQUESTED";

  const groups: Record<Filter, SubmissionRow[]> = {
    ALL: rows,
    PENDING: rows.filter(isPending),
    REVIEWED: rows.filter(isReviewed),
    MISSING: rows.filter((r) => r.status === "NOT_SUBMITTED"),
  };
  const shown = groups[filter];

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 min-w-0">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Submissions
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          A representative sample of the class — {assignment.enrolledCount}{" "}
          students enrolled.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter submissions"
        className="-mx-1 mb-3 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
      >
        {(
          [
            ["PENDING", "To review", groups.PENDING.length],
            ["REVIEWED", "Reviewed", groups.REVIEWED.length],
            ["MISSING", "Not submitted", groups.MISSING.length],
            ["ALL", "All", groups.ALL.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              filter === key
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-accent",
            )}
          >
            {label}
            <span className="ml-1.5 opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          message={
            filter === "PENDING"
              ? "Nothing awaiting review."
              : "No submissions in this group."
          }
        />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {shown.map((r) => {
            const decision = decided[r.studentId];
            const status: SubmissionRow["status"] =
              decision && decision in SUBMISSION_STATUS_LABELS
                ? (decision as SubmissionRow["status"])
                : r.status;
            const expanded = open === r.studentId;
            const reviewable =
              r.status === "SUBMITTED" || r.status === "UNDER_REVIEW";

            return (
              <li key={r.studentId} className="min-w-0 py-3">
                <button
                  type="button"
                  disabled={!r.submissionId}
                  aria-expanded={r.submissionId ? expanded : undefined}
                  onClick={() => setOpen(expanded ? null : r.studentId)}
                  className="flex w-full min-w-0 items-center gap-3 rounded text-left disabled:cursor-default focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground"
                    aria-hidden="true"
                  >
                    {r.studentName.charAt(0)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {r.studentName}
                      <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                        {r.rollNo}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.submittedAt
                        ? `Submitted ${dueDateTime(r.submittedAt)}`
                        : "No submission"}
                      {r.isLate && (
                        <span className="text-destructive"> · late</span>
                      )}
                      {r.version > 1 && ` · v${r.version}`}
                    </p>
                  </div>

                  {r.score !== null && (
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                      {r.score}/{assignment.totalMarks}
                    </span>
                  )}
                  <Pill tone={SUBMISSION_STATUS_TONE[status]}>
                    {SUBMISSION_STATUS_LABELS[status].toUpperCase()}
                  </Pill>
                </button>

                {expanded && r.submissionId && (
                  <div className="mt-2.5 min-w-0">
                    {r.textResponse && (
                      <p className="rounded-field border border-border bg-background px-3.5 py-2.5 text-[12px] leading-5 text-[#334155]">
                        {r.textResponse}
                      </p>
                    )}

                    {r.files.length > 0 && (
                      <ul className="mt-2 flex min-w-0 flex-wrap gap-2">
                        {r.files.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() =>
                                onAction(
                                  "GET /storage/:key — presigned download not wired yet (Dev-B, §11.3).",
                                )
                              }
                              className="inline-flex min-w-0 items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                            >
                              <Paperclip
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate">
                                {f.fileName}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {fileSize(f.fileSizeBytes)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {r.feedback && !reviewable && (
                      <p className="mt-2 flex min-w-0 gap-2 rounded-field bg-accent-light px-3 py-2 text-[12px] leading-5 text-accent">
                        <MessageSquareQuote
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          {r.feedback}
                          {r.reviewedByName && (
                            <span className="block text-[11px] opacity-70">
                              {r.reviewedByName}
                            </span>
                          )}
                        </span>
                      </p>
                    )}

                    {reviewable && !decision && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          // `new FormData(form)` deliberately omits the submit
                          // button's name/value — the submitter has to be read
                          // off the event, or the decision comes back null.
                          const submitter = (e.nativeEvent as SubmitEvent)
                            .submitter as HTMLButtonElement | null;
                          const decisionKind = submitter?.value;
                          if (!decisionKind) return;

                          setDecided((d) => ({
                            ...d,
                            [r.studentId]: decisionKind,
                          }));
                          onAction(
                            "PATCH /assignment/submissions/:id/review — API not connected yet (Dev-B, §9.3).",
                          );
                        }}
                        className="mt-2.5 grid min-w-0 gap-2.5 rounded-field border border-border p-3"
                      >
                        <div className="flex min-w-0 flex-wrap items-end gap-2">
                          <label className="text-[11px] font-medium text-[#334155]">
                            Score
                            <input
                              name="score"
                              type="number"
                              min={0}
                              max={assignment.totalMarks}
                              step={0.5}
                              className="mt-1 block h-9 w-24 rounded-field border border-border px-2.5 text-[13px] tabular-nums focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                            />
                          </label>
                          <span className="pb-2 text-[11px] text-muted-foreground">
                            of {assignment.totalMarks}
                          </span>
                        </div>

                        <label className="min-w-0 text-[11px] font-medium text-[#334155]">
                          Feedback
                          <textarea
                            name="feedback"
                            rows={2}
                            placeholder="What was good, and what needs changing?"
                            className="mt-1 block w-full min-w-0 rounded-field border border-border px-3 py-2 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                          />
                        </label>

                        <div className="flex min-w-0 flex-wrap gap-2">
                          <Button
                            type="submit"
                            name="decision"
                            value="APPROVED"
                            className="h-9 w-auto px-4 text-[12px]"
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Approve
                          </Button>
                          <button
                            type="submit"
                            name="decision"
                            value="RESUBMIT_REQUESTED"
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                          >
                            <RotateCcw
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Ask to resubmit
                          </button>
                          <button
                            type="submit"
                            name="decision"
                            value="REJECTED"
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                            Reject
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
