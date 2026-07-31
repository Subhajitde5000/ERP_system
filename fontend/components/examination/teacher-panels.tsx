"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Lock,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/examination";
import { Button } from "@/components/ui/button";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_FILL,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import { QuestionItems } from "./question-items";
import type {
  DescriptiveAnswer,
  ExamSection,
  ExamSettings,
  ExamSummary,
  GradeBand,
  Question,
  SubmissionStats,
} from "@/types/examination";

/**
 * Teacher panels — role_based_shared_pages.md PAGE 21:
 * "Question list editor, exam settings, submission stats, grade descriptive"
 * with "Edit (if DRAFT)".
 */

/* ── Question list editor ───────────────────────────────────────────────── */

/**
 * The editor is only interactive while the exam is DRAFT — PAGE 21 gates
 * "Edit" on it, and §9.2 makes publishing the point of no return. After that
 * the same list renders read-only with the answer key still visible, because
 * the author may always see their own paper.
 */
export function QuestionEditorPanel({
  questions,
  sections,
  editable,
  onAction,
}: {
  questions: Question[];
  sections: ExamSection[];
  editable: boolean;
  onAction: (message: string) => void;
}) {
  const total = questions.reduce((a, q) => a + q.marks, 0);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Questions
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
            {total} marks
          </p>
        </div>

        {editable ? (
          <button
            type="button"
            onClick={() =>
              onAction(
                "POST /examination/exams/:id/questions — API not connected yet (Dev-B, §9.2).",
              )
            }
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add question
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Locked after publish
          </span>
        )}
      </div>

      <QuestionItems
        questions={questions}
        sections={sections}
        revealAnswers
        action={
          editable
            ? (q, i) => (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "PATCH /examination/questions/:id — API not connected yet (Dev-B).",
                      )
                    }
                    aria-label={`Edit question ${i}`}
                    className="rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "DELETE /examination/questions/:id — API not connected yet (Dev-B).",
                      )
                    }
                    aria-label={`Delete question ${i}`}
                    className="rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-destructive-border hover:bg-destructive-light hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              )
            : undefined
        }
      />
    </Card>
  );
}

/* ── Exam settings ──────────────────────────────────────────────────────── */

/** Read-only row used by the settings panel. */
function SettingRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="min-w-0 text-[13px] text-muted-foreground">
        {label}
        {hint && (
          <span className="block text-[11px] text-[#94A3B8]">{hint}</span>
        )}
      </dt>
      <dd className="text-right text-[13px] font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        on ? "bg-success-light text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {on ? "ON" : "OFF"}
    </span>
  );
}

export function ExamSettingsPanel({
  exam,
  settings,
  editable,
  formatDateTime,
  onAction,
}: {
  exam: ExamSummary;
  settings: ExamSettings;
  editable: boolean;
  formatDateTime: (iso: string) => string;
  onAction: (message: string) => void;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
          <Settings2 className="h-4 w-4 text-accent" aria-hidden="true" />
          Exam settings
        </h2>
        {editable && (
          <button
            type="button"
            onClick={() =>
              onAction(
                "PATCH /examination/exams/:id — API not connected yet (Dev-B).",
              )
            }
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit settings
          </button>
        )}
      </div>

      {settings.instructions && (
        <p className="mb-3 rounded-field border border-border bg-background px-3.5 py-2.5 text-[12px] leading-5 text-[#334155]">
          {settings.instructions}
        </p>
      )}

      <dl className="min-w-0 divide-y divide-border border-t border-border">
        <SettingRow
          label="Type & mode"
          value={`${exam.examType} · ${exam.mode === "ONLINE" ? "Online" : "Offline"}`}
        />
        <SettingRow
          label="Marks"
          value={`${exam.totalMarks} total · pass ${exam.passingMarks}`}
        />
        <SettingRow label="Duration" value={`${exam.durationMinutes} minutes`} />
        <SettingRow label="Starts" value={formatDateTime(exam.scheduledAt)} />
        <SettingRow
          label="Entry closes"
          hint="Latest a student may start"
          value={
            settings.windowEndAt ? formatDateTime(settings.windowEndAt) : "—"
          }
        />
        <SettingRow
          label="Results auto-release"
          value={
            settings.resultsReleaseAt
              ? formatDateTime(settings.resultsReleaseAt)
              : "Manual"
          }
        />
        <SettingRow
          label="Answer review"
          hint="Student can see their paper after release"
          value={<Toggle on={settings.allowReview} />}
        />
        <SettingRow
          label="Shuffle questions"
          value={<Toggle on={settings.shuffleQuestions} />}
        />
        <SettingRow
          label="Show score immediately"
          value={<Toggle on={settings.showScoreImmediately} />}
        />
      </dl>
    </Card>
  );
}

/* ── Submission stats + result summary ──────────────────────────────────── */

/**
 * PAGE 21 lists "submission stats" for the Teacher and "submission summary +
 * result summary" for HOD/Principal. Those are the same numbers, so it's one
 * component — the read-only roles simply get no action buttons anywhere.
 */
