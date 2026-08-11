"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, Save } from "lucide-react";

import {
  checkExamControllerClashes,
  createExamControllerExam,
  ExamControllerAPIError,
  ExamControllerExamCreate,
  ExamControllerExamMode,
  ExamControllerExamType,
  ExamControllerScheduleClash,
  ExamControllerScheduleContext,
  errorMessage,
  fetchExamControllerScheduleContext,
  updateExamControllerExam,
} from "@/lib/exam-controller-api";

interface FormState {
  title: string;
  subject_id: string;
  class_id: string;
  academic_year_id: string;
  exam_type: ExamControllerExamType;
  mode: ExamControllerExamMode;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
  scheduled_at: string;
  window_end_at: string;
  instructions: string;
  allow_review: boolean;
  shuffle_questions: boolean;
  show_score_immediately: boolean;
  rooms: string[];
  invigilator_ids: string[];
}

const defaultForm: FormState = {
  title: "",
  subject_id: "",
  class_id: "",
  academic_year_id: "",
  exam_type: "MCQ",
  mode: "ONLINE",
  total_marks: 100,
  passing_marks: 40,
  duration_minutes: 90,
  scheduled_at: "",
  window_end_at: "",
  instructions: "",
  allow_review: false,
  shuffle_questions: false,
  show_score_immediately: false,
  rooms: [],
  invigilator_ids: [],
};

function formatIsoForInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ExamControllerScheduleForm({
  editingId,
}: {
  editingId?: string;
}) {
  const router = useRouter();
  const [context, setContext] = useState<ExamControllerScheduleContext | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [clashes, setClashes] = useState<ExamControllerScheduleClash[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    subject_id: string;
    class_id: string;
    academic_year_id: string;
    scheduled_at: string;
    duration_minutes: number;
    title: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ctx = await fetchExamControllerScheduleContext();
        if (cancelled) return;
        setContext(ctx);
        if (ctx.classes.length > 0) {
          // best-effort: keep the form blank for the user to pick
        }
        // Pre-fill academic_year_id from the current active year returned by context
        if (ctx.current_academic_year_id) {
          setForm((prev) => ({ ...prev, academic_year_id: ctx.current_academic_year_id! }));
        }
        if (editingId) {
          const { fetchExamControllerExam } = await import("@/lib/exam-controller-api");
          const exam = await fetchExamControllerExam(editingId);
          if (!cancelled) {
            setEditing({
              subject_id: exam.subject_id,
              class_id: exam.class_id,
              academic_year_id: exam.academic_year_id ?? "",
              scheduled_at: exam.scheduled_at,
              duration_minutes: exam.duration_minutes,
              title: exam.title,
            });
            setForm({
              ...defaultForm,
              title: exam.title,
              subject_id: exam.subject_id,
              class_id: exam.class_id,
              academic_year_id: exam.academic_year_id ?? ctx.current_academic_year_id ?? "",
              exam_type: exam.exam_type as ExamControllerExamType,
              mode: exam.mode as ExamControllerExamMode,
              total_marks: exam.total_marks,
              passing_marks: exam.passing_marks,
              duration_minutes: exam.duration_minutes,
              scheduled_at: formatIsoForInput(exam.scheduled_at),
              window_end_at: exam.window_end_at
                ? formatIsoForInput(exam.window_end_at)
                : "",
              instructions: "",
              allow_review: false,
              shuffle_questions: false,
              show_score_immediately: false,
            });
          }
        } else if (ctx.classes.length > 0) {
          // set first class as default to make life easier
          setForm((prev) => ({ ...prev, class_id: ctx.classes[0].id }));
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err as ExamControllerAPIError | Error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const subjects = useMemo(() => {
    if (!context) return [];
    if (!form.class_id) return context.subjects;
    // Without a class_id link in the API, return all subjects
    return context.subjects;
  }, [context, form.class_id]);

  useEffect(() => {
    if (!form.scheduled_at || !form.class_id || !form.duration_minutes) {
      setClashes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await checkExamControllerClashes({
          title: form.title,
          subject_id: form.subject_id,
          class_id: form.class_id,
          academic_year_id: form.academic_year_id,
          exam_type: form.exam_type,
          mode: form.mode,
          total_marks: form.total_marks,
          passing_marks: form.passing_marks,
          duration_minutes: form.duration_minutes,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          window_end_at: form.window_end_at
            ? new Date(form.window_end_at).toISOString()
            : null,
          instructions: form.instructions || null,
          allow_review: form.allow_review,
          shuffle_questions: form.shuffle_questions,
          show_score_immediately: form.show_score_immediately,
          rooms: form.rooms,
          invigilator_names: [],
          editing_exam_id: editingId ?? null,
        });
        if (!cancelled) setClashes(result.clashes);
      } catch {
        if (!cancelled) {
          setClashes([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    form.scheduled_at,
    form.class_id,
    form.duration_minutes,
    form.rooms,
    form.subject_id,
    form.academic_year_id,
    form.exam_type,
    form.mode,
    form.total_marks,
    form.passing_marks,
    form.window_end_at,
    form.instructions,
    form.allow_review,
    form.shuffle_questions,
    form.show_score_immediately,
    form.title,
    editingId,
  ]);

  const hasBlocking = clashes.some((c) => c.blocking);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!form.class_id) throw new Error("Class is required");
      if (!form.subject_id) throw new Error("Subject is required");
      if (!form.academic_year_id) throw new Error("No active academic year found. Please set one in institution settings.");
      const payload: ExamControllerExamCreate = {
        title: form.title.trim(),
        subject_id: form.subject_id,
        class_id: form.class_id,
        academic_year_id: form.academic_year_id,
        exam_type: form.exam_type,
        mode: form.mode,
        total_marks: form.total_marks,
        passing_marks: form.passing_marks,
        duration_minutes: form.duration_minutes,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        window_end_at: form.window_end_at
          ? new Date(form.window_end_at).toISOString()
          : null,
        instructions: form.instructions || null,
        allow_review: form.allow_review,
        shuffle_questions: form.shuffle_questions,
        show_score_immediately: form.show_score_immediately,
      };
      if (editingId) {
        await updateExamControllerExam(editingId, payload);
      } else {
        await createExamControllerExam(payload);
      }
      router.push("/exam-controller/schedule");
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading form…
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 p-6"
    >
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {editingId ? "Edit exam" : "Schedule exam"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {editing
              ? `Editing ${editing.title}`
              : "Choose a class, subject and a start time. The form checks for clashes before saving."}
          </p>
        </div>
        <Link
          href="/exam-controller/schedule"
          className="text-sm text-primary hover:underline"
        >
          ← Back to schedule
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium">
          Title
          <input
            required
            minLength={1}
            maxLength={255}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium">
          Class
          <select
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.class_id}
            onChange={(e) => setForm({ ...form, class_id: e.target.value })}
          >
            <option value="">Select a class…</option>
            {context?.classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} {cls.department_name ? `· ${cls.department_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Subject
          <select
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.subject_id}
            onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
          >
            <option value="">Select a subject…</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.code} — {sub.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Exam type
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.exam_type}
            onChange={(e) =>
              setForm({ ...form, exam_type: e.target.value as ExamControllerExamType })
            }
          >
            <option value="MCQ">MCQ</option>
            <option value="DESCRIPTIVE">Descriptive</option>
            <option value="MIXED">Mixed</option>
            <option value="QUIZ">Quiz</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Mode
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.mode}
            onChange={(e) =>
              setForm({ ...form, mode: e.target.value as ExamControllerExamMode })
            }
          >
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline (hall allocation needed)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Duration (minutes)
          <input
            type="number"
            min={1}
            max={24 * 60}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.duration_minutes}
            onChange={(e) =>
              setForm({ ...form, duration_minutes: Number(e.target.value) || 1 })
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Total marks
          <input
            type="number"
            min={1}
            max={1000}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.total_marks}
            onChange={(e) =>
              setForm({ ...form, total_marks: Number(e.target.value) || 1 })
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Passing marks
          <input
            type="number"
            min={0}
            max={form.total_marks}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.passing_marks}
            onChange={(e) =>
              setForm({ ...form, passing_marks: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block text-sm font-medium">
          Start time
          <input
            type="datetime-local"
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium">
          Window end (optional)
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.window_end_at}
            onChange={(e) => setForm({ ...form, window_end_at: e.target.value })}
          />
        </label>
        <label className="block text-sm font-medium lg:col-span-2">
          Instructions (optional)
          <textarea
            maxLength={4000}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allow_review}
            onChange={(e) => setForm({ ...form, allow_review: e.target.checked })}
          />
          Allow review after submission
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.shuffle_questions}
            onChange={(e) =>
              setForm({ ...form, shuffle_questions: e.target.checked })
            }
          />
          Shuffle questions
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.show_score_immediately}
            onChange={(e) =>
              setForm({ ...form, show_score_immediately: e.target.checked })
            }
          />
          Show score immediately
        </label>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Clash check</h2>
        {clashes.length === 0 ? (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> No clashes detected.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {clashes.map((c, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-md border px-2 py-1 ${
                  c.blocking
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Link
          href="/exam-controller/schedule"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || hasBlocking}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {submitting ? "Saving…" : editingId ? "Save changes" : "Schedule exam"}
        </button>
      </div>
    </form>
  );
}
