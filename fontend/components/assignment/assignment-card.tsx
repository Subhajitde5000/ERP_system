import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  Layers,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TONE,
  dueDateTime,
  dueLabel,
  isOverdue,
  nextAssignmentAction,
} from "@/lib/assignment";
import {
  Card,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  AssignmentPermissions,
  AssignmentSummary,
} from "@/types/assignment";

/**
 * Assignment row — shared by the author, department and institution views
 * (PAGE 7). Actions come from `perms`, so one card serves three roles.
 */
export function AssignmentCard({
  assignment,
  perms,
  /** Show teacher + department — used by HOD and institution views */
  showOwner = false,
}: {
  assignment: AssignmentSummary;
  perms: AssignmentPermissions;
  showOwner?: boolean;
}) {
  const action = nextAssignmentAction(assignment.status, perms);
  const overdue =
    assignment.status === "PUBLISHED" && isOverdue(assignment.dueDate);
  const needsReview = assignment.pendingReview > 0;

  return (
    <Card
      className={cn(
        "min-w-0 p-5",
        needsReview && perms.canReview && "border-l-4 border-l-warning",
        assignment.status === "DRAFT" && "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[ASSIGNMENT_STATUS_TONE[assignment.status]],
                TONE_TEXT[ASSIGNMENT_STATUS_TONE[assignment.status]],
              )}
            >
              {ASSIGNMENT_STATUS_LABELS[assignment.status].toUpperCase()}
            </span>

            {assignment.type !== "REGULAR" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary-light px-2 py-0.5 text-[10px] font-medium text-secondary">
                <Layers className="h-2.5 w-2.5" aria-hidden="true" />
                {assignment.type === "MILESTONE"
                  ? `${assignment.milestoneCount} MILESTONES`
                  : "GROUP"}
              </span>
            )}

            {overdue && (
              <span className="rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-semibold text-destructive">
                PAST DUE
              </span>
            )}

            {needsReview && perms.canReview && (
              <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                {assignment.pendingReview} TO REVIEW
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            <Link
              href={`/assignments/${assignment.id}`}
              className="rounded transition-colors hover:text-accent"
            >
              {assignment.title}
            </Link>
          </h3>

          <p className="mt-1 text-[12px] text-muted-foreground">
            <span className="font-mono">{assignment.subjectCode}</span> ·{" "}
            {assignment.className}
            {showOwner && ` · ${assignment.departmentName} · ${assignment.teacherName}`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-medium text-destructive",
              )}
            >
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {dueDateTime(assignment.dueDate)}
              {assignment.status === "PUBLISHED" &&
                ` · ${dueLabel(assignment.dueDate)}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
              {assignment.totalMarks} marks
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {assignment.enrolledCount} students
            </span>
          </div>

          {/* Submission + review progress */}
          {assignment.status !== "DRAFT" && (
            <div className="mt-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  {assignment.submittedCount}/{assignment.enrolledCount}{" "}
                  submitted · {assignment.reviewedCount} reviewed
                </span>
                <span className="font-semibold text-accent">
                  {Math.round(
                    (assignment.submittedCount / assignment.enrolledCount) * 100,
                  )}
                  %
                </span>
              </div>
              <ProgressBar
                value={assignment.submittedCount}
                max={assignment.enrolledCount}
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {needsReview && perms.canReview && (
            <Link
              href={`/assignments/${assignment.id}`}
              className="inline-flex h-9 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              Review {assignment.pendingReview}
            </Link>
          )}
          {action && (
            <Link
              href={`/assignments/${assignment.id}`}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
            >
              {action.label}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
