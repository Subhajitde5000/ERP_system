"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  addTeacherQuestion,
  createTeacherExam,
  deleteTeacherQuestion,
  fetchTeacherExamPaper,
  fetchTeacherExamResults,
  fetchTeacherExams,
  fetchTeacherMarkContext,
  updateTeacherExam,
  type QuestionType,
  type TeacherExamPaper,
  type TeacherExamResults,
  type TeacherExamRow,
  type TeacherQuestionOption,
} from "@/lib/teacher";
import {
  AsyncState,
  MetricCard,
  StatusPill,
  dateTime,
  percent,
} from "@/components/teacher/teacher-ui";

/** C-TC-07 — every exam on the subjects this teacher is assigned to. */
export function TeacherExaminationsPage() {
  const [status, setStatus] = useState("");
  const load = useCallback(() => fetchTeacherExams({ status: status || undefined }), [status]);
  const resource = useResource(load, [status]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Examinations"
        subtitle="Exams on your subjects. The Principal approves the schedule before you can publish."
        action={
          <Link
            href="/teacher/examinations/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Create exam
          </Link>
        }
      />

      <Card className="mb-5">
        <label className={labelClass} htmlFor="exam-status">
          Status
        </label>
        <select
          id="exam-status"
          className={`${inputClass} sm:max-w-xs`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="RESULTS_RELEASED">Results released</option>
          <option value="CANCELLED">Cancelled</option>
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
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
        ) : (
          <EmptyState text="You have not created any exams yet." />
        )}
      </AsyncState>
    </div>
  );
}

