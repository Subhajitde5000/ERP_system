"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ListChecks, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  EXAM_STATUS_LABELS,
  EXAM_STATUS_TONE,
  attemptState,
  canEditExam,
  examDateTime,
  nextAction,
} from "@/lib/examination";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import { AttemptScreen } from "./attempt-screen";
import { QuestionItems } from "./question-items";
import {
  ExamSettingsPanel,
  GradingQueuePanel,
  QuestionEditorPanel,
  SubmissionStatsPanel,
} from "./teacher-panels";
import {
  HallAllocationPanel,
  LiveMonitorPanel,
  MalpracticePanel,
} from "./controller-panels";
import { ExamBriefingPanel, ExamResultPanel } from "./student-panels";
import type {
  AttemptSession,
  DescriptiveAnswer,
  ExamPermissions,
  ExamSection,
  ExamSettings,
  ExamSummary,
  GradeBand,
  HallAllocation,
  LiveAttempt,
  MalpracticeLog,
  Question,
  ReviewedAnswer,
  StudentExam,
  SubmissionStats,
} from "@/types/examination";

/**
 * Exam detail — role_based_shared_pages.md PAGE 21 (C-RB-21).
 *
 * "One URL. Three completely different experiences."
 *
 *   Teacher         → question editor · settings · submission stats · grading
 *   Exam Controller → metadata · hall allocation · live monitor · malpractice
 *   Student         → full-screen timed attempt, OR the result view
 *   HOD / Principal → details · submission summary · result summary (read-only)
 *
 * The view kind is resolved server-side by `examPermissions()`; this component
 * only dispatches on it and never branches on a role name.
 */
export function ExamDetail({
  exam,
  studentExam,
  questions,
  sections,
  settings,
  stats,
  bands,
  descriptive,
  attempts,
  halls,
  malpractice,
  attemptSession,
  reviewedAnswers,
  perms,
}: {
  exam: ExamSummary;
  studentExam: StudentExam | null;
  questions: Question[];
  sections: ExamSection[];
  settings: ExamSettings;
  stats: SubmissionStats;
  bands: GradeBand[];
  descriptive: DescriptiveAnswer[];
  attempts: LiveAttempt[];
  halls: HallAllocation[];
  malpractice: MalpracticeLog[];
  attemptSession: AttemptSession | null;
  reviewedAnswers: ReviewedAnswer[];
  perms: ExamPermissions;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempting, setAttempting] = useState(false);
  const [submitted, setSubmitted] = useState<"MANUAL" | "TIMER" | null>(null);

  const action = nextAction(exam.status, perms);
  const editable = canEditExam(exam.status, perms);
  const isStudentSide = perms.view === "TAKE" || perms.view === "CHILD";
  const state = attemptState(
    exam.status,
    studentExam?.attemptStatus ?? "NOT_STARTED",
  );

  async function runAction(label: string) {
    setBusy(true);
    // TODO(Dev-B): POST /examination/exams/:id/publish | /results/release
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    setStatus(
      `${label} — API not connected yet, see lib/examination-data.ts (Dev-B, §9.2).`,
    );
  }

  // Full-screen attempt takes over the whole viewport (PAGE 21)
  if (attempting && attemptSession) {
    return (
      <AttemptScreen
        session={attemptSession}
        examTitle={exam.title}
        totalMarks={exam.totalMarks}
        onExit={() => setAttempting(false)}
        onSubmit={(reason) => {
          setAttempting(false);
          setSubmitted(reason);
          // TODO(Dev-B): PATCH /examination/attempts/:id/submit
          setStatus(
            reason === "TIMER"
              ? "Timer expired — auto-submit not connected yet (Dev-B, §9.2)."
              : "Submit — API not connected yet (Dev-B, §9.2).",
          );
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/examination"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Examination
      </Link>

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      {/* Shared header — the one thing every role sees identically */}
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                TONE_BG[EXAM_STATUS_TONE[exam.status]],
                TONE_TEXT[EXAM_STATUS_TONE[exam.status]],
              )}
            >
              {EXAM_STATUS_LABELS[exam.status].toUpperCase()}
            </span>

            <h1 className="mt-2 font-display text-[20px] font-bold leading-tight text-foreground">
              {exam.title}
            </h1>

            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-mono">{exam.subjectCode}</span> ·{" "}
              {exam.className} · {exam.totalMarks} marks · pass{" "}
              {exam.passingMarks}
            </p>

            <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {examDateTime(exam.scheduledAt)} · {exam.durationMinutes}m
              </span>
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3 w-3" aria-hidden="true" />
                {exam.questionCount} questions
              </span>
              {/* Enrolment is meaningless to the taker, useful to everyone else */}
              {!isStudentSide && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {exam.enrolledCount} candidates
                </span>
              )}
            </p>
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
    if (isStudentSide) {
      // "OR result view (if completed)"
      if (state === "RESULT" && studentExam) {
        return (
          <ExamResultPanel
            studentExam={studentExam}
            answers={reviewedAnswers}
          />
        );
      }

      return (
        <ExamBriefingPanel
          exam={exam}
          studentExam={studentExam}
          state={state}
          // Parents may never attempt, only read
          canAttempt={perms.canAttempt && Boolean(attemptSession)}
          busy={busy}
          submitted={submitted}
          onStart={() => setAttempting(true)}
        />
      );
    }

    /* ── Exam Controller ──────────────────────────────────────────────── */
    if (perms.view === "CONTROL") {
      return (
        <>
          <HallAllocationPanel
            exam={exam}
            halls={halls}
            canAllocate={perms.canAllocateHalls}
            onAction={setStatus}
          />
          <LiveMonitorPanel exam={exam} attempts={attempts} />
          <MalpracticePanel
            logs={malpractice}
            canResolve={perms.canResolveMalpractice}
            onAction={setStatus}
          />
        </>
      );
    }

    /* ── Teacher ──────────────────────────────────────────────────────── */
    if (perms.canAuthor) {
      return (
        <>
          <SubmissionStatsPanel exam={exam} stats={stats} bands={bands} />
          {perms.canGrade && descriptive.length > 0 && (
            <GradingQueuePanel answers={descriptive} onAction={setStatus} />
          )}
          <QuestionEditorPanel
            questions={questions}
            sections={sections}
            editable={editable}
            onAction={setStatus}
          />
          <ExamSettingsPanel
            exam={exam}
            settings={settings}
            editable={editable}
            formatDateTime={examDateTime}
            onAction={setStatus}
          />
        </>
      );
    }

    /* ── HOD / Principal / VP / Admin / Coordinator — read-only ───────── */
    return (
      <>
        <SubmissionStatsPanel exam={exam} stats={stats} bands={bands} />
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Question paper
          </h2>
          {/* revealAnswers=false is belt-and-braces: the data layer already
              strips the key for roles that can't author. */}
          <QuestionItems
            questions={questions}
            sections={sections}
            revealAnswers={false}
          />
        </Card>
      </>
    );
  }
}