export function SubmissionStatsPanel({
  exam,
  stats,
  bands,
}: {
  exam: ExamSummary;
  stats: SubmissionStats;
  bands: GradeBand[];
}) {
  const responded = stats.submitted + stats.graded + stats.malpractice;
  const maxBand = Math.max(1, ...bands.map((b) => b.count));
  const passPct = Math.round((exam.passingMarks / exam.totalMarks) * 100);

  return (
    <div className="grid min-w-0 gap-4">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Submissions
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {responded}/{stats.enrolled} responded
          </span>
        </div>

        <ProgressBar value={responded} max={stats.enrolled} />

        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {[
            ["Not started", stats.notStarted, "muted"],
            ["In progress", stats.inProgress, "warning"],
            ["Submitted", stats.submitted, "accent"],
            ["Graded", stats.graded, "success"],
            ["Flagged", stats.malpractice, "danger"],
            ["Awaiting marks", stats.pendingDescriptive, "cyan"],
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
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Result summary
          </h2>
          <span className="text-[11px] text-muted-foreground">
            pass mark {passPct}%
          </span>
        </div>

        {stats.averagePercentage === null ? (
          <EmptyState message="No papers graded yet — the summary appears once marking begins." />
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-3 gap-4">
              {[
                ["Average", stats.averagePercentage],
                ["Highest", stats.highestPercentage],
                ["Lowest", stats.lowestPercentage],
              ].map(([label, value]) => (
                <div key={label as string} className="min-w-0">
                  <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-display text-xl font-bold tabular-nums",
                      TONE_TEXT[scoreTone(value as number, passPct)],
                    )}
                  >
                    {value as number}%
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[12px] text-muted-foreground">
              <span className="font-semibold text-success">
                {stats.passCount} passed
              </span>
              {" · "}
              <span className="font-semibold text-destructive">
                {stats.failCount} failed
              </span>{" "}
              of {stats.graded} graded
            </p>

            <ul className="mt-4 grid min-w-0 gap-2 border-t border-border pt-4">
              {bands.map((b) => (
                <li key={b.grade} className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-[12px] font-semibold text-foreground">
                    {b.grade}
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        b.grade === "F" ? TONE_FILL.danger : TONE_FILL.accent,
                      )}
                      style={{ width: `${(b.count / maxBand) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                    {b.count}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

/* ── Grade descriptive answers ──────────────────────────────────────────── */

/**
 * PAGE 21 "grade descriptive". MCQ auto-grades on submit (§9.2), so only
 * SHORT/LONG answers reach this queue.
 */
export function GradingQueuePanel({
  answers,
  onAction,
}: {
  answers: DescriptiveAnswer[];
  onAction: (message: string) => void;
}) {
  const [graded, setGraded] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(answers[0]?.answerId ?? null);

  const remaining = answers.filter((a) => graded[a.answerId] === undefined);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-foreground">
            Descriptive answers
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            MCQ answers are graded automatically. These need a human.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
          {remaining.length} PENDING
        </span>
      </div>

      {answers.length === 0 ? (
        <EmptyState message="Nothing to grade — no descriptive answers have been submitted." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {answers.map((a) => {
            const score = graded[a.answerId];
            const isOpen = open === a.answerId;

            return (
              <li key={a.answerId} className="min-w-0 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : a.answerId)}
                  aria-expanded={isOpen}
                  className="flex w-full min-w-0 items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {a.studentName}
                      <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                        {a.rollNo}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.questionText}
                    </p>
                  </div>

                  {score === undefined ? (
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      —/{a.maxMarks}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {score}/{a.maxMarks}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="mt-2.5 min-w-0">
                    <p className="rounded-field border border-border bg-background px-3.5 py-2.5 text-[12px] leading-5 text-[#334155]">
                      {a.textAnswer || (
                        <span className="italic text-muted-foreground">
                          Left blank.
                        </span>
                      )}
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        const value = Number(data.get("score"));
                        setGraded((g) => ({ ...g, [a.answerId]: value }));
                        onAction(
                          "PATCH /examination/answers/:id — API not connected yet (Dev-B, §9.2).",
                        );
                      }}
                      className="mt-2.5 flex min-w-0 flex-wrap items-end gap-2"
                    >
                      <label className="text-[11px] font-medium text-[#334155]">
                        Score
                        <input
                          name="score"
                          type="number"
                          required
                          min={0}
                          max={a.maxMarks}
                          step={0.5}
                          defaultValue={score}
                          className="mt-1 block h-9 w-24 rounded-field border border-border px-2.5 text-[13px] tabular-nums focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                        />
                      </label>

                      <label className="min-w-0 flex-1 text-[11px] font-medium text-[#334155]">
                        Feedback
                        <input
                          name="feedback"
                          type="text"
                          placeholder="Optional note for the student"
                          className="mt-1 block h-9 w-full min-w-0 rounded-field border border-border px-2.5 text-[13px] placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                        />
                      </label>

                      <Button
                        type="submit"
                        className="h-9 w-auto shrink-0 px-4 text-[12px]"
                      >
                        Save
                      </Button>
                    </form>
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
