"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Eye,
  Flag,
  RefreshCw,
  Users,
} from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  errorMessage,
  ExamControllerAPIError,
  ExamControllerMonitorBoard,
  ExamControllerMonitoredExam,
  fetchExamControllerMonitor,
} from "@/lib/exam-controller-api";

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

function remainingTone(minutes: number): Tone {
  if (minutes < 0) return "danger";
  if (minutes <= 15) return "warning";
  return "success";
}

function formatTimeLeft(minutes: number): string {
  if (minutes < 0) return `overdue by ${Math.abs(minutes)}m`;
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
}

function Card({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass(
            tone,
          )}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function ExamBlock({ exam }: { exam: ExamControllerMonitoredExam }) {
  const tone = remainingTone(exam.minutes_remaining);
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{exam.exam.title}</h2>
          <p className="text-xs text-muted-foreground">
            {exam.exam.subject_code} · {exam.exam.class_name} ·{" "}
            {new Date(exam.exam.scheduled_at).toLocaleString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "short",
              timeZone: "Asia/Kolkata",
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
            tone,
          )}`}
        >
          <Clock className="h-3 w-3" /> {formatTimeLeft(exam.minutes_remaining)}
        </span>
      </header>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">In progress</p>
          <p className="text-lg font-semibold">{exam.in_progress}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Submitted</p>
          <p className="text-lg font-semibold">{exam.submitted}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Not started</p>
          <p className="text-lg font-semibold">{exam.not_started}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Response rate</p>
          <p className="text-lg font-semibold">{exam.response_rate}%</p>
        </div>
      </div>

      {exam.flagged > 0 && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">
          <Flag className="h-3 w-3" /> {exam.flagged} flagged attempt
          {exam.flagged === 1 ? "" : "s"} — open the malpractice board to action.
        </p>
      )}

      {exam.attempts.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            View {exam.attempts.length} attempt
            {exam.attempts.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {exam.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1"
              >
                <span>{attempt.student_name}</span>
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                    attempt.status === "MALPRACTICE"
                      ? toneClass("danger")
                      : attempt.status === "IN_PROGRESS"
                        ? toneClass("warning")
                        : toneClass("muted")
                  }`}
                >
                  {attempt.status}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export function ExamControllerMonitorPage() {
  const [board, setBoard] = useState<ExamControllerMonitorBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchExamControllerMonitor()
        .then((result) => {
          if (!cancelled) {
            setBoard(result);
            setError(null);
          }
        })
        .catch((err: ExamControllerAPIError | Error) => {
          if (!cancelled) setError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading monitor…
      </div>
    );
  }
  if (error || !board) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        Failed to load monitor: {error ?? "no data"}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Active exam monitor</h1>
          <p className="text-sm text-muted-foreground">
            Live view of running exams. Refreshes every 30 seconds.
          </p>
        </div>
        <Link
          href="/exam-controller/malpractice"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <AlertTriangle className="h-4 w-4" /> Malpractice board
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Candidates" value={board.total_candidates} icon={Users} tone="accent" />
        <Card
          label="In progress"
          value={board.total_in_progress}
          icon={Clock}
          tone="warning"
        />
        <Card label="Flagged" value={board.total_flagged} icon={Flag} tone="danger" />
      </div>

      {board.live.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Eye className="mx-auto mb-2 h-6 w-6" />
          No exams are currently running.
        </div>
      ) : (
        <div className="space-y-3">
          {board.live.map((exam) => (
            <ExamBlock key={exam.exam.id} exam={exam} />
          ))}
        </div>
      )}

      {board.starting_soon.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Starting soon
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {board.starting_soon.map((s) => (
              <li
                key={s.exam.id}
                className="flex items-center justify-between rounded-md border border-border/60 p-2"
              >
                <div>
                  <p className="font-medium">{s.exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.exam.subject_code} · {s.exam.class_name} · {s.mode}
                  </p>
                </div>
                <span className="text-xs font-medium">
                  {s.minutes_until_start}m to start
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
