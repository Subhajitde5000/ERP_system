"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Plus, RefreshCw, Send } from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  createExamControllerPublication,
  errorMessage,
  ExamControllerAPIError,
  ExamControllerCompilationPreview,
  ExamControllerPublicationPage,
  ExamControllerPublicationRow,
  ExamControllerResultCompilationContext,
  fetchExamControllerPublications,
  fetchExamControllerResultContext,
  forwardExamControllerPublication,
  previewExamControllerPublication,
} from "@/lib/exam-controller-api";

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  PENDING_APPROVAL: "warning",
  APPROVED: "accent",
  PUBLISHED: "success",
  WITHDRAWN: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  WITHDRAWN: "Withdrawn",
};

function toneClass(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "danger":
      return "bg-rose-100 text-rose-800";
    case "accent":
      return "bg-blue-100 text-blue-800";
    case "cyan":
      return "bg-cyan-100 text-cyan-800";
    case "muted":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function ExamControllerResultsPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<ExamControllerResultCompilationContext | null>(null);
  const [page, setPage] = useState<ExamControllerPublicationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("End-semester result compilation");
  const [classId, setClassId] = useState<string>("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<ExamControllerCompilationPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [context, publications] = await Promise.all([
        fetchExamControllerResultContext(),
        fetchExamControllerPublications({ limit: 50 }),
      ]);
      setCtx(context);
      setPage(publications);
      setError(null);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const groupedExams = useMemo(() => {
    if (!ctx) return [];
    const byClass = new Map<string, typeof ctx.available_exams>();
    for (const exam of ctx.available_exams) {
      const bucket = byClass.get(exam.class_id) ?? [];
      bucket.push(exam);
      byClass.set(exam.class_id, bucket);
    }
    return Array.from(byClass.entries()).map(([cid, exams]) => ({ cid, exams }));
  }, [ctx]);

  const onPreview = async () => {
    if (selected.length === 0) {
      setError("Select at least one exam to compile.");
      return;
    }
    try {
      const result = await previewExamControllerPublication(selected);
      setPreview(result);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  const onCompile = async () => {
    if (!ctx || !preview) return;
    setBusy(true);
    try {
      const created = await createExamControllerPublication({
        title: title.trim() || "Result compilation",
        academic_year_id: preview.by_exam[0]?.id ?? ctx.available_exams[0]?.id ?? "",
        class_id: classId || null,
        exam_ids: selected,
        note: note.trim() || null,
      });
      setSelected([]);
      setPreview(null);
      setNote("");
      router.push(`/exam-controller/results/${created.id}/publish`);
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusy(false);
    }
  };

  const onForward = async (id: string) => {
    try {
      await forwardExamControllerPublication(id, { note: null });
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Results compilation</h1>
          <p className="text-sm text-muted-foreground">
            Bundle completed exams into a publication, then forward for
            approval and release.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">1. Pick exams</h2>
            <p className="text-xs text-muted-foreground">
              Only exams in COMPLETED or RESULTS_RELEASED status are listed.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {groupedExams.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No exams available to compile.
                </p>
              )}
              {groupedExams.map(({ cid, exams }) => (
                <div
                  key={cid}
                  className="rounded-lg border border-border/60 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {exams[0]?.class_name}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {exams.map((exam) => (
                      <li
                        key={exam.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(exam.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, exam.id]
                                : selected.filter((id) => id !== exam.id),
                            )
                          }
                        />
                        <span>
                          {exam.subject_code} · {exam.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => void onPreview()}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Eye className="h-3 w-3" /> Preview compilation
            </button>
            {preview && (
              <div className="mt-3 grid gap-3 rounded-md border border-border/60 p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Exams</p>
                  <p className="text-base font-semibold">{preview.exam_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-base font-semibold">{preview.students}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="text-base font-semibold">
                    {preview.attempts_submitted}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending grading</p>
                  <p className="text-base font-semibold">
                    {preview.attempts_pending}
                  </p>
                </div>
              </div>
            )}
          </section>

          {preview && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">2. Compile into a publication</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Title
                  <input
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Target class (optional)
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    <option value="">— institution-wide —</option>
                    {ctx?.classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium sm:col-span-2">
                  Note (optional)
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCompile()}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> {busy ? "Compiling…" : "Compile"}
                </button>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Existing publications
            </h2>
            <ul className="mt-3 space-y-2">
              {page?.items.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No publications yet.
                </li>
              )}
              {page?.items.map((pub: ExamControllerPublicationRow) => (
                <li
                  key={pub.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{pub.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {pub.exam_titles.length} exams ·{" "}
                      {pub.class_name ?? "institution-wide"} · compiled{" "}
                      {formatDate(pub.compiled_at)} · {pub.student_count} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                        STATUS_TONE[pub.status] ?? "muted",
                      )}`}
                    >
                      {STATUS_LABEL[pub.status] ?? pub.status}
                    </span>
                    {pub.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => void onForward(pub.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        <Send className="h-3 w-3" /> Forward
                      </button>
                    )}
                    <Link
                      href={`/exam-controller/results/${pub.id}/publish`}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                    >
                      <Eye className="h-3 w-3" /> Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
