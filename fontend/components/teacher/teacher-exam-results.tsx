"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Send, X } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchExamAttempt,
  fetchExamAttempts,
  fetchTeacherExam,
  gradeExamAttempt,
  releaseExamResults,
  type TeacherAnswerRow,
  type TeacherAttemptDetail,
} from "@/lib/teacher";
import { AsyncState, EmptyTable, dateTime, percent, statusLabel } from "@/components/principal/principal-ui";

/** C-TC-11 — submissions for one exam: grade descriptive answers, release results. */
export function TeacherExamResultsPage() {
  const params = useParams<{ id?: string }>();
  const examId = params?.id ?? "";
  const exam = useResource(
    () => (examId ? fetchTeacherExam(examId) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const attempts = useResource(
    () => (examId ? fetchExamAttempts(examId, { limit: 100 }) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const [gradingAttemptId, setGradingAttemptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function release() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await releaseExamResults(examId);
      if (exam.data) exam.setData({ ...exam.data, ...updated });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not release the results.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={exam.data ? `Results — ${exam.data.title}` : "Exam results"}
        subtitle="Grade descriptive answers, then release the results to students."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/teacher/examinations/${examId}`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
              Exam detail
            </Link>
            {exam.data && exam.data.status !== "RESULTS_RELEASED" && exam.data.status !== "DRAFT" ? (
              <button
                type="button"
                disabled={busy}
                onClick={release}
                className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {busy ? "Releasing…" : "Release results"}
              </button>
            ) : null}
          </div>
        }
      />
      {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
      <AsyncState loading={attempts.loading} error={attempts.error} onRetry={attempts.reload} loadingLabel="Loading attempts…">
        {attempts.data ? (
          <Card className="!p-0">
            {attempts.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Submitted</th>
                      <th className="px-5 py-3">Score</th>
                      <th className="px-5 py-3">Needs grading</th>
                      <th className="px-5 py-3"><span className="sr-only">Grade</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attempts.data.items.map((attempt) => (
                      <tr key={attempt.attempt_id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold text-primary">
                          {attempt.student_name}
                          <span className="block text-[11px] font-normal text-muted-foreground">{attempt.roll_number ?? "No roll number"}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${attempt.status === "IN_PROGRESS" ? "bg-accent-light text-accent" : attempt.status === "MALPRACTICE" ? "bg-destructive-light text-destructive-text" : "bg-muted text-muted-foreground"}`}>
                            {statusLabel(attempt.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{attempt.submitted_at ? dateTime(attempt.submitted_at) : "—"}</td>
                        <td className="px-5 py-3 font-semibold text-primary">
                          {attempt.total_score !== null ? `${attempt.total_score}${attempt.grade ? ` · ${attempt.grade}` : ""}` : "—"}
                          {attempt.percentage !== null ? <span className="block text-[11px] font-normal text-muted-foreground">{percent(attempt.percentage)}</span> : null}
                        </td>
                        <td className="px-5 py-3">
                          {attempt.pending_grading_count ? (
                            <span className="font-semibold text-warning-text">{attempt.pending_grading_count} answer(s)</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {attempt.status !== "IN_PROGRESS" ? (
                            <button
                              type="button"
                              onClick={() => setGradingAttemptId(attempt.attempt_id)}
                              className="text-xs font-semibold text-accent hover:underline"
                            >
                              {attempt.pending_grading_count ? "Grade" : "Review"}
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">In progress</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTable text="No student attempts yet." />
            )}
          </Card>
        ) : null}
      </AsyncState>
      {gradingAttemptId ? (
        <GradingPanel examId={examId} attemptId={gradingAttemptId} onClose={async (graded) => {
          setGradingAttemptId(null);
          if (graded) {
            await attempts.reload();
            await exam.reload();
          }
        }} />
      ) : null}
    </div>
  );
}

function GradingPanel({
  examId,
  attemptId,
  onClose,
}: {
  examId: string;
  attemptId: string;
  onClose: (graded: boolean) => Promise<void>;
}) {
  const detail = useResource(() => fetchExamAttempt(examId, attemptId), [examId, attemptId]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Grade attempt">
      <div className="my-8 w-full max-w-3xl">
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">Grade attempt</h2>
              <p className="mt-1 text-xs text-muted-foreground">Objective answers are auto-graded; set scores for the rest.</p>
            </div>
            <button type="button" onClick={() => onClose(false)} aria-label="Close grading" className="inline-flex h-8 w-8 items-center justify-center rounded-field border border-border text-muted-foreground hover:border-accent hover:text-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <AsyncState loading={detail.loading} error={detail.error} onRetry={detail.reload} loadingLabel="Loading answers…">
            {detail.data ? <GradingForm examId={examId} detail={detail.data} onClose={onClose} /> : null}
          </AsyncState>
        </Card>
      </div>
    </div>
  );
}

function GradingForm({
  examId,
  detail,
  onClose,
}: {
  examId: string;
  detail: TeacherAttemptDetail;
  onClose: (graded: boolean) => Promise<void>;
}) {
  const manual = detail.answers.filter((answer) => !answer.is_auto_graded);
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(manual.map((answer) => [answer.answer_id, answer.score !== null ? String(answer.score) : ""])),
  );
  const [feedback, setFeedback] = useState<Record<string, string>>(
    Object.fromEntries(manual.map((answer) => [answer.answer_id, answer.feedback ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const grades = [];
    for (const answer of manual) {
      const raw = (scores[answer.answer_id] ?? "").trim();
      if (raw === "") {
        setError(`Enter a score for every pending answer (Q: “${answer.question_text.slice(0, 40)}…”).`);
        return;
      }
      const score = Number(raw);
      if (Number.isNaN(score) || score < 0 || score > answer.marks) {
        setError(`Score must be between 0 and ${answer.marks}.`);
        return;
      }
      grades.push({ answer_id: answer.answer_id, score, feedback: (feedback[answer.answer_id] ?? "").trim() || null });
    }
    if (!grades.length) {
      await onClose(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gradeExamAttempt(examId, detail.attempt_id, grades);
      await onClose(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the grades.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-primary">{detail.student_name}</span>
        {detail.roll_number ? ` · ${detail.roll_number}` : ""} · submitted {detail.submitted_at ? dateTime(detail.submitted_at) : "—"}
      </p>
      {detail.answers.some((answer) => answer.is_auto_graded) ? <AutoGradedSummary answers={detail.answers} /> : null}
      {manual.length ? (
        manual.map((answer) => (
          <fieldset key={answer.answer_id} className="rounded-field border border-border p-4">
            <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {statusLabel(answer.question_type)} · {answer.marks} marks
            </legend>
            <p className="whitespace-pre-wrap text-sm font-semibold text-primary">{answer.question_text}</p>
            <p className="mt-2 whitespace-pre-wrap rounded-field bg-muted p-3 text-sm text-muted-foreground">
              {answer.text_answer?.trim() || answer.selected_option_text || "(no answer written)"}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`score-${answer.answer_id}`} className={labelClass}>Score (0–{answer.marks})</label>
                <input
                  id={`score-${answer.answer_id}`}
                  type="number"
                  min={0}
                  max={answer.marks}
                  step={0.5}
                  className={inputClass}
                  value={scores[answer.answer_id] ?? ""}
                  onChange={(event) => setScores({ ...scores, [answer.answer_id]: event.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`feedback-${answer.answer_id}`} className={labelClass}>Feedback (optional)</label>
                <input
                  id={`feedback-${answer.answer_id}`}
                  className={inputClass}
                  maxLength={5000}
                  value={feedback[answer.answer_id] ?? ""}
                  onChange={(event) => setFeedback({ ...feedback, [answer.answer_id]: event.target.value })}
                />
              </div>
            </div>
          </fieldset>
        ))
      ) : (
        <p className="rounded-field border border-success-border bg-success-light px-4 py-2.5 text-sm text-success-text">
          Every answer is auto-graded — nothing is waiting on you.
        </p>
      )}
      {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
      {manual.length ? (
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
            {busy ? "Saving…" : "Save grades"}
          </button>
          <button type="button" onClick={() => onClose(false)} className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
            Cancel
          </button>
        </div>
      ) : null}
    </form>
  );
}

function AutoGradedSummary({ answers }: { answers: TeacherAnswerRow[] }) {
  const auto = answers.filter((answer) => answer.is_auto_graded);
  const earned = auto.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  const possible = auto.reduce((sum, answer) => sum + answer.marks, 0);
  return (
    <p className="rounded-field bg-muted px-4 py-2.5 text-xs font-semibold text-muted-foreground">
      Auto-graded objective answers: {earned} / {possible} marks across {auto.length} question(s).
    </p>
  );
}
