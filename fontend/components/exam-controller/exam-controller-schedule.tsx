"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, RefreshCw } from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  ExamControllerAPIError,
  errorMessage,
  ExamControllerExamRow,
  ExamControllerExamStatus,
  ExamControllerExamStatusAction,
  ExamControllerExamPage,
  fetchExamControllerSchedule,
  updateExamControllerExamStatus,
} from "@/lib/exam-controller-api";

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "muted",
  PUBLISHED: "accent",
  ONGOING: "success",
  COMPLETED: "cyan",
  RESULTS_RELEASED: "success",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  RESULTS_RELEASED: "Results released",
  CANCELLED: "Cancelled",
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const STATUS_FILTERS: ExamControllerExamStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ONGOING",
  "COMPLETED",
  "RESULTS_RELEASED",
  "CANCELLED",
];

export function ExamControllerSchedulePage() {
  const [page, setPage] = useState<ExamControllerExamPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExamControllerExamStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExamControllerSchedule({
      status: statusFilter || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      limit: 100,
    })
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setError(null);
        }
      })
      .catch((err: ExamControllerAPIError | Error) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, fromDate, toDate]);

  const grouped = useMemo(() => {
    if (!page) return [] as { date: string; items: ExamControllerExamRow[] }[];
    const map = new Map<string, ExamControllerExamRow[]>();
    for (const exam of page.items) {
      const date = exam.scheduled_at.slice(0, 10);
      const bucket = map.get(date) ?? [];
      bucket.push(exam);
      map.set(date, bucket);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
      }));
  }, [page]);

  const onAction = async (id: string, action: ExamControllerExamStatusAction) => {
    setBusyId(id);
    try {
      const updated = await updateExamControllerExamStatus(id, {
        action,
        note: null,
      });
      if (page) {
        setPage({
          ...page,
          items: page.items.map((it) => (it.id === id ? updated : it)),
        });
      }
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Exam schedule</h1>
          <p className="text-sm text-muted-foreground">
            Institution-wide exam timetable, sorted by date.
          </p>
        </div>
        <Link
          href="/exam-controller/schedule/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Schedule exam
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ExamControllerExamStatus | "")
          }
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          type="date"
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setStatusFilter("");
            setFromDate("");
            setToDate("");
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
        >
          <RefreshCw className="h-3 w-3" /> Reset
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading schedule…
        </div>
      ) : !page || page.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No exams match the current filter.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section
              key={group.date}
              className="rounded-xl border border-border bg-card shadow-sm"
            >
              <header className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-sm font-semibold">
                <span>
                  {new Date(group.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {group.items.length} exam{group.items.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="divide-y divide-border/60">
                {group.items.map((exam) => (
                  <li
                    key={exam.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.subject_code} · {exam.class_name} ·{" "}
                        {exam.department_name ?? "—"} · {formatDate(exam.scheduled_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {exam.exam_type} · {exam.mode} · {exam.duration_minutes}m ·{" "}
                        {exam.total_marks} marks
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                          STATUS_TONE[exam.status] ?? "muted",
                        )}`}
                      >
                        {STATUS_LABEL[exam.status] ?? exam.status}
                      </span>
                      <Link
                        href={`/exam-controller/schedule/${exam.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                      {exam.status === "DRAFT" && (
                        <button
                          type="button"
                          disabled={busyId === exam.id}
                          onClick={() => onAction(exam.id, "PUBLISH")}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      {(exam.status === "PUBLISHED" || exam.status === "ONGOING") && (
                        <button
                          type="button"
                          disabled={busyId === exam.id}
                          onClick={() => onAction(exam.id, "COMPLETE")}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {exam.status === "COMPLETED" && (
                        <button
                          type="button"
                          disabled={busyId === exam.id}
                          onClick={() => onAction(exam.id, "RELEASE_RESULTS")}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          Release results
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
