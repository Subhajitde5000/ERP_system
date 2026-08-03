"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardList,
  Eye,
  Flag,
  Megaphone,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  ExamControllerAPIError,
  errorMessage,
  ExamControllerDashboard,
  fetchExamControllerDashboard,
} from "@/lib/exam-controller-api";

/**
 * C-EC-01 — Exam Controller landing page.
 *
 * Aggregates every KPI the controller's first screen needs: a status
 * bucket, upcoming and ongoing exams, pending grading, pending hall
 * allocation, pending publication, flagged attempts and the next
 * publication awaiting approval. Every figure is served by the
 * institution-wide `/api/v1/exam-controller/dashboard` endpoint.
 */

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
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function ExamControllerDashboardPage() {
  const [data, setData] = useState<ExamControllerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExamControllerDashboard()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: ExamControllerAPIError | Error) => {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        Failed to load dashboard: {error ?? "no data"}
      </div>
    );
  }

  const kpis = [
    {
      label: "Total exams",
      value: data.total_exams,
      icon: ClipboardList,
      tone: "accent" as Tone,
    },
    {
      label: "Pending grading",
      value: data.pending_grading,
      icon: CheckCircle2,
      tone: "warning" as Tone,
    },
    {
      label: "Pending halls",
      value: data.pending_hall_allocation,
      icon: AlertTriangle,
      tone: "warning" as Tone,
    },
    {
      label: "Pending publication",
      value: data.pending_publication,
      icon: Megaphone,
      tone: "accent" as Tone,
    },
    {
      label: "Flagged attempts",
      value: data.flagged_attempts,
      icon: Flag,
      tone: "danger" as Tone,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Examination dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.academic_year ? `Academic year ${data.academic_year}` : "Institution-wide"} ·{" "}
            {data.today}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/exam-controller/schedule/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Schedule exam
          </Link>
          <Link
            href="/exam-controller/halls"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Hall board
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{kpi.value}</p>
                </div>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass(
                    kpi.tone,
                  )}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By status
          </h2>
          <ul className="mt-3 space-y-2">
            {data.by_status.length === 0 && (
              <li className="text-sm text-muted-foreground">No exams yet.</li>
            )}
            {data.by_status.map((bucket) => (
              <li
                key={bucket.status}
                className="flex items-center justify-between text-sm"
              >
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                    STATUS_TONE[bucket.status] ?? "muted",
                  )}`}
                >
                  {STATUS_LABEL[bucket.status] ?? bucket.status}
                </span>
                <span className="font-semibold">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming exams
            </h2>
            <Link
              href="/exam-controller/schedule"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {data.upcoming.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nothing on the schedule.
              </li>
            )}
            {data.upcoming.slice(0, 6).map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between rounded-md border border-border/60 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.subject_code} · {exam.class_name} · {exam.department_name ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(exam.scheduled_at)}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                      STATUS_TONE[exam.status] ?? "muted",
                    )}`}
                  >
                    {STATUS_LABEL[exam.status] ?? exam.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ongoing now
            </h2>
            <Link
              href="/exam-controller/monitor"
              className="text-xs font-medium text-primary hover:underline"
            >
              Monitor
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {data.ongoing.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No live exams right now.
              </li>
            )}
            {data.ongoing.map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between rounded-md border border-border/60 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.subject_code} · {exam.class_name}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {exam.enrolled_count} enrolled
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Result publications
            </h2>
            <Link
              href="/exam-controller/results"
              className="text-xs font-medium text-primary hover:underline"
            >
              Manage
            </Link>
          </div>
          {data.next_publication ? (
            <div className="mt-3 rounded-md border border-border/60 p-3">
              <p className="text-sm font-semibold">{data.next_publication.title}</p>
              <p className="text-xs text-muted-foreground">
                {data.next_publication.exam_titles.length} exams ·{" "}
                {data.next_publication.class_name ?? "institution-wide"} · compiled{" "}
                {formatDate(data.next_publication.compiled_at)}
              </p>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/exam-controller/results/${data.next_publication.id}/publish`}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                >
                  <Megaphone className="h-3 w-3" /> Review &amp; publish
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No publication is awaiting approval.
            </p>
          )}

          <h3 className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
            Recent
          </h3>
          <ul className="mt-2 space-y-1.5">
            {data.recent_publishes.length === 0 && (
              <li className="text-sm text-muted-foreground">No history yet.</li>
            )}
            {data.recent_publishes.slice(0, 4).map((pub) => (
              <li
                key={pub.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">{pub.title}</span>
                <span className="text-xs text-muted-foreground">
                  {pub.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <CalendarIcon className="mr-2 inline h-4 w-4" />
        Calendar week view coming soon — until then, the dedicated
        <Link
          href="/exam-controller/calendar"
          className="ml-1 font-medium text-primary hover:underline"
        >
          calendar
        </Link>{" "}
        lists every academic event.
      </div>
    </div>
  );
}
