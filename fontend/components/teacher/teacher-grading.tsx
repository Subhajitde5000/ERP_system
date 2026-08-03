"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchTeacherAttempt,
  gradeTeacherAttempt,
  type TeacherAttemptDetail,
} from "@/lib/teacher";
import { AsyncState, StatusPill, dateTime, percent } from "@/components/teacher/teacher-ui";

/**
 * C-TC-11 (detail) — grade one attempt's descriptive answers.
 *
 * Objective answers arrive already scored and are shown read-only: re-marking
 * an auto-scored MCQ by hand is how two students end up with different marks
 * for the same answer.
 */
export function TeacherAttemptPage({ attemptId }: { attemptId: string }) {
  const load = useCallback(() => fetchTeacherAttempt(attemptId), [attemptId]);
  const resource = useResource(load, [attemptId]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!resource.data) return;
    setScores(
      Object.fromEntries(
        resource.data.answers.map((answer) => [
          answer.id,
          answer.score === null ? "" : String(answer.score),
        ]),
      ),
    );
    setFeedback(
      Object.fromEntries(
        resource.data.answers.map((answer) => [answer.id, answer.feedback ?? ""]),
      ),
    );
  }, [resource.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!resource.data) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const grades = resource.data.answers
      .filter((answer) => !answer.is_auto_graded && scores[answer.id] !== "")
      .map((answer) => ({
        answer_id: answer.id,
        score: Number(scores[answer.id]),
        feedback: feedback[answer.id]?.trim() || null,
      }));
    if (!grades.length) {
      setError("Enter a score for at least one answer.");
      setBusy(false);
      return;
    }
    try {
      resource.setData(await gradeTeacherAttempt(attemptId, grades));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the grades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Grade attempt"
        subtitle="Objective answers are already scored. Mark the written ones and add feedback."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading the attempt…"
      >
        {resource.data ? (
          <AttemptBody
            detail={resource.data}
            scores={scores}
            feedback={feedback}
            busy={busy}
            error={error}
            saved={saved}
            onScore={(id, value) => setScores((current) => ({ ...current, [id]: value }))}
            onFeedback={(id, value) => setFeedback((current) => ({ ...current, [id]: value }))}
            onSubmit={submit}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

function AttemptBody({
  detail,
  scores,
  feedback,
  busy,
  error,
  saved,
  onScore,
  onFeedback,
  onSubmit,
}: {
  detail: TeacherAttemptDetail;
  scores: Record<string, string>;
  feedback: Record<string, string>;
  busy: boolean;
  error: string | null;
  saved: boolean;
  onScore: (id: string, value: string) => void;
  onFeedback: (id: string, value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const pending = detail.answers.filter((answer) => answer.needs_grading).length;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              {detail.attempt.student_name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.attempt.roll_number ?? "—"} · {detail.exam.title} · {detail.exam.class_name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Submitted {dateTime(detail.attempt.submitted_at)}
              {detail.attempt.auto_submitted ? " (auto-submitted at the deadline)" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold text-primary">
              {detail.attempt.total_score ?? "—"}
              <span className="text-sm font-medium text-muted-foreground">
                /{detail.exam.total_marks}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {percent(detail.attempt.percentage)} · {detail.attempt.grade ?? "—"}
            </p>
          </div>
        </div>
        {detail.attempt.tab_switch_count ? (
          <p className="mt-3 rounded-field border border-warning-border bg-warning-light px-3 py-2 text-xs text-warning-text">
            This attempt recorded {detail.attempt.tab_switch_count} tab switch(es). The Exam
            Controller sees the same counter on the malpractice board.
          </p>
        ) : null}
      </Card>

      <ol className="space-y-3">
        {detail.answers.map((answer, index) => (
          <Card key={answer.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-primary">
                {index + 1}. {answer.question_text}
              </p>
              <StatusPill
                status={answer.is_auto_graded ? "AUTO" : answer.needs_grading ? "PENDING" : "GRADED"}
                tone={answer.is_auto_graded ? "info" : answer.needs_grading ? "warning" : "success"}
                label={
                  answer.is_auto_graded
                    ? "Auto-scored"
                    : answer.needs_grading
                      ? "Needs grading"
                      : "Graded"
                }
              />
            </div>

            <div className="mt-3 rounded-field border border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Answer</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {answer.selected_option_text ?? answer.text_answer ?? "— not answered —"}
              </p>
            </div>

            {answer.is_auto_graded ? (
              <p className="mt-3 text-sm font-semibold text-primary">
                {answer.score ?? 0} / {answer.question_marks} marks
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                <div>
                  <label className={labelClass} htmlFor={`score-${answer.id}`}>
                    Score / {answer.question_marks}
                  </label>
                  <input
                    id={`score-${answer.id}`}
                    type="number"
                    min={0}
                    max={answer.question_marks}
                    step={0.5}
                    className={inputClass}
                    value={scores[answer.id] ?? ""}
                    onChange={(event) => onScore(answer.id, event.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`feedback-${answer.id}`}>
                    Feedback (optional)
                  </label>
                  <input
                    id={`feedback-${answer.id}`}
                    className={inputClass}
                    value={feedback[answer.id] ?? ""}
                    onChange={(event) => onFeedback(answer.id, event.target.value)}
                  />
                </div>
              </div>
            )}
          </Card>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-success-text">
          Grades saved. {pending ? `${pending} answer(s) still need a score.` : "This attempt is fully graded."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save grades"}
        </button>
        <Link
          href={`/teacher/examinations/${detail.exam.id}/results`}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Back to results
        </Link>
      </div>
    </form>
  );
}
