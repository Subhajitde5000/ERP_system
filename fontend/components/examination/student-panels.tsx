"use client";

import { AlertTriangle, CheckCircle2, Clock, Play, Send, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ATTEMPT_STATUS_LABELS,
  ATTEMPT_STATUS_TONE,
  examDateTime,
  scoreTone,
} from "@/lib/examination";
import { Button } from "@/components/ui/button";
import {
  Card,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { SubmittedNotice } from "./attempt-screen";
import type {
  ExamSummary,
  ReviewedAnswer,
  StudentExam,
} from "@/types/examination";

/**
 * Student panels — role_based_shared_pages.md PAGE 21:
 * "Exam attempt interface (full screen, timed) OR result view (if completed)".
 *
 * This file covers everything *outside* the attempt overlay: the pre-exam
 * briefing that launches it, and the result view once results are released.
 */

/* ── Briefing / launch ──────────────────────────────────────────────────── */

export function ExamBriefingPanel({
  exam,
  studentExam,
  state,
  canAttempt,
  busy,
  submitted,
  onStart,
}: {
  exam: ExamSummary;
  studentExam: StudentExam | null;
  state: "CAN_START" | "RESUME" | "SUBMITTED" | "RESULT" | "WAITING";
  canAttempt: boolean;
  busy: boolean;
  submitted: "MANUAL" | "TIMER" | null;
  onStart: () => void;
}) {
  const attempt = studentExam?.attemptStatus ?? "NOT_STARTED";
  // A parent is read-only (PAGE 21 lists the attempt interface under Student
  // only), so they get the exam's details — never "ready to begin" or the
  // rules addressed to the person sitting it.
  const live = canAttempt && (state === "CAN_START" || state === "RESUME");

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          {live ? "Ready to begin" : "Exam details"}
        </h2>
        {studentExam && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TONE_BG[ATTEMPT_STATUS_TONE[attempt]],
              TONE_TEXT[ATTEMPT_STATUS_TONE[attempt]],
            )}
          >
            {ATTEMPT_STATUS_LABELS[attempt].toUpperCase()}
          </span>
        )}
      </div>

      {state === "WAITING" && (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Opens {examDateTime(exam.scheduledAt)}.
        </p>
      )}

      {canAttempt ? (
        /* Rules, addressed to the candidate */
        <ul className="mt-4 min-w-0 space-y-2 border-t border-border pt-4 text-[13px] leading-6 text-[#334155]">
          <li className="flex min-w-0 gap-2">
            <Clock
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0">
              You have <strong>{exam.durationMinutes} minutes</strong> once you
              start. The timer runs server-side and cannot be paused.
            </span>
          </li>
          <li className="flex min-w-0 gap-2">
            <AlertTriangle
              className="mt-1 h-4 w-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <span className="min-w-0">
              Switching tabs is recorded. Repeated switches are flagged for
              review.
            </span>
          </li>
          <li className="flex min-w-0 gap-2">
            <Send
              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0">
              Your answers submit automatically when the timer expires.
            </span>
          </li>
        </ul>
      ) : (
        /* Parent — the facts about the exam, nothing to act on */
        <dl className="mt-4 min-w-0 divide-y divide-border border-t border-border">
          {[
            ["Subject", `${exam.subjectCode} · ${exam.subjectName}`],
            ["Starts", examDateTime(exam.scheduledAt)],
            ["Duration", `${exam.durationMinutes} minutes`],
            ["Marks", `${exam.totalMarks} total · pass ${exam.passingMarks}`],
            ["Mode", exam.mode === "ONLINE" ? "Online" : "Offline"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <dt className="text-[13px] text-muted-foreground">{label}</dt>
              <dd className="text-right text-[13px] font-medium text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {submitted ? (
        <SubmittedNotice auto={submitted === "TIMER"} />
      ) : (
        <>
          {live && canAttempt && (
            <Button
              type="button"
              loading={busy}
              loadingText="Opening…"
              onClick={onStart}
              className="mt-5"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {state === "RESUME" ? "Resume exam" : "Start exam"}
            </Button>
          )}

          {state === "SUBMITTED" && (
            <p className="mt-5 flex min-w-0 items-center gap-2 rounded-field bg-accent-light px-3.5 py-3 text-[13px] font-medium text-accent">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Submitted — results will appear once released.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/* ── Result view ────────────────────────────────────────────────────────── */

/**
 * PAGE 21's "result view (if completed)". The per-question breakdown renders
 * only when the exam has `allow_review`; otherwise the student sees the score
 * alone, which is what `exams.allow_review` is for (DB §7.2).
 */
export function ExamResultPanel({
  studentExam,
  answers,
}: {
  studentExam: StudentExam;
  answers: ReviewedAnswer[];
}) {
  const passPct = Math.round(
    (studentExam.passingMarks / studentExam.totalMarks) * 100,
  );
  const pct = studentExam.percentage ?? 0;
  const passed = pct >= passPct;

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 text-center sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Your score
        </p>
        <p className="mt-2 font-display text-4xl font-bold text-foreground">
          {studentExam.score}
          <span className="text-xl text-muted-foreground">
            /{studentExam.totalMarks}
          </span>
        </p>
        <p
          className={cn(
            "mt-1 text-[13px] font-semibold",
            TONE_TEXT[scoreTone(pct, passPct)],
          )}
        >
          {pct}% · Grade {studentExam.grade}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[12px] font-medium text-muted-foreground">
          {passed ? (
            <>
              <CheckCircle2
                className="h-3.5 w-3.5 text-success"
                aria-hidden="true"
              />
              Passed — {passPct}% required
            </>
          ) : (
            <>
              <XCircle
                className="h-3.5 w-3.5 text-destructive"
                aria-hidden="true"
              />
              Below the {passPct}% pass mark
            </>
          )}
        </p>
      </Card>

      {studentExam.allowReview && answers.length > 0 && (
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Answer review
          </h2>

          <ol className="min-w-0 divide-y divide-border border-t border-border">
            {answers.map((a, i) => {
              const correct =
                a.correctOptionId !== null &&
                a.selectedOptionId === a.correctOptionId;
              const attempted =
                a.selectedOptionId !== null || Boolean(a.textAnswer);

              return (
                <li key={a.questionId} className="min-w-0 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        a.score === null
                          ? "bg-muted text-muted-foreground"
                          : a.score > 0
                            ? "bg-success-light text-success"
                            : "bg-destructive-light text-destructive",
                      )}
                    >
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-6 text-foreground">
                        {a.questionText}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {a.score ?? 0} of {a.maxMarks} mark
                        {a.maxMarks === 1 ? "" : "s"}
                        {!attempted && " · not attempted"}
                      </p>

                      {a.options.length > 0 && (
                        <ul className="mt-2.5 grid min-w-0 gap-1.5 sm:grid-cols-2">
                          {a.options.map((o) => {
                            const picked = o.id === a.selectedOptionId;
                            const isKey = o.id === a.correctOptionId;
                            return (
                              <li
                                key={o.id}
                                className={cn(
                                  "flex min-w-0 items-center gap-2 rounded-field border px-2.5 py-1.5 text-[12px]",
                                  isKey
                                    ? "border-success bg-success-light text-[#047857]"
                                    : picked
                                      ? "border-destructive bg-destructive-light text-destructive"
                                      : "border-border text-[#475569]",
                                )}
                              >
                                {isKey && (
                                  <CheckCircle2
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-label="Correct answer"
                                  />
                                )}
                                {picked && !isKey && (
                                  <XCircle
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-label="Your answer"
                                  />
                                )}
                                <span className="min-w-0">{o.text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {a.textAnswer && (
                        <p className="mt-2 rounded-field border border-border bg-background px-3 py-2 text-[12px] leading-5 text-[#334155]">
                          {a.textAnswer}
                        </p>
                      )}

                      {a.feedback && (
                        <p className="mt-2 rounded-field bg-accent-light px-3 py-2 text-[12px] leading-5 text-accent">
                          {a.feedback}
                        </p>
                      )}

                      {a.explanation && !correct && (
                        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                          {a.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
