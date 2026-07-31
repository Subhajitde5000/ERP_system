"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Send, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AttemptAnswer, AttemptSession } from "@/types/examination";

/**
 * Student attempt interface — role_based_shared_pages.md PAGE 21:
 * "Exam attempt interface (full screen, timed)".
 *
 * Rendered as a fixed overlay above the institution shell, so the sidebar and
 * topbar are out of the way for the duration of the paper.
 *
 * Two things are deliberately *not* client-authoritative:
 *   • the deadline comes from `session.expiresAt` (Redis TTL, dev doc §9.2) —
 *     the countdown here is only a display of it, and expiry triggers the same
 *     auto-submit the server would perform;
 *   • the payload carries no `isCorrect` flags, so the answer key can't be
 *     read out of the page source mid-exam.
 */
export function AttemptScreen({
  session,
  examTitle,
  totalMarks,
  onExit,
  onSubmit,
}: {
  session: AttemptSession;
  examTitle: string;
  totalMarks: number;
  onExit: () => void;
  onSubmit: (reason: "MANUAL" | "TIMER") => void;
}) {
  const [answers, setAnswers] = useState<AttemptAnswer[]>(session.answers);
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(session.tabSwitchCount);
  // Null until mounted: computing this during SSR bakes a server-clock value
  // into the HTML that the client then disagrees with (hydration mismatch).
  const [remaining, setRemaining] = useState<number | null>(null);

  const submittedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const submit = useCallback(
    (reason: "MANUAL" | "TIMER") => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      onSubmit(reason);
    },
    [onSubmit],
  );

  // Countdown. The server owns the real deadline; this recomputes from the
  // timestamp each tick so a throttled background tab can't drift.
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, +new Date(session.expiresAt) - Date.now());
      setRemaining(left);
      if (left === 0) submit("TIMER");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.expiresAt, submit]);

  // Tab-switch detection (dev doc §9.2 anti-cheat)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitches((n) => n + 1);
        // TODO(Dev-B): POST /examination/attempts/:id/events {type:'TAB_SWITCH'}
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // Escape closes the submit confirmation only — never the exam itself.
  // A keydown handler on the dialog div never fires: nothing inside it holds
  // focus when it opens, so the listener has to be on the document.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  // Lock the page behind the overlay and move focus into it
  useEffect(() => {
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const question = session.questions[current];
  const answerFor = (id: string) => answers.find((a) => a.questionId === id);
  const isAnswered = (id: string) => {
    const a = answerFor(id);
    return Boolean(a?.selectedOptionId || a?.textAnswer?.trim());
  };
  const answeredCount = session.questions.filter((q) =>
    isAnswered(q.id),
  ).length;

  function setAnswer(questionId: string, patch: Partial<AttemptAnswer>) {
    setAnswers((prev) =>
      prev.map((a) => (a.questionId === questionId ? { ...a, ...patch } : a)),
    );
    // TODO(Dev-B): PATCH /examination/attempts/:id/answers — autosave per change
  }

  const minutes = remaining === null ? 0 : Math.floor(remaining / 60000);
  const seconds = remaining === null ? 0 : Math.floor((remaining % 60000) / 1000);
  const urgent = remaining !== null && remaining < 5 * 60 * 1000;

  if (!question) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${examTitle} — exam in progress`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Exam chrome — replaces the app shell for the duration */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="truncate font-display text-[15px] font-bold text-foreground focus:outline-none"
          >
            {examTitle}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {answeredCount}/{session.questions.length} answered · {totalMarks}{" "}
            marks
          </p>
        </div>

        {tabSwitches > 0 && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
              tabSwitches > 5
                ? "bg-destructive-light text-destructive"
                : "bg-warning-light text-[#B45309]",
            )}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {tabSwitches} tab switch{tabSwitches === 1 ? "" : "es"}
          </span>
        )}

        <p
          role="timer"
          aria-live="off"
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-field px-3 py-1.5 font-mono text-[15px] font-bold tabular-nums",
            urgent
              ? "bg-destructive-light text-destructive"
              : "bg-accent-light text-accent",
          )}
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Time remaining </span>
          {remaining === null
            ? "--:--"
            : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
        </p>

        {/* Escape hatch — in the header flow, so it can't sit on the timer */}
        <button
          type="button"
          onClick={onExit}
          aria-label="Leave exam without submitting"
          className="shrink-0 rounded-field border border-border p-2 text-muted-foreground transition-colors hover:border-destructive-border hover:bg-destructive-light hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* Question palette */}
      <nav
        aria-label="Question palette"
        className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-white px-4 py-2 sm:px-6"
      >
        {session.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Question ${i + 1}${isAnswered(q.id) ? ", answered" : ", not answered"}`}
            aria-current={i === current ? "true" : undefined}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-field border text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
              i === current
                ? "border-primary bg-primary text-white"
                : isAnswered(q.id)
                  ? "border-success bg-success-light text-success"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {/* Current question */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto w-full min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Question {current + 1} of {session.questions.length} ·{" "}
            {question.marks} mark{question.marks === 1 ? "" : "s"}
            {question.negativeMarks > 0 &&
              ` · −${question.negativeMarks} if wrong`}
          </p>

          <h2 className="mt-2 text-[15px] font-medium leading-7 text-foreground">
            {question.text}
          </h2>

          {question.options.length > 0 ? (
            <fieldset className="mt-4 min-w-0">
              <legend className="sr-only">Choose one answer</legend>
              <div className="grid min-w-0 gap-2">
                {question.options.map((o) => {
                  const checked =
                    answerFor(question.id)?.selectedOptionId === o.id;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-center gap-3 rounded-field border px-3.5 py-3 text-[13px] transition",
                        checked
                          ? "border-accent bg-accent-light text-foreground"
                          : "border-border bg-white text-[#334155] hover:border-accent",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={checked}
                        onChange={() =>
                          setAnswer(question.id, {
                            selectedOptionId: o.id,
                            textAnswer: null,
                          })
                        }
                        className="h-4 w-4 shrink-0 accent-[#4F46E5]"
                      />
                      <span className="min-w-0">{o.text}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <label className="mt-4 block text-[12px] font-medium text-[#334155]">
              Your answer
              <textarea
                rows={10}
                value={answerFor(question.id)?.textAnswer ?? ""}
                onChange={(e) =>
                  setAnswer(question.id, {
                    textAnswer: e.target.value,
                    selectedOptionId: null,
                  })
                }
                placeholder="Type your answer here. It saves automatically."
                className="mt-1 w-full rounded-field border border-border px-3.5 py-3 text-[13px] leading-6 placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </label>
          )}

          {answerFor(question.id)?.selectedOptionId && (
            <button
              type="button"
              onClick={() =>
                setAnswer(question.id, { selectedOptionId: null })
              }
              className="mt-2 rounded text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Clear response
            </button>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setCurrent((i) => Math.max(0, i - 1))}
          className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={current === session.questions.length - 1}
          onClick={() =>
            setCurrent((i) => Math.min(session.questions.length - 1, i + 1))
          }
          className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          Next
        </button>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-[13px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit exam
        </button>
      </footer>

      {/* Submit confirmation — unanswered questions are stated plainly */}
      {confirming && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-10 flex items-end justify-center bg-primary/40 p-0 sm:items-center sm:p-6"
        >
          <div className="w-full max-w-sm rounded-t-card border border-border bg-white p-6 shadow-card sm:rounded-card">
            <h2
              id="submit-title"
              className="font-display text-[16px] font-bold text-foreground"
            >
              Submit your exam?
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              You&apos;ve answered{" "}
              <strong className="text-foreground">
                {answeredCount} of {session.questions.length}
              </strong>{" "}
              questions.
              {answeredCount < session.questions.length && (
                <>
                  {" "}
                  The remaining{" "}
                  {session.questions.length - answeredCount} will be marked
                  zero.
                </>
              )}{" "}
              You cannot reopen the paper after submitting.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                Keep working
              </button>
              <Button
                type="button"
                onClick={() => submit("MANUAL")}
                className="h-10 w-auto px-4 text-[13px]"
              >
                Submit now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Post-submission acknowledgement, shown in place of the attempt screen. */
export function SubmittedNotice({ auto }: { auto: boolean }) {
  return (
    <p className="mt-4 flex items-center gap-2 rounded-field bg-accent-light px-3.5 py-3 text-[13px] font-medium text-accent">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      {auto
        ? "Time expired — your answers were submitted automatically."
        : "Submitted. Results will appear once released."}
    </p>
  );
}
