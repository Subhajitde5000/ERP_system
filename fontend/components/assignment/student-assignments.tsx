"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Layers,
  Lock,
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
import { FormAlert } from "@/components/auth/form-alert";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { ChildOption } from "@/types/attendance";
import type { Milestone, StudentAssignment } from "@/types/assignment";

/**
 * Student and Parent assignment list — PAGE 7.
 * Same layout; the parent variant is read-only (no submit) and adds a child
 * switcher, so both share this component.
 */
export function StudentAssignments({
  assignments,
  canSubmit,
  childOptions,
  activeChildId,
  onSelectChild,
}: {
  assignments: StudentAssignment[];
  canSubmit: boolean;
  childOptions?: ChildOption[];
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"PENDING" | "SUBMITTED" | "APPROVED">(
    "PENDING",
  );
  const [status, setStatus] = useState<string | null>(null);

  const pending = assignments.filter((a) => canStudentAct(a.status));
  const submitted = assignments.filter(
    (a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW",
  );
  const approved = assignments.filter((a) => a.status === "APPROVED");

  const groups = { PENDING: pending, SUBMITTED: submitted, APPROVED: approved };
  const shown = groups[tab];

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {childOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectChild?.(c.id)}
              aria-pressed={c.id === activeChildId}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition",
                c.id === activeChildId
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-70">{c.className}</span>
            </button>
          ))}
        </div>
      )}

      {/* Pending / Submitted / Approved (PAGE 7) */}
      <div
        role="tablist"
        aria-label="Assignment status"
        className="flex min-w-0 flex-wrap gap-2"
      >
        {(
          [
            ["PENDING", "Pending", pending.length],
            ["SUBMITTED", "Submitted", submitted.length],
            ["APPROVED", "Approved", approved.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-8 rounded-full border px-4 text-xs font-medium transition",
              tab === key
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
        <Card className="border-dashed py-14 text-center">
          <p className="text-[13px] text-muted-foreground">
            {tab === "PENDING"
              ? "Nothing pending — you're all caught up 🎉"
              : tab === "SUBMITTED"
                ? "Nothing awaiting review."
                : "No approved assignments yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shown.map((a) => (
            <StudentRow
              key={a.id}
              assignment={a}
              canSubmit={canSubmit}
              onSubmitted={() =>
                setStatus(
                  "Assignment API not connected yet — see lib/assignment-data.ts (Dev-B, §9.3).",
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({
  assignment,
  canSubmit,
  onSubmitted,
}: {
  assignment: StudentAssignment;
  canSubmit: boolean;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const overdue = isOverdue(assignment.dueDate);
  const actionable = canStudentAct(assignment.status);
  const blocked = overdue && !assignment.allowLateSubmission;
  const isResubmit =
    assignment.status === "REJECTED" ||
    assignment.status === "RESUBMIT_REQUESTED";

  return (
    <Card
      className={cn(
        "min-w-0 p-5",
        assignment.status === "RESUBMIT_REQUESTED" &&
          "border-l-4 border-l-warning",
        assignment.status === "APPROVED" && "border-l-4 border-l-success",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[SUBMISSION_STATUS_TONE[assignment.status]],
                TONE_TEXT[SUBMISSION_STATUS_TONE[assignment.status]],
              )}
            >
              {SUBMISSION_STATUS_LABELS[assignment.status].toUpperCase()}
            </span>
            {assignment.type === "MILESTONE" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-light px-2 py-0.5 text-[10px] font-medium text-secondary">
                <Layers className="h-2.5 w-2.5" aria-hidden="true" />
                {assignment.milestones.length} MILESTONES
              </span>
            )}
            {assignment.version > 1 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                v{assignment.version}
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            {assignment.title}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            <span className="font-mono">{assignment.subjectCode}</span> ·{" "}
            {assignment.teacherName} · {assignment.totalMarks} marks
          </p>

          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px]",
              overdue && actionable
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {dueDateTime(assignment.dueDate)} · {dueLabel(assignment.dueDate)}
            {overdue && assignment.allowLateSubmission && actionable && (
              <span className="text-warning">
                {" "}
                · late penalty {assignment.latePenaltyPercent}%
              </span>
            )}
          </p>
        </div>

        {/* Score, or the submit action */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {assignment.score !== null ? (
            <div className="text-right">
              <p className="font-display text-xl font-bold text-success">
                {assignment.score}/{assignment.totalMarks}
              </p>
              {assignment.grade && (
                <p className="text-[11px] text-muted-foreground">
                  Grade {assignment.grade}
                </p>
              )}
            </div>
          ) : (
            canSubmit &&
            actionable &&
            !blocked && (
              <Button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="h-9 w-auto px-3.5 text-[12px]"
              >
                {isResubmit ? "Resubmit" : "Submit"}
              </Button>
            )
          )}
          {blocked && (
            <span className="rounded-field bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
              Closed for submission
            </span>
          )}
        </div>
      </div>

      {/* Teacher feedback (PAGE 7 — "view feedback") */}
      {assignment.feedback && (
        <div
          className={cn(
            "mt-4 rounded-field border p-3",
            assignment.status === "APPROVED"
              ? "border-[#A7F3D0] bg-success-light"
              : "border-[#FDE68A] bg-warning-light",
          )}
        >
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareQuote className="h-3 w-3" aria-hidden="true" />
            Teacher feedback
          </p>
          <p className="text-[13px] leading-6 text-[#334155]">
            {assignment.feedback}
          </p>
        </div>
      )}

      {/* Submitted files */}
      {assignment.files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {assignment.files.map((f) => (
            <li
              key={f.id}
              className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] text-foreground"
            >
              <Paperclip
                className="h-3 w-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{f.fileName}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {fileSize(f.fileSizeBytes)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Milestone chain — locked stages unlock on approval (dev doc §9.3) */}
      {assignment.milestones.length > 0 && (
        <ol className="mt-4 divide-y divide-border border-t border-border">
          {assignment.milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} />
          ))}
        </ol>
      )}

      {/* Submission form */}
      {open && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            // TODO(Dev-B): presign → PUT to S3 → POST /assignments/:id/submissions
            await new Promise((r) => setTimeout(r, 800));
            setBusy(false);
            setOpen(false);
            onSubmitted();
          }}
          className="mt-4 grid gap-3 rounded-field border border-border p-4"
        >
          <label className="text-[12px] font-medium text-[#334155]">
            Notes for your teacher{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              rows={2}
              placeholder="Anything the reviewer should know…"
              className="mt-1 w-full rounded-field border border-border px-3 py-2 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
          </label>

          <div>
            <span className="text-[12px] font-medium text-[#334155]">Files</span>
            <label
              className={cn(
                "mt-1 flex cursor-pointer flex-col items-center rounded-field border border-dashed border-[#CBD5E1] bg-background p-4 text-center transition hover:border-accent hover:bg-accent-light",
              )}
            >
              <Upload
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="mt-1.5 text-[12px] text-muted-foreground">
                Click to attach — PDF, DOC, ZIP up to 10 MB
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.zip"
                onChange={(e) => {
                  setFiles([...files, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
                className="sr-only"
              />
            </label>

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-field border border-border px-3 py-2"
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
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-[#475569] hover:bg-background"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={busy}
              loadingText="Uploading…"
              className="h-9 w-auto px-4 text-[12px]"
            >
              {isResubmit ? "Resubmit work" : "Submit work"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function MilestoneRow({ milestone }: { milestone: Milestone }) {
  const done = milestone.status === "APPROVED";

  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          done
            ? "bg-success text-white"
            : milestone.isLocked
              ? "bg-muted text-[#94A3B8]"
              : "bg-accent-light text-accent",
        )}
        aria-hidden="true"
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : milestone.isLocked ? (
          <Lock className="h-3 w-3" />
        ) : (
          milestone.sortOrder
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13px] font-medium",
            milestone.isLocked ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {milestone.title}
        </p>
        {milestone.dueDate && (
          <p className="text-[11px] text-muted-foreground">
            {milestone.marks} marks · {dueDateTime(milestone.dueDate)}
          </p>
        )}
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          milestone.isLocked
            ? "bg-muted text-muted-foreground"
            : cn(
                TONE_BG[SUBMISSION_STATUS_TONE[milestone.status]],
                TONE_TEXT[SUBMISSION_STATUS_TONE[milestone.status]],
              ),
        )}
      >
        {milestone.isLocked
          ? "LOCKED"
          : SUBMISSION_STATUS_LABELS[milestone.status]}
      </span>
    </li>
  );
}
