"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Layers, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TONE,
  canEditMilestoneChain,
  dueDateTime,
  dueLabel,
  nextAssignmentAction,
} from "@/lib/assignment";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  AssignmentProgressPanel,
  MilestoneListPanel,
  SubmissionTablePanel,
} from "./detail-panels";
import { StudentAssignmentDetail } from "./student-detail-panel";
import type {
  AssignmentDetail as AssignmentDetailData,
  AssignmentPermissions,
} from "@/types/assignment";

/**
 * Assignment detail — role_based_shared_pages.md PAGE 22 (C-RB-22).
 *
 * "One URL. Two experiences." — plus the HOD's read-only overview:
 *
 *   Teacher → info · milestone list · per-student submission table
 *   Student → instructions · upload · milestone stepper · status
 *   HOD     → submissions overview + completion rate, view only
 *
 * The view kind is resolved server-side by `assignmentPermissions()`; this
 * component dispatches on it and never branches on a role name.
 */
export function AssignmentDetail({
  detail,
  perms,
}: {
  detail: AssignmentDetailData;
  perms: AssignmentPermissions;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { summary, milestones, uploadPolicy, submissions, progress, own } =
    detail;

  const action = nextAssignmentAction(summary.status, perms);
  const isStudentSide = perms.view === "SUBMIT" || perms.view === "CHILD";
  const milestonesEditable = canEditMilestoneChain(summary, perms);

  async function runAction(label: string) {
    setBusy(true);
    // TODO(Dev-B): PATCH /assignment/assignments/:id/publish | /close
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    setStatus(
      `${label} — API not connected yet, see lib/assignment-data.ts (Dev-B, §9.3).`,
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/assignments"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Assignments
      </Link>

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      {/* Shared header — the assignment info every role sees */}
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Lifecycle status is the author's concern, not the taker's */}
              {!isStudentSide && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    TONE_BG[ASSIGNMENT_STATUS_TONE[summary.status]],
                    TONE_TEXT[ASSIGNMENT_STATUS_TONE[summary.status]],
                  )}
                >
                  {ASSIGNMENT_STATUS_LABELS[summary.status].toUpperCase()}
                </span>
              )}
              {summary.type === "MILESTONE" && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-light px-2 py-0.5 text-[10px] font-medium text-secondary">
                  <Layers className="h-2.5 w-2.5" aria-hidden="true" />
                  {milestones.length} MILESTONES
                </span>
              )}
            </div>

            <h1 className="mt-2 font-display text-[20px] font-bold leading-tight text-foreground">
              {summary.title}
            </h1>

            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-mono">{summary.subjectCode}</span> ·{" "}
              {summary.className} · {summary.totalMarks} marks · pass{" "}
              {summary.passingMarks}
            </p>

            {/* The student's status card carries its own due line with the
                late-penalty note, so the header shows it for staff only. */}
            {!isStudentSide && (
              <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {dueDateTime(summary.dueDate)} · {dueLabel(summary.dueDate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {summary.enrolledCount} students
                </span>
              </p>
            )}
          </div>

          {action && (
            <Button
              type="button"
              loading={busy}
              loadingText="Working…"
              onClick={() => runAction(action.label)}
              className="w-auto shrink-0 px-4"
            >
              {action.label}
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-4 grid min-w-0 gap-4">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    /* ── Student / Parent ─────────────────────────────────────────────── */
    if (isStudentSide && own) {
      return (
        <StudentAssignmentDetail
          assignment={own}
          policy={uploadPolicy}
          // Parents read, never submit
          canSubmit={perms.canSubmit}
          onAction={setStatus}
        />
      );
    }

    /* ── Teacher ──────────────────────────────────────────────────────── */
    if (perms.canReview && submissions) {
      return (
        <>
          {progress && (
            <AssignmentProgressPanel
              assignment={summary}
              progress={progress}
            />
          )}
          {milestones.length > 0 && (
            <MilestoneListPanel
              milestones={milestones}
              editable={milestonesEditable}
              lockReason={
                summary.status === "CLOSED"
                  ? "Assignment closed"
                  : "Locked — work submitted"
              }
              canReview={perms.canReview}
              onAction={setStatus}
            />
          )}
          <SubmissionTablePanel
            assignment={summary}
            rows={submissions}
            onAction={setStatus}
          />
        </>
      );
    }

    /* ── HOD / Principal / VP / Admin — read-only overview ────────────── */
    if (progress) {
      return (
        <>
          <AssignmentProgressPanel assignment={summary} progress={progress} />
          <Card className="min-w-0 p-5 sm:p-6">
            <h2 className="mb-2 font-display text-[15px] font-bold text-foreground">
              Assignment brief
            </h2>
            <p className="whitespace-pre-line text-[13px] leading-6 text-[#334155]">
              {summary.description}
            </p>
            <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
              Set by{" "}
              <span className="font-medium text-foreground">
                {summary.teacherName}
              </span>{" "}
              · {summary.departmentName}
            </p>
          </Card>
          {milestones.length > 0 && (
            <MilestoneListPanel
              milestones={milestones}
              editable={false}
              lockReason={null}
              canReview={false}
              onAction={setStatus}
            />
          )}
        </>
      );
    }

    return null;
  }
}
