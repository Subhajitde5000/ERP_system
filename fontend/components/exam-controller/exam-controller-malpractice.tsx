"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Flag,
  RefreshCw,
  ShieldAlert,
  ShieldOff,
  ShieldX,
} from "lucide-react";

import { Tone } from "@/types/dashboard";
import {
  errorMessage,
  ExamControllerAPIError,
  ExamControllerMalpracticeAction,
  ExamControllerMalpracticeBoard,
  ExamControllerMalpracticeRow,
  fetchExamControllerMalpractice,
  resolveExamControllerMalpractice,
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const TYPE_LABEL: Record<string, string> = {
  TAB_SWITCH: "Tab switching",
  COPY_PASTE: "Copy / paste",
  MULTIPLE_IP: "Multiple IPs",
  REPORTED: "Reported by invigilator",
};

export function ExamControllerMalpracticePage() {
  const [board, setBoard] = useState<ExamControllerMalpracticeBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchExamControllerMalpractice();
      setBoard(data);
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

  const onAction = async (
    logId: string,
    action: ExamControllerMalpracticeAction,
  ) => {
    setBusyId(logId);
    try {
      await resolveExamControllerMalpractice(logId, { action, note: null });
      await load();
    } catch (err) {
      setError(errorMessage(err as ExamControllerAPIError | Error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Malpractice logs</h1>
          <p className="text-sm text-muted-foreground">
            Institution-wide flags. Resolve every flag — ignoring without a
            decision is itself an audit event.
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

      {board && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Open", value: board.open_count, tone: "warning" as Tone },
            { label: "Warned", value: board.warned, tone: "accent" as Tone },
            {
              label: "Disqualified",
              value: board.disqualified,
              tone: "danger" as Tone,
            },
            { label: "Ignored", value: board.ignored, tone: "muted" as Tone },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-2 text-2xl font-semibold">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading logs…
        </div>
      ) : !board || board.cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6" />
          No malpractice logs on record.
        </div>
      ) : (
        <div className="space-y-3">
          {board.cases.map((log: ExamControllerMalpracticeRow) => (
            <article
              key={log.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    {log.student_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {log.exam_title} · {log.subject_code} · {log.class_name}
                    {log.department_name ? ` · ${log.department_name}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(
                    log.action_taken === "DISQUALIFIED"
                      ? "danger"
                      : log.action_taken === "WARNED"
                        ? "warning"
                        : log.action_taken === "IGNORED"
                          ? "muted"
                          : "accent",
                  )}`}
                >
                  <Flag className="h-3 w-3" /> {TYPE_LABEL[log.type] ?? log.type}
                </span>
              </header>
              <p className="mt-2 text-sm">{log.description ?? "No description."}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Logged {formatDate(log.logged_at)} · tab switches{" "}
                {log.tab_switch_count} · attempt status{" "}
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.5 ${toneClass(
                    log.attempt_status === "MALPRACTICE"
                      ? "danger"
                      : log.attempt_status === "IN_PROGRESS"
                        ? "warning"
                        : "muted",
                  )}`}
                >
                  {log.attempt_status}
                </span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === log.id}
                  onClick={() => void onAction(log.id, "WARNED")}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <AlertTriangle className="h-3 w-3" /> Warn
                </button>
                <button
                  type="button"
                  disabled={busyId === log.id}
                  onClick={() => void onAction(log.id, "DISQUALIFIED")}
                  className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <ShieldX className="h-3 w-3" /> Disqualify
                </button>
                <button
                  type="button"
                  disabled={busyId === log.id}
                  onClick={() => void onAction(log.id, "IGNORED")}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  <ShieldOff className="h-3 w-3" /> Dismiss
                </button>
                {log.action_taken && (
                  <span className="text-xs text-muted-foreground">
                    Resolved as <strong>{log.action_taken}</strong>
                    {log.handled_by_name ? ` by ${log.handled_by_name}` : ""}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
