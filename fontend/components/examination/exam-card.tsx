import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  DoorOpen,
  Globe,
  MapPin,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  EXAM_STATUS_LABELS,
  EXAM_STATUS_TONE,
  examDateTime,
  nextAction,
} from "@/lib/examination";
import { Card, ProgressBar, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { ExamPermissions, ExamSummary } from "@/types/examination";

/**
 * Exam row — shared by the author, control, department and institution views
 * (PAGE 6). Which meta and actions appear is driven by `perms`, so one card
 * serves four roles instead of four near-identical components.
 */
export function ExamCard({
  exam,
  perms,
  /** Show department + author — used by the institution-wide views */
  showOwner = false,
}: {
  exam: ExamSummary;
  perms: ExamPermissions;
  showOwner?: boolean;
}) {
  const action = nextAction(exam.status, perms);
  const live = exam.status === "ONGOING";
  const needsHalls =
    exam.mode === "OFFLINE" && exam.hallsAllocated < exam.hallsRequired;

  return (
    <Card
      className={cn(
        "p-5",
        live && "border-l-4 border-l-success",
        exam.status === "DRAFT" && "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Status + type badges */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[EXAM_STATUS_TONE[exam.status]],
                TONE_TEXT[EXAM_STATUS_TONE[exam.status]],
              )}
            >
              {live && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
              )}
              {EXAM_STATUS_LABELS[exam.status].toUpperCase()}
            </span>

            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {exam.examType}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {exam.mode === "ONLINE" ? (
                <Globe className="h-2.5 w-2.5" aria-hidden="true" />
              ) : (
                <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              {exam.mode}
            </span>

            {exam.malpracticeFlags > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                {exam.malpracticeFlags} flag
                {exam.malpracticeFlags === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            <Link
              href={`/examination/${exam.id}`}
              className="rounded transition-colors hover:text-accent"
            >
              {exam.title}
            </Link>
          </h3>

          <p className="mt-1 text-[12px] text-muted-foreground">
            <span className="font-mono">{exam.subjectCode}</span> ·{" "}
            {exam.className}
            {showOwner && ` · ${exam.departmentName} · ${exam.createdBy}`}
          </p>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {examDateTime(exam.scheduledAt)} · {exam.durationMinutes}m
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardList className="h-3 w-3" aria-hidden="true" />
              {exam.questionCount} questions · {exam.totalMarks} marks
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {exam.enrolledCount} students
            </span>
            {exam.mode === "OFFLINE" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  needsHalls && "font-medium text-warning",
                )}
              >
                <DoorOpen className="h-3 w-3" aria-hidden="true" />
                {exam.hallsAllocated}/{exam.hallsRequired} halls
              </span>
            )}
          </div>

          {/* Submission progress once the exam is live or done */}
          {(live || exam.status === "COMPLETED") && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  {exam.submittedCount}/{exam.enrolledCount} submitted
                  {exam.gradedCount > 0 && ` · ${exam.gradedCount} graded`}
                </span>
                <span className="font-semibold text-accent">
                  {Math.round((exam.submittedCount / exam.enrolledCount) * 100)}%
                </span>
              </div>
              <ProgressBar
                value={exam.submittedCount}
                max={exam.enrolledCount}
              />
            </div>
          )}
        </div>

        {/* Lifecycle action — publish / release (dev doc §9.2) */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {action && (
            <Link
              href={`/examination/${exam.id}`}
              className="inline-flex h-9 items-center rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              {action.label}
            </Link>
          )}
          {perms.canSchedule && needsHalls && (
            <Link
              href={`/examination/${exam.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-field border border-warning bg-warning-light px-3 text-[12px] font-medium text-[#B45309] transition-colors hover:bg-[#FEF3C7]"
            >
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Allocate halls
            </Link>
          )}
          {live && perms.canCompile && (
            <Link
              href={`/examination/${exam.id}`}
              className="inline-flex h-9 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
            >
              Monitor
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
