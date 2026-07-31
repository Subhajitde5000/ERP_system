import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { loadTone } from "@/lib/assignment";
import {
  Card,
  ProgressBar,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  DepartmentAssignmentSummary,
  TeacherLoad,
} from "@/types/assignment";

/**
 * HOD — pending review count per teacher (PAGE 7).
 * Sits above the department assignment list so the bottleneck is obvious.
 */
export function TeacherReviewLoad({ loads }: { loads: TeacherLoad[] }) {
  const total = loads.reduce((a, t) => a + t.pendingReview, 0);
  const stale = loads.filter((t) => t.oldestPendingDays >= 7);

  return (
    <div className="grid min-w-0 gap-4">
      {stale.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-[#FDE68A] bg-warning-light p-4">
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[#92400E]">
            {stale.map((t) => t.teacherName).join(", ")}{" "}
            {stale.length === 1 ? "has" : "have"} submissions waiting more than
            a week.
          </p>
        </div>
      )}

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Review load by teacher
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {total} awaiting review
          </span>
        </div>

        <ul className="divide-y divide-border border-t border-border">
          {loads.map((t) => (
            <li key={t.teacherId} className="flex min-w-0 items-center gap-3 py-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground"
                aria-hidden="true"
              >
                {t.teacherName.charAt(0)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {t.teacherName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.subjectCodes.join(" · ")} · {t.assignmentCount} assignment
                  {t.assignmentCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "text-[15px] font-bold tabular-nums",
                    TONE_TEXT[loadTone(t.pendingReview)],
                  )}
                >
                  {t.pendingReview}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.pendingReview === 0
                    ? "clear"
                    : `oldest ${t.oldestPendingDays}d`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Principal / VP — institution-wide assignment summary (PAGE 7). */
export function InstitutionAssignmentSummary({
  data,
}: {
  data: DepartmentAssignmentSummary[];
}) {
  const totalAssignments = data.reduce((a, d) => a + d.assignmentCount, 0);
  const totalPending = data.reduce((a, d) => a + d.pendingReview, 0);
  const totalOverdue = data.reduce((a, d) => a + d.overdueCount, 0);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Active assignments
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {totalAssignments}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Awaiting review
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-warning">
            {totalPending}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Overdue
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-destructive">
            {totalOverdue}
          </p>
        </Card>
      </div>

      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="mb-4 font-display text-[15px] font-bold text-foreground">
          Submission rate by department
        </h2>
        <ul className="space-y-4">
          {data.map((d) => (
            <li key={d.departmentId}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">
                  {d.departmentName}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {d.assignmentCount} assignments · {d.pendingReview} to review
                    {d.overdueCount > 0 && ` · ${d.overdueCount} overdue`}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[13px] font-bold tabular-nums",
                    d.submissionRate < 75
                      ? "text-destructive"
                      : d.submissionRate < 85
                        ? "text-warning"
                        : "text-success",
                  )}
                >
                  {d.submissionRate}%
                </span>
              </div>
              <ProgressBar
                value={d.submissionRate}
                tone={
                  d.submissionRate < 75
                    ? "danger"
                    : d.submissionRate < 85
                      ? "warning"
                      : "success"
                }
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
