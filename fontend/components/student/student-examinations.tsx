"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchStudentExamResult,
  fetchStudentExams,
  reportStudentTabSwitch,
  saveStudentAnswers,
  startStudentAttempt,
  submitStudentAttempt,
  type StudentAnswerInput,
  type StudentAttemptScreen,
  type StudentExamResult,
} from "@/lib/student";
import { AsyncState, StatusPill, dateTime, percent } from "@/components/teacher/teacher-ui";

/** C-ST-07 — every exam published to this learner's class. */
export function StudentExaminationsPage() {
  const [status, setStatus] = useState("");
  const load = useCallback(() => fetchStudentExams({ status: status || undefined }), [status]);
  const resource = useResource(load, [status]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Examinations"
        subtitle="Upcoming, ongoing and completed exams for your class."
      />

      <Card className="mb-5">
        <label className={labelClass} htmlFor="student-exam-status">
          Status
        </label>
        <select
          id="student-exam-status"
          className={`${inputClass} sm:max-w-xs`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All</option>
          <option value="PUBLISHED">Upcoming</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="RESULTS_RELEASED">Results released</option>
        </select>
      </Card>

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading examinations…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((exam) => (
              <Card key={exam.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold text-primary">{exam.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {exam.subject_code} · {exam.subject_name} · {exam.total_marks} marks ·{" "}
                      {exam.duration_minutes} min · {exam.mode.toLowerCase()}
                    </p>
                    <time className="mt-1 block text-[11px] font-medium text-accent">
                      {dateTime(exam.scheduled_at)}
                    </time>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill status={exam.status} />
                    {exam.attempt_status ? <StatusPill status={exam.attempt_status} /> : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-sm font-semibold">
                  {exam.can_attempt ? (
                    <Link
                      href={`/student/examinations/${exam.id}/attempt`}
                      className="inline-flex h-9 items-center rounded-field bg-accent px-4 text-white"
                    >
                      {exam.attempt_status ? "Resume exam" : "Start exam"}
                    </Link>
                  ) : null}
                  {exam.attempt_status ? (
                    <Link
                      href={`/student/examinations/${exam.id}/result`}
                      className="text-accent hover:underline"
                    >
                      View result
                    </Link>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="No exams have been published for your class." />
        )}
      </AsyncState>
    </div>
  );
}

const AUTOSAVE_MS = 20_000;

/**
 * C-ST-08 — the full-screen timed attempt.
 *
 * Three things about this screen matter more than its looks:
 *
 * 1. **The clock is the server's.** `expires_at` and `server_time` arrive
 *    together, so the countdown is driven by the *offset* between them, not by
 *    the device clock — moving the system clock back buys nothing, and the
 *    submit endpoint re-checks the deadline anyway.
 * 2. **Answers autosave.** A dropped connection or a closed lid must not cost
 *    a paper, so answers are flushed every 20 seconds and on every navigation.
 * 3. **Focus loss is reported.** The Exam Controller's monitor reads the same
 *    `tab_switch_count`; hiding the count from the student would be dishonest,
 *    so it is shown.
 */
export function StudentAttemptPage({ examId }: { examId: string }) {
  const router = useRouter();
  const [screen, setScreen] = useState<StudentAttemptScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerInput>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const submitted = useRef(false);

  // Start (or resume) once. `startStudentAttempt` is idempotent server-side:
  // a second call returns the existing attempt rather than restarting it.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await startStudentAttempt(examId);
        if (!alive) return;
        setScreen(next);
        setAnswers(
          Object.fromEntries(
            next.questions.map((question) => [
              question.id,
              {
                question_id: question.id,
                selected_option_id: question.selected_option_id,
                text_answer: question.text_answer,
              },
            ]),
          ),
        );
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not open the exam.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [examId]);

  const flush = useCallback(async () => {
    if (!screen || !dirty.current || submitted.current) return;
    dirty.current = false;
    try {
      await saveStudentAnswers(screen.attempt_id, Object.values(answers));
    } catch {
      // A failed autosave is not fatal — the next tick retries, and the final
      // submit sends everything again. Surfacing it mid-exam would only panic.
      dirty.current = true;
    }
  }, [answers, screen]);

  const finish = useCallback(
    async (auto: boolean) => {
      if (!screen || submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      try {
        await submitStudentAttempt(screen.attempt_id, Object.values(answers));
        router.replace(`/student/examinations/${examId}/result`);
      } catch (caught) {
        submitted.current = false;
        setSubmitting(false);
        setError(
          caught instanceof Error
            ? caught.message
            : auto
              ? "Time ran out but the submission failed. Try the submit button."
              : "Could not submit the exam.",
        );
      }
    },
    [answers, examId, router, screen],
  );

  // Countdown driven by the server offset captured at load.
  useEffect(() => {
    if (!screen) return;
    const skew = Date.now() - new Date(screen.server_time).getTime();
    const deadline = new Date(screen.expires_at).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((deadline - (Date.now() - skew)) / 1000));
      setRemaining(left);
      if (left === 0) void finish(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [screen, finish]);

  useEffect(() => {
    const timer = window.setInterval(() => void flush(), AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [flush]);

  // Report focus loss the moment it happens, and flush answers with it.
  useEffect(() => {
    if (!screen) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden" || submitted.current) return;
      void flush();
      void reportStudentTabSwitch(screen.attempt_id).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush, screen]);

  const answered = useMemo(
    () =>
      Object.values(answers).filter(
        (answer) => answer.selected_option_id || (answer.text_answer ?? "").trim(),
      ).length,
    [answers],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Opening your exam…
      </div>
    );
  }

  if (error && !screen) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="border-destructive-border">
          <p className="text-sm font-medium text-destructive-text">{error}</p>
          <Link
            href="/student/examinations"
            className="mt-3 inline-block text-sm font-semibold text-accent hover:underline"
          >
            Back to examinations
          </Link>
        </Card>
      </div>
    );
  }

  if (!screen) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const critical = remaining <= 300;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="sticky top-14 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold text-primary">{screen.title}</h1>
          <p className="text-xs text-muted-foreground">
            {screen.subject_code} · {screen.total_marks} marks · {answered}/
            {screen.questions.length} answered
          </p>
        </div>
        <div className="flex items-center gap-3">
          {screen.tab_switch_count ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-warning-text">
              <AlertTriangle className="h-3.5 w-3.5" />
              {screen.tab_switch_count} tab switch(es) logged
            </span>
          ) : null}
          <span
            className={`flex items-center gap-1.5 rounded-field px-3 py-1.5 font-mono text-sm font-bold ${
              critical ? "bg-destructive-light text-destructive-text" : "bg-muted text-primary"
            }`}
            aria-live="polite"
          >
            <Clock className="h-4 w-4" />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      </header>

      {screen.instructions ? (
        <Card className="mb-5">
          <h2 className="mb-1 font-display text-sm font-bold text-primary">Instructions</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{screen.instructions}</p>
        </Card>
      ) : null}

      <ol className="space-y-4">
        {screen.questions.map((question, index) => (
          <Card key={question.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-primary">
                {index + 1}. {question.text}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {question.marks} mark{question.marks === 1 ? "" : "s"}
                {question.negative_marks ? ` · −${question.negative_marks}` : ""}
              </span>
            </div>

            {question.options.length ? (
              <ul className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <li key={option.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-field border border-border px-3 py-2 text-sm transition hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-light">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        className="mt-0.5 h-4 w-4 text-accent"
                        checked={answers[question.id]?.selected_option_id === option.id}
                        onChange={() => {
                          dirty.current = true;
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: {
                              question_id: question.id,
                              selected_option_id: option.id,
                              text_answer: null,
                            },
                          }));
                        }}
                      />
                      <span className="text-foreground">{option.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <textarea
                rows={question.question_type === "LONG_ANSWER" ? 8 : 3}
                aria-label={`Answer to question ${index + 1}`}
                className={`${inputClass} mt-3 h-auto py-2.5`}
                value={answers[question.id]?.text_answer ?? ""}
                onChange={(event) => {
                  dirty.current = true;
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: {
                      question_id: question.id,
                      selected_option_id: null,
                      text_answer: event.target.value,
                    },
                  }));
                }}
              />
            )}
          </Card>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-5 py-4">
        <p className="text-sm text-muted-foreground">
          {answered} of {screen.questions.length} answered. Answers save automatically.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void finish(false)}
          className="inline-flex h-11 items-center rounded-field bg-accent px-6 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit exam"}
        </button>
      </div>
    </div>
  );
}

/** C-ST-09 — score, breakdown and feedback once the teacher releases it. */
export function StudentExamResultPage({ examId }: { examId: string }) {
  const load = useCallback(() => fetchStudentExamResult(examId), [examId]);
  const resource = useResource(load, [examId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Exam result"
        subtitle="Your score for this paper."
        action={
          <Link
            href="/student/examinations"
            className="text-sm font-semibold text-accent hover:underline"
          >
            All exams
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your result…"
      >
        {resource.data ? <ResultBody result={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function ResultBody({ result }: { result: StudentExamResult }) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">{result.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.subject_code} · {result.subject_name}
            </p>
            {result.submitted_at ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {dateTime(result.submitted_at)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-extrabold text-primary">
              {result.total_score ?? "—"}
              <span className="text-base font-medium text-muted-foreground">
                /{result.total_marks}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {percent(result.percentage)} · {result.grade ?? "—"}
            </p>
            {result.is_pass !== null ? (
              <div className="mt-1.5 flex justify-end">
                <StatusPill status={result.is_pass ? "PASS" : "FAIL"} />
              </div>
            ) : null}
          </div>
        </div>
        {result.status === "SUBMITTED" ? (
          <p className="mt-4 rounded-field border border-accent-border bg-accent-light px-3 py-2 text-xs text-accent">
            Some answers still need your teacher&apos;s marking, so this score may rise.
          </p>
        ) : null}
      </Card>

      {result.review_available ? (
        <ol className="space-y-3">
          {result.answers.map((answer, index) => (
            <Card key={answer.question_id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-primary">
                  {index + 1}. {answer.question_text}
                </p>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {answer.score ?? 0}/{answer.question_marks}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Your answer: </span>
                  <span className="text-foreground">{answer.your_answer ?? "— not answered —"}</span>
                </p>
                {answer.correct_answer ? (
                  <p>
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="font-medium text-success-text">{answer.correct_answer}</span>
                  </p>
                ) : null}
                {answer.feedback ? (
                  <p className="rounded-field border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                    {answer.feedback}
                  </p>
                ) : null}
                {answer.explanation ? (
                  <p className="text-xs text-muted-foreground">{answer.explanation}</p>
                ) : null}
              </div>
            </Card>
          ))}
        </ol>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            A question-by-question review is not available for this exam. Your teacher enables it
            once results are released.
          </p>
        </Card>
      )}
    </div>
  );
}
