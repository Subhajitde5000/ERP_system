"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  MapPin,
  Play,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ATTEMPT_STATUS_LABELS,
  ATTEMPT_STATUS_TONE,
  daysUntil,
  examDateTime,
  scoreTone,
} from "@/lib/examination";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { ChildOption } from "@/types/attendance";
import type { StudentExam } from "@/types/examination";

/**
 * Student and Parent exam list — PAGE 6.
 * Same layout; the parent variant is read-only (no Attempt button) and adds a
 * child switcher, so both share this component.
 */
export function StudentExams({
  exams,
  canAttempt,
  childOptions,
  activeChildId,
  onSelectChild,
}: {
  exams: StudentExam[];
  canAttempt: boolean;
  childOptions?: ChildOption[];
  activeChildId?: string;
  onSelectChild?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"UPCOMING" | "PAST">("UPCOMING");

  const upcoming = exams.filter(
    (e) => e.status === "PUBLISHED" || e.status === "ONGOING",
  );
  const past = exams.filter(
    (e) =>
      e.status === "COMPLETED" ||
      e.status === "RESULTS_RELEASED" ||
      e.status === "CANCELLED",
  );

  const shown = tab === "UPCOMING" ? upcoming : past;

  return (
    <div className="grid min-w-0 gap-4">
      {/* Child switcher — parent with more than one child */}
      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
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

      {/* Upcoming / Past tabs */}
      <div role="tablist" aria-label="Exam period" className="flex min-w-0 flex-wrap gap-2">
        {(["UPCOMING", "PAST"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-8 rounded-full border px-4 text-xs font-medium transition",
              tab === t
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-accent",
            )}
          >
            {t === "UPCOMING" ? "Upcoming" : "Past"}
            <span className="ml-1.5 opacity-70">
              {t === "UPCOMING" ? upcoming.length : past.length}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <p className="text-[13px] text-muted-foreground">
            {tab === "UPCOMING"
              ? "No exams scheduled right now."
              : "No past exams yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shown.map((exam) => (
            <ExamRow key={exam.id} exam={exam} canAttempt={canAttempt} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamRow({
  exam,
  canAttempt,
}: {
  exam: StudentExam;
  canAttempt: boolean;
}) {
  const live = exam.status === "ONGOING";
  const released = exam.status === "RESULTS_RELEASED";
  const days = daysUntil(exam.scheduledAt);
  const passingPct = Math.round((exam.passingMarks / exam.totalMarks) * 100);

  return (
    <Card className={cn("p-5", live && "border-l-4 border-l-success")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                LIVE NOW
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[ATTEMPT_STATUS_TONE[exam.attemptStatus]],
                TONE_TEXT[ATTEMPT_STATUS_TONE[exam.attemptStatus]],
              )}
            >
              {ATTEMPT_STATUS_LABELS[exam.attemptStatus].toUpperCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {exam.mode === "ONLINE" ? (
                <Globe className="h-2.5 w-2.5" aria-hidden="true" />
              ) : (
                <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              {exam.mode}
            </span>
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            {exam.title}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            <span className="font-mono">{exam.subjectCode}</span> ·{" "}
            {exam.totalMarks} marks · pass {exam.passingMarks}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {examDateTime(exam.scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {exam.durationMinutes} minutes
            </span>
            {!live && days > 0 && (
              <span className={cn(days <= 2 && "font-medium text-warning")}>
                in {days} day{days === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {/* Score, or the attempt action */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {released && exam.percentage !== null ? (
            <div className="text-right">
              <p
                className={cn(
                  "font-display text-xl font-bold",
                  TONE_TEXT[scoreTone(exam.percentage, passingPct)],
                )}
              >
                {exam.score}/{exam.totalMarks}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {exam.percentage}% · Grade {exam.grade}
              </p>
              {exam.allowReview && (
                <Link
                  href={`/examination/${exam.id}`}
                  className="mt-1.5 inline-flex items-center gap-1 rounded text-[12px] font-medium text-accent hover:text-accent-hover"
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  Review
                </Link>
              )}
            </div>
          ) : live && canAttempt && exam.attemptStatus === "NOT_STARTED" ? (
            <Link
              href={`/examination/${exam.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Start exam
            </Link>
          ) : exam.attemptStatus === "SUBMITTED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-field bg-accent-light px-3 py-2 text-[12px] font-medium text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Awaiting results
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
