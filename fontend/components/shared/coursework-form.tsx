"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { FormAlert } from "@/components/auth/form-alert";
import { Card } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";

/**
 * Create Assignment (C-TC-13) / Create Exam (C-TC-08).
 *
 * The two forms share title, subject, class, type, marks and schedule; they
 * differ in three fields each (`duration_minutes` + `mode` for an exam,
 * `allow_late_submission` + `late_penalty_percent` for an assignment). One
 * component with a `kind` beats two files that drift apart.
 *
 * Both save as DRAFT — §7.2 and §7.3 default `status` to DRAFT, and the
 * question paper / instructions are added on the detail page afterwards.
 */

export interface CourseworkOption {
  id: string;
  label: string;
}

export function CourseworkForm({
  kind,
  subjects,
  classes,
  backHref,
  backLabel,
}: {
  kind: "ASSIGNMENT" | "EXAM";
  subjects: CourseworkOption[];
  classes: CourseworkOption[];
  backHref: string;
  backLabel: string;
}) {
  const isExam = kind === "EXAM";

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(subjects[0]?.id ?? "");
  const [klass, setKlass] = useState(classes[0]?.id ?? "");
  const [type, setType] = useState(isExam ? "MCQ" : "REGULAR");
  const [totalMarks, setTotalMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("35");
  const [due, setDue] = useState("");
  const [duration, setDuration] = useState("60");
  const [mode, setMode] = useState("ONLINE");
  const [allowLate, setAllowLate] = useState(false);
  const [penalty, setPenalty] = useState("10");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    const total = Number(totalMarks);
    const pass = Number(passingMarks);

    if (!title.trim()) e.title = "Give it a title";
    if (!subject) e.subject = "Choose a subject";
    if (!klass) e.klass = "Choose a class";
    if (!due) e.due = isExam ? "Choose when it starts" : "Choose a due date";

    // Validate in JS — native min/max would replace these specific messages
    // with a generic browser tooltip (the PAGE 11 lesson).
    if (!Number.isFinite(total) || total <= 0) e.totalMarks = "Enter total marks";
    else if (total > 1000) e.totalMarks = "That looks too high — max 1000";

    if (!Number.isFinite(pass) || pass < 0) e.passingMarks = "Enter passing marks";
    else if (pass > total) e.passingMarks = `Cannot exceed the total (${total})`;

    if (isExam) {
      const mins = Number(duration);
      if (!Number.isFinite(mins) || mins <= 0) e.duration = "Enter a duration";
      else if (mins > 600) e.duration = "Longer than 10 hours?";
    } else if (allowLate) {
      const pen = Number(penalty);
      if (!Number.isFinite(pen) || pen < 0 || pen > 100)
        e.penalty = "Penalty must be 0–100%";
    }

    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;

    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    // TODO(Dev-B): POST /api/v1/assignment/assignments  (§7.3)
    //              POST /api/v1/examination/exams       (§7.2)
    // Both create with status DRAFT; the detail page adds questions or
    // milestones, then publishes.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    setDone(
      `POST ${isExam ? "/examination/exams" : "/assignment/assignments"} { status: "DRAFT" } — API not connected yet (Dev-B, ${isExam ? "C-TC-08" : "C-TC-13"}).`,
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>

      <h1 className="font-display text-[22px] font-bold text-foreground">
        {isExam ? "Create exam" : "Create assignment"}
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Saved as a draft. You&apos;ll add{" "}
        {isExam ? "questions" : "instructions and milestones"} next, then
        publish.
      </p>

      {done && (
        <FormAlert variant="info" className="mt-4">
          {done}
        </FormAlert>
      )}

      <Card className="mt-4 min-w-0 p-5 sm:p-6">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="cw-title" label="Title" error={errors.title}>
            <input
              id="cw-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isExam ? "Mid-term Examination — Algorithms" : "Binary trees — problem set 3"
              }
              className={inputCls(!!errors.title)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cw-subject" label="Subject" error={errors.subject}>
              <select
                id="cw-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputCls(!!errors.subject)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="cw-class" label="Class" error={errors.klass}>
              <select
                id="cw-class"
                value={klass}
                onChange={(e) => setKlass(e.target.value)}
                className={inputCls(!!errors.klass)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cw-type" label="Type">
              <select
                id="cw-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputCls(false)}
              >
                {(isExam
                  ? [["MCQ", "MCQ"], ["DESCRIPTIVE", "Descriptive"], ["MIXED", "Mixed"], ["QUIZ", "Quiz"]]
                  : [["REGULAR", "Regular"], ["MILESTONE", "Milestone"], ["GROUP", "Group"]]
                ).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>

            {isExam ? (
              <Field id="cw-mode" label="Mode">
                <select
                  id="cw-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className={inputCls(false)}
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </Field>
            ) : (
              <Field id="cw-due" label="Due date" error={errors.due}>
                <input
                  id="cw-due"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={inputCls(!!errors.due)}
                />
              </Field>
            )}
          </div>

          {isExam && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cw-start" label="Starts at" error={errors.due}>
                <input
                  id="cw-start"
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className={inputCls(!!errors.due)}
                />
              </Field>
              <Field
                id="cw-duration"
                label="Duration (minutes)"
                error={errors.duration}
              >
                <input
                  id="cw-duration"
                  type="number"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputCls(!!errors.duration)}
                />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cw-total" label="Total marks" error={errors.totalMarks}>
              <input
                id="cw-total"
                type="number"
                inputMode="numeric"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className={inputCls(!!errors.totalMarks)}
              />
            </Field>
            <Field
              id="cw-passing"
              label="Passing marks"
              error={errors.passingMarks}
            >
              <input
                id="cw-passing"
                type="number"
                inputMode="numeric"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className={inputCls(!!errors.passingMarks)}
              />
            </Field>
          </div>

          {!isExam && (
            <div className="min-w-0">
              {/* Explicit id + `for`, not just a wrapping label */}
              <label htmlFor="cw-allow-late" className="flex min-w-0 items-center gap-2.5">
                <input
                  id="cw-allow-late"
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                />
                <span className="text-[13px] text-[#334155]">
                  Allow late submission
                </span>
              </label>

              {allowLate && (
                <div className="mt-3 max-w-[220px]">
                  <Field
                    id="cw-penalty"
                    label="Late penalty (%)"
                    error={errors.penalty}
                  >
                    <input
                      id="cw-penalty"
                      type="number"
                      inputMode="numeric"
                      value={penalty}
                      onChange={(e) => setPenalty(e.target.value)}
                      className={inputCls(!!errors.penalty)}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <Field
            id="cw-description"
            label={isExam ? "Instructions" : "Description"}
          >
            <textarea
              id="cw-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isExam
                  ? "Anything candidates should read before starting…"
                  : "What should students produce, and how will it be marked?"
              }
              className={cn(inputCls(false), "h-auto py-2")}
            />
          </Field>

          {Object.keys(errors).length > 0 && (
            <FormAlert variant="error">
              Check the highlighted fields and try again.
            </FormAlert>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Link
              href={backHref}
              className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              loading={busy}
              loadingText="Saving…"
              className="w-auto px-5"
            >
              Save draft
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "mt-1.5 h-11 w-full min-w-0 rounded-field border bg-white px-3 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
    hasError
      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
      : "border-border focus:border-accent focus:ring-accent/15",
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[13px] font-medium text-[#334155]">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[12px] text-destructive-text">{error}</p>
      )}
    </div>
  );
}
