"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  MessageSquareQuote,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fileSize } from "@/lib/notices";
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUS_TONE,
  canStudentAct,
  dueDateTime,
  dueLabel,
  isOverdue,
} from "@/lib/assignment";
import { Button } from "@/components/ui/button";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import { MilestoneStepper } from "./milestone-stepper";
import type { StudentAssignment, UploadPolicy } from "@/types/assignment";

/**
 * Student assignment detail — role_based_shared_pages.md PAGE 22:
 * "Assignment instructions, file upload, milestone progress stepper,
 *  submission status | Submit files, view feedback, resubmit".
 *
 * The list page (PAGE 7) shows the same assignment as a compact card; this is
 * the full-page version, so the instructions get room and the upload is a
 * first-class panel rather than a disclosure.
 */
export function StudentAssignmentDetail({
  assignment,
  policy,
  canSubmit,
  onAction,
}: {
  assignment: StudentAssignment;
  policy: UploadPolicy;
  canSubmit: boolean;
  onAction: (message: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const overdue = isOverdue(assignment.dueDate);
  const actionable = canStudentAct(assignment.status);
  const blocked = overdue && !assignment.allowLateSubmission;
  const isResubmit =
    assignment.status === "REJECTED" ||
    assignment.status === "RESUBMIT_REQUESTED";

  const accept = policy.allowedFileTypes.map((t) => `.${t}`).join(",");
  const maxBytes = policy.maxFileSizeMb * 1024 * 1024;

  /** Client-side mirror of `max_file_size_mb` / `allowed_file_types` (§7.3). */
  function addFiles(picked: File[]) {
    const rejected: string[] = [];
    const ok: File[] = [];

    for (const f of picked) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!policy.allowedFileTypes.includes(ext)) {
        rejected.push(`${f.name} — ${ext ? `.${ext}` : "no extension"} not allowed`);
      } else if (f.size > maxBytes) {
        rejected.push(`${f.name} — over ${policy.maxFileSizeMb} MB`);
      } else {
        ok.push(f);
      }
    }

    setFiles((prev) => [...prev, ...ok]);
    setError(rejected.length ? rejected.join(" · ") : null);
  }

  return (
    <div className="grid min-w-0 gap-4">
      {/* Status + due date */}
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  TONE_BG[SUBMISSION_STATUS_TONE[assignment.status]],
                  TONE_TEXT[SUBMISSION_STATUS_TONE[assignment.status]],
                )}
              >
                {SUBMISSION_STATUS_LABELS[assignment.status].toUpperCase()}
              </span>
              {assignment.version > 1 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  v{assignment.version}
                </span>
              )}
            </div>

            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 text-[12px]",
                overdue && actionable
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {dueDateTime(assignment.dueDate)} · {dueLabel(assignment.dueDate)}
            </p>

            {overdue && assignment.allowLateSubmission && actionable && (
              <p className="mt-1 text-[11px] font-medium text-warning">
                Late submissions accepted with a{" "}
                {assignment.latePenaltyPercent}% penalty.
              </p>
            )}
          </div>

          {assignment.score !== null && (
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl font-bold text-success">
                {assignment.score}
                <span className="text-base text-muted-foreground">
                  /{assignment.totalMarks}
                </span>
              </p>
              {assignment.grade && (
                <p className="text-[11px] text-muted-foreground">
                  Grade {assignment.grade}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Instructions — PAGE 22 gives these their own space */}
      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-2 font-display text-[15px] font-bold text-foreground">
          Instructions
        </h2>
        <p className="whitespace-pre-line text-[13px] leading-6 text-[#334155]">
          {assignment.description}
        </p>
        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-[12px] sm:grid-cols-4">
          {[
            ["Marks", `${assignment.totalMarks}`],
            ["Pass mark", `${assignment.passingMarks}`],
            ["Subject", assignment.subjectCode],
            ["Set by", assignment.teacherName],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Milestone progress stepper */}
      {assignment.milestones.length > 0 && (
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Your progress
          </h2>
          <MilestoneStepper milestones={assignment.milestones} />
        </Card>
      )}

      {/* Teacher feedback */}
      {assignment.feedback && (
        <Card
          className={cn(
            "min-w-0 border-l-4 p-5 sm:p-6",
            assignment.status === "APPROVED"
              ? "border-l-success"
              : "border-l-warning",
          )}
        >
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
            Teacher feedback
          </h2>
          <p className="text-[13px] leading-6 text-[#334155]">
            {assignment.feedback}
          </p>
        </Card>
      )}

      {/* Already-submitted files */}
      {assignment.files.length > 0 && (
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Your submission
          </h2>
          <ul className="flex min-w-0 flex-wrap gap-2">
            {assignment.files.map((f) => (
              <li
                key={f.id}
                className="inline-flex min-w-0 items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] text-foreground"
              >
                <Paperclip
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{f.fileName}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {fileSize(f.fileSizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Upload — PAGE 22's "file upload" as a first-class panel */}
      {canSubmit && actionable && !blocked && (
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            {isResubmit ? "Resubmit your work" : "Submit your work"}
          </h2>

          {submitted ? (
            <p className="flex min-w-0 items-center gap-2 rounded-field bg-accent-light px-3.5 py-3 text-[13px] font-medium text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Submitted — your teacher will review it shortly.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (files.length === 0) {
                  setError("Attach at least one file before submitting.");
                  return;
                }
                setError(null);
                setBusy(true);
                // TODO(Dev-B): presign → PUT to S3 → POST /assignments/:id/submissions
                await new Promise((r) => setTimeout(r, 800));
                setBusy(false);
                setSubmitted(true);
                onAction(
                  "POST /assignment/assignments/:id/submissions — API not connected yet (Dev-B, §9.3 + §11.1).",
                );
              }}
              className="grid min-w-0 gap-3"
            >
              <label className="min-w-0 text-[12px] font-medium text-[#334155]">
                Notes for your teacher{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
                <textarea
                  rows={3}
                  placeholder="Anything the reviewer should know…"
                  className="mt-1 w-full min-w-0 rounded-field border border-border px-3 py-2 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
              </label>

              <div className="min-w-0">
                <span className="text-[12px] font-medium text-[#334155]">
                  Files
                </span>
                <label className="mt-1 flex cursor-pointer flex-col items-center rounded-field border border-dashed border-[#CBD5E1] bg-background p-5 text-center transition hover:border-accent hover:bg-accent-light focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
                  <Upload
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="mt-1.5 text-[12px] text-muted-foreground">
                    Click to attach —{" "}
                    {policy.allowedFileTypes
                      .map((t) => t.toUpperCase())
                      .join(", ")}{" "}
                    up to {policy.maxFileSizeMb} MB
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={accept}
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>

                {error && (
                  <p
                    role="status"
                    className="mt-2 text-[12px] font-medium text-destructive"
                  >
                    {error}
                  </p>
                )}

                {files.length > 0 && (
                  <ul className="mt-2 min-w-0 space-y-1.5">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex min-w-0 items-center gap-2 rounded-field border border-border px-3 py-2"
                      >
                        <Paperclip
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {f.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {fileSize(f.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles(files.filter((_, j) => j !== i))
                          }
                          aria-label={`Remove ${f.name}`}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                type="submit"
                loading={busy}
                loadingText="Uploading…"
                className="w-auto justify-self-start px-5"
              >
                {isResubmit ? "Resubmit work" : "Submit work"}
              </Button>
            </form>
          )}
        </Card>
      )}

      {blocked && (
        <Card className="min-w-0 p-5 text-center sm:p-6">
          <p className="text-[13px] font-medium text-muted-foreground">
            This assignment closed on {dueDateTime(assignment.dueDate)} and no
            longer accepts submissions.
          </p>
        </Card>
      )}
    </div>
  );
}