function ExamCard({ exam }: { exam: TeacherExamRow }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/teacher/examinations/${exam.id}`}
            className="font-display text-base font-bold text-primary hover:text-accent"
          >
            {exam.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {exam.class_name} · {exam.subject_code} · {exam.mode.toLowerCase()} ·{" "}
            {exam.total_marks} marks
          </p>
          <time className="mt-1 block text-[11px] font-medium text-accent">
            {dateTime(exam.scheduled_at)}
          </time>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={exam.status} />
          <StatusPill
            status={exam.schedule_approval_status}
            label={`Schedule ${exam.schedule_approval_status.toLowerCase()}`}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Stat label="Questions" value={exam.question_count} />
        <Stat label="Attempts" value={exam.attempt_count} />
        <Stat label="Submitted" value={exam.submitted_count} />
        <Stat
          label="To grade"
          value={exam.pending_grading_count}
          tone={exam.pending_grading_count ? "warning" : "default"}
        />
      </dl>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-sm font-semibold">
        <Link href={`/teacher/examinations/${exam.id}`} className="text-accent hover:underline">
          Edit
        </Link>
        <Link
          href={`/teacher/examinations/${exam.id}/questions`}
          className="text-accent hover:underline"
        >
          Questions ({exam.question_count})
        </Link>
        <Link
          href={`/teacher/examinations/${exam.id}/results`}
          className="text-accent hover:underline"
        >
          Results
        </Link>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 font-display text-base font-bold ${
          tone === "warning" && value ? "text-warning-text" : "text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** C-TC-08 — create an exam. It always starts as a DRAFT pending approval. */
export function TeacherExamFormPage({ examId }: { examId?: string }) {
  const router = useRouter();
  const context = useResource(() => fetchTeacherMarkContext(), []);
  const existing = useResource(
    useCallback(() => (examId ? fetchTeacherExamPaper(examId) : Promise.resolve(null)), [examId]),
    [examId],
  );

  const [form, setForm] = useState({
    title: "",
    subject_id: "",
    exam_type: "MCQ",
    mode: "ONLINE",
    total_marks: "50",
    passing_marks: "20",
    duration_minutes: "60",
    scheduled_at: "",
    window_end_at: "",
    instructions: "",
    allow_review: false,
    shuffle_questions: false,
    show_score_immediately: false,
  });
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exam = existing.data?.exam;
  if (exam && !seeded) {
    setSeeded(true);
    setForm({
      title: exam.title,
      subject_id: exam.subject_id,
      exam_type: exam.exam_type,
      mode: exam.mode,
      total_marks: String(exam.total_marks),
      passing_marks: String(exam.passing_marks),
      duration_minutes: String(exam.duration_minutes),
      scheduled_at: exam.scheduled_at.slice(0, 16),
      window_end_at: exam.window_end_at?.slice(0, 16) ?? "",
      instructions: exam.instructions ?? "",
      allow_review: exam.allow_review,
      shuffle_questions: exam.shuffle_questions,
      show_score_immediately: exam.show_score_immediately,
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      subject_id: form.subject_id,
      exam_type: form.exam_type,
      mode: form.mode,
      total_marks: Number(form.total_marks),
      passing_marks: Number(form.passing_marks),
      duration_minutes: Number(form.duration_minutes),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      window_end_at: form.window_end_at ? new Date(form.window_end_at).toISOString() : null,
      instructions: form.instructions.trim() || null,
      allow_review: form.allow_review,
      shuffle_questions: form.shuffle_questions,
      show_score_immediately: form.show_score_immediately,
    };
    try {
      if (examId) {
        // `subject_id` is fixed after creation: moving an exam to another
        // subject would move it to another class and orphan every attempt.
        const editable: Record<string, unknown> = { ...payload };
        delete editable.subject_id;
        await updateTeacherExam(examId, editable);
        router.push(`/teacher/examinations/${examId}/questions`);
      } else {
        const created = await createTeacherExam(payload);
        router.push(`/teacher/examinations/${created.id}/questions`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the exam.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={examId ? "Edit exam" : "Create exam"}
        subtitle="Saved as a draft. The Principal approves the schedule before it can be published."
      />
      <AsyncState
        loading={context.loading || existing.loading}
        error={context.error ?? existing.error}
        onRetry={context.reload}
        loadingLabel="Loading your subjects…"
      >
        <form onSubmit={submit} className="space-y-5">
          <Card className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="exam-title">
                Title
              </label>
              <input
                id="exam-title"
                className={inputClass}
                value={form.title}
                minLength={3}
                required
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="exam-subject">
                  Subject
                </label>
                <select
                  id="exam-subject"
                  className={inputClass}
                  value={form.subject_id}
                  required
                  disabled={Boolean(examId)}
                  onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
                >
                  <option value="">Select subject</option>
                  {(context.data?.subjects ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.class_name} · {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-type">
                  Type
                </label>
                <select
                  id="exam-type"
                  className={inputClass}
                  value={form.exam_type}
                  onChange={(event) => setForm({ ...form, exam_type: event.target.value })}
                >
                  <option value="MCQ">MCQ</option>
                  <option value="DESCRIPTIVE">Descriptive</option>
                  <option value="MIXED">Mixed</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-mode">
                  Mode
                </label>
                <select
                  id="exam-mode"
                  className={inputClass}
                  value={form.mode}
                  onChange={(event) => setForm({ ...form, mode: event.target.value })}
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline (hall)</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-duration">
                  Duration (minutes)
                </label>
                <input
                  id="exam-duration"
                  type="number"
                  min={5}
                  max={600}
                  className={inputClass}
                  value={form.duration_minutes}
                  onChange={(event) =>
                    setForm({ ...form, duration_minutes: event.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-total">
                  Total marks
                </label>
                <input
                  id="exam-total"
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.total_marks}
                  onChange={(event) => setForm({ ...form, total_marks: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-pass">
                  Passing marks
                </label>
                <input
                  id="exam-pass"
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.passing_marks}
                  onChange={(event) => setForm({ ...form, passing_marks: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-start">
                  Starts at
                </label>
                <input
                  id="exam-start"
                  type="datetime-local"
                  className={inputClass}
                  value={form.scheduled_at}
                  required
                  onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="exam-end">
                  Window closes (optional)
                </label>
                <input
                  id="exam-end"
                  type="datetime-local"
                  className={inputClass}
                  value={form.window_end_at}
                  onChange={(event) => setForm({ ...form, window_end_at: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="exam-instructions">
                Instructions
              </label>
              <textarea
                id="exam-instructions"
                rows={4}
                className={`${inputClass} h-auto py-2.5`}
                value={form.instructions}
                onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              />
            </div>
            <fieldset className="space-y-2 border-t border-border pt-4">
              <legend className="sr-only">Exam options</legend>
              {(
                [
                  ["allow_review", "Let students review their answers after results are released"],
                  ["shuffle_questions", "Shuffle question order per student"],
                  ["show_score_immediately", "Show the objective score on submit"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                    className="h-4 w-4 rounded border-border text-accent"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </Card>

          {error ? (
            <p role="alert" className="text-sm text-destructive-text">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : examId ? "Save changes" : "Create and add questions"}
          </button>
        </form>
      </AsyncState>
    </div>
  );
}

/** C-TC-10 — add MCQ / true-false / descriptive questions to a draft paper. */
export function TeacherExamQuestionsPage({ examId }: { examId: string }) {
  const load = useCallback(() => fetchTeacherExamPaper(examId), [examId]);
  const resource = useResource(load, [examId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(questionId: string) {
    setBusy(true);
    setError(null);
    try {
      resource.setData(await deleteTeacherQuestion(examId, questionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Question paper"
        subtitle="Objective questions are auto-scored on submit; descriptive ones come to you for grading."
        action={
          <Link
            href={`/teacher/examinations/${examId}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Exam settings
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading the paper…"
      >
        {resource.data ? (
          <QuestionBoard
            paper={resource.data}
            busy={busy}
            error={error}
            onAdded={(next) => resource.setData(next)}
            onError={setError}
            onRemove={remove}
            examId={examId}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

function QuestionBoard({
  paper,
  examId,
  busy,
  error,
  onAdded,
  onError,
  onRemove,
}: {
  paper: TeacherExamPaper;
  examId: string;
  busy: boolean;
  error: string | null;
  onAdded: (next: TeacherExamPaper) => void;
  onError: (message: string | null) => void;
  onRemove: (questionId: string) => void;
}) {
  const allocated = paper.questions.reduce((total, question) => total + question.marks, 0);
  const remaining = paper.exam.total_marks - allocated;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-primary">{paper.exam.title}</h2>
            <p className="text-xs text-muted-foreground">
              {paper.exam.class_name} · {paper.exam.subject_code}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-primary">
              {allocated} / {paper.exam.total_marks}
            </p>
            <p
              className={`text-[11px] font-semibold ${
                remaining === 0 ? "text-success-text" : "text-warning-text"
              }`}
            >
              {remaining === 0
                ? "Marks balance"
                : remaining > 0
                  ? `${remaining} marks unallocated`
                  : `${Math.abs(remaining)} marks over`}
            </p>
          </div>
        </div>
      </Card>

      {paper.questions.length ? (
        <ol className="space-y-3">
          {paper.questions.map((question, index) => (
            <Card key={question.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">
                    {index + 1}. {question.text}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.question_type.replace(/_/g, " ").toLowerCase()} · {question.marks}{" "}
                    marks
                    {question.negative_marks
                      ? ` · −${question.negative_marks} for a wrong answer`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(question.id)}
                  aria-label={`Remove question ${index + 1}`}
                  className="rounded p-1.5 text-destructive-text hover:bg-destructive-light disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {question.options.length ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {question.options.map((option) => (
                    <li
                      key={option.id ?? option.text}
                      className={`text-sm ${
                        option.is_correct
                          ? "font-semibold text-success-text"
                          : "text-muted-foreground"
                      }`}
                    >
                      {option.is_correct ? "✓ " : "· "}
                      {option.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </ol>
      ) : (
        <EmptyState text="No questions yet. Add the first one below." />
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      <QuestionForm examId={examId} onAdded={onAdded} onError={onError} />
    </div>
  );
}

const OBJECTIVE_TYPES: QuestionType[] = ["MCQ", "TRUE_FALSE"];

function QuestionForm({
  examId,
  onAdded,
  onError,
}: {
  examId: string;
  onAdded: (next: TeacherExamPaper) => void;
  onError: (message: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("MCQ");
  const [marks, setMarks] = useState("1");
  const [negative, setNegative] = useState("0");
  const [options, setOptions] = useState<TeacherQuestionOption[]>([
    { text: "", is_correct: true, sort_order: 0 },
    { text: "", is_correct: false, sort_order: 1 },
  ]);
  const [busy, setBusy] = useState(false);

  const objective = OBJECTIVE_TYPES.includes(type);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const next = await addTeacherQuestion(examId, {
        text: text.trim(),
        question_type: type,
        marks: Number(marks),
        negative_marks: Number(negative),
        options: objective
          ? options
              .filter((option) => option.text.trim())
              .map((option, index) => ({ ...option, sort_order: index }))
          : [],
      });
      onAdded(next);
      setText("");
      setOptions([
        { text: "", is_correct: true, sort_order: 0 },
        { text: "", is_correct: false, sort_order: 1 },
      ]);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not add the question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 font-display text-sm font-bold text-primary">Add a question</h3>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="question-text">
            Question
          </label>
          <textarea
            id="question-text"
            rows={3}
            required
            className={`${inputClass} h-auto py-2.5`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="question-type">
              Type
            </label>
            <select
              id="question-type"
              className={inputClass}
              value={type}
              onChange={(event) => setType(event.target.value as QuestionType)}
            >
              <option value="MCQ">Multiple choice</option>
              <option value="TRUE_FALSE">True / false</option>
              <option value="SHORT_ANSWER">Short answer</option>
              <option value="LONG_ANSWER">Long answer</option>
              <option value="FILL_BLANK">Fill in the blank</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="question-marks">
              Marks
            </label>
            <input
              id="question-marks"
              type="number"
              min={0.5}
              step={0.5}
              className={inputClass}
              value={marks}
              onChange={(event) => setMarks(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="question-negative">
              Negative marks
            </label>
            <input
              id="question-negative"
              type="number"
              min={0}
              step={0.25}
              className={inputClass}
              value={negative}
              disabled={!objective}
              onChange={(event) => setNegative(event.target.value)}
            />
          </div>
        </div>

        {objective ? (
          <fieldset className="space-y-2">
            <legend className={labelClass}>Options — tick the correct one</legend>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  aria-label={`Option ${index + 1} is correct`}
                  checked={option.is_correct}
                  onChange={() =>
                    setOptions((current) =>
                      current.map((item, position) => ({
                        ...item,
                        is_correct: position === index,
                      })),
                    )
                  }
                  className="h-4 w-4 text-accent"
                />
                <input
                  className={inputClass}
                  placeholder={`Option ${index + 1}`}
                  value={option.text}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, text: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  { text: "", is_correct: false, sort_order: current.length },
                ])
              }
              className="text-sm font-semibold text-accent hover:underline"
            >
              Add another option
            </button>
          </fieldset>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {busy ? "Adding…" : "Add question"}
        </button>
      </form>
    </Card>
  );
}

/** C-TC-11 — the attempt list plus what still needs a human grade. */
export function TeacherExamResultsPage({ examId }: { examId: string }) {
  const load = useCallback(() => fetchTeacherExamResults(examId), [examId]);
  const resource = useResource(load, [examId]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Exam results"
        subtitle="Objective answers are already scored. Open an attempt to grade the descriptive ones."
        action={
          <Link
            href="/teacher/examinations"
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
        loadingLabel="Loading results…"
      >
        {resource.data ? <ResultsBody data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function ResultsBody({ data }: { data: TeacherExamResults }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Attempts" value={data.attempts.length} hint={data.exam.title} />
        <MetricCard
          label="Average"
          value={percent(data.average_percentage)}
          hint={`Out of ${data.exam.total_marks} marks`}
        />
        <MetricCard label="Passed" value={data.pass_count} tone="success" />
        <MetricCard label="Failed" value={data.fail_count} tone={data.fail_count ? "danger" : "default"} />
      </section>

      <Card className="!p-0">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-bold text-primary">Attempts</h2>
        </div>
        {data.attempts.length ? (
          <ul className="divide-y divide-border">
            {data.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/teacher/attempts/${attempt.id}`}
                    className="text-sm font-semibold text-primary hover:text-accent"
                  >
                    {attempt.student_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {attempt.roll_number ?? "—"}
                    {attempt.submitted_at ? ` · ${dateTime(attempt.submitted_at)}` : " · in progress"}
                    {attempt.tab_switch_count
                      ? ` · ${attempt.tab_switch_count} tab switches`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {attempt.ungraded_count ? (
                    <StatusPill
                      status="UNGRADED"
                      tone="warning"
                      label={`${attempt.ungraded_count} to grade`}
                    />
                  ) : (
                    <StatusPill status={attempt.status} />
                  )}
                  <p className="w-20 text-right text-sm font-semibold text-primary">
                    {attempt.total_score === null
                      ? "—"
                      : `${attempt.total_score}/${data.exam.total_marks}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nobody has attempted this exam yet.
          </div>
        )}
      </Card>

      {data.not_attempted.length ? (
        <Card className="border-warning-border">
          <h2 className="font-display text-sm font-bold text-primary">Not attempted</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.not_attempted.length} student(s) on the roster have no attempt.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.not_attempted.map((student) => (
              <li
                key={student.student_id}
                className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-semibold text-warning-text"
              >
                {student.name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
