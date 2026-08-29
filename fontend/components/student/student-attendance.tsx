"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  applyStudentLeave,
  cancelStudentLeave,
  fetchStudentAttendance,
  fetchStudentAttendanceCalendar,
  fetchStudentLeaves,
} from "@/lib/student";
import { AsyncState, MetricCard, dateOnly, dateTime, percent, statusLabel } from "@/components/principal/principal-ui";

/** C-ST-03 — overall + per-subject attendance, own leave requests. */
export function StudentAttendancePage() {
  const summary = useResource(fetchStudentAttendance, []);
  const leaves = useResource(() => fetchStudentLeaves({ limit: 100 }), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(leaveId: string) {
    setBusyId(leaveId);
    setActionError(null);
    try {
      const updated = await cancelStudentLeave(leaveId);
      if (leaves.data) {
        leaves.setData({ ...leaves.data, items: leaves.data.items.map((leave) => (leave.id === leaveId ? updated : leave)) });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not cancel this leave request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My attendance"
        subtitle="Your presence across subjects, and your leave applications."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/student/attendance/calendar" className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
              Calendar view
            </Link>
            <Link href="/student/attendance/leaves/new" className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover">
              <Plus className="h-4 w-4" /> Apply for leave
            </Link>
          </div>
        }
      />
      <AsyncState loading={summary.loading} error={summary.error} onRetry={summary.reload} loadingLabel="Loading your attendance…">
        {summary.data ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Overall attendance"
                value={summary.data.attendance_percentage !== null ? percent(summary.data.attendance_percentage) : "—"}
                hint={`${summary.data.total_marks} sessions marked`}
                tone={
                  summary.data.attendance_percentage === null
                    ? "default"
                    : summary.data.attendance_percentage < 75
                      ? "warning"
                      : "success"
                }
              />
              <MetricCard label="Present" value={summary.data.present_count} tone="success" hint="Sessions attended" />
              <MetricCard label="Absent" value={summary.data.absent_count} hint="Sessions missed" tone={summary.data.absent_count ? "warning" : "default"} />
              <MetricCard label="Late / excused" value={summary.data.late_count + summary.data.excused_count} hint="Counted as attended" />
            </section>
            <Card className="!p-0">
              {summary.data.subjects.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3">Present</th>
                        <th className="px-5 py-3">Absent</th>
                        <th className="px-5 py-3">Late</th>
                        <th className="px-5 py-3">Excused</th>
                        <th className="px-5 py-3">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.data.subjects.map((subject) => (
                        <tr key={subject.subject_id}>
                          <td className="px-5 py-3 font-semibold text-primary">
                            {subject.subject_name}
                            <span className="block text-[11px] font-normal text-muted-foreground">{subject.subject_code}</span>
                          </td>
                          <td className="px-5 py-3 text-success-text">{subject.present_count}</td>
                          <td className="px-5 py-3 text-destructive-text">{subject.absent_count}</td>
                          <td className="px-5 py-3 text-warning-text">{subject.late_count}</td>
                          <td className="px-5 py-3 text-muted-foreground">{subject.excused_count}</td>
                          <td className="px-5 py-3 font-semibold text-primary">
                            {subject.attendance_percentage !== null ? percent(subject.attendance_percentage) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState text="No attendance has been marked for you yet." />
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </AsyncState>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-primary">My leave requests</h2>
        </div>
        {actionError ? <p role="alert" className="mb-3 text-sm text-destructive-text">{actionError}</p> : null}
        <AsyncState loading={leaves.loading} error={leaves.error} onRetry={leaves.reload} loadingLabel="Loading leave requests…">
          {leaves.data ? (
            leaves.data.items.length ? (
              <div className="space-y-3">
                {leaves.data.items.map((leave) => (
                  <Card key={leave.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="font-display text-base font-bold text-primary">
                            {dateOnly(leave.from_date)} → {dateOnly(leave.to_date)}
                          </p>
                          <LeaveBadge status={leave.status} />
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{leave.reason}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Applied {dateTime(leave.created_at)}
                          {leave.reviewed_at ? ` · Reviewed ${dateTime(leave.reviewed_at)}` : ""}
                        </p>
                      </div>
                      {leave.status === "PENDING" ? (
                        <button
                          type="button"
                          disabled={busyId === leave.id}
                          onClick={() => cancel(leave.id)}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" /> {busyId === leave.id ? "Cancelling…" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState text="You have not applied for leave yet." />
              </Card>
            )
          ) : null}
        </AsyncState>
      </section>
    </div>
  );
}

function LeaveBadge({ status }: { status: string }) {
  const style =
    status === "PENDING"
      ? "bg-warning-light text-warning-text"
      : status === "APPROVED"
        ? "bg-success-light text-success-text"
        : status === "REJECTED"
          ? "bg-destructive-light text-destructive-text"
          : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{statusLabel(status)}</span>;
}

/** C-ST-05 — apply for leave (server enforces 30-day max and date overlap). */
export function StudentApplyLeavePage() {
  const router = useRouter();
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "", document_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.to_date < form.from_date) {
      setError("The end date cannot be before the start date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyStudentLeave({
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
        document_url: form.document_url.trim() || null,
      });
      router.replace("/student/attendance");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your leave request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Apply for leave" subtitle="Your class teacher (or subject teachers) will review the request." />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="leave-from" className={labelClass}>From</label>
              <input id="leave-from" type="date" className={inputClass} value={form.from_date} onChange={(event) => setForm({ ...form, from_date: event.target.value })} required />
            </div>
            <div>
              <label htmlFor="leave-to" className={labelClass}>To</label>
              <input id="leave-to" type="date" className={inputClass} min={form.from_date || undefined} value={form.to_date} onChange={(event) => setForm({ ...form, to_date: event.target.value })} required />
            </div>
          </div>
          <div>
            <label htmlFor="leave-reason" className={labelClass}>Reason</label>
            <textarea id="leave-reason" className={`${inputClass} min-h-28 py-3`} minLength={3} maxLength={5000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required />
          </div>
          <div>
            <label htmlFor="leave-document" className={labelClass}>Supporting document link (optional)</label>
            <input id="leave-document" type="url" className={inputClass} value={form.document_url} onChange={(event) => setForm({ ...form, document_url: event.target.value })} placeholder="https://…" />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
              {busy ? "Submitting…" : "Submit request"}
            </button>
            <Link href="/student/attendance" className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

function monthKey(offset = 0): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

const STATUS_DOT: Record<string, string> = {
  PRESENT: "bg-success",
  ABSENT: "bg-destructive",
  LATE: "bg-warning",
  // `bg-info` was never defined in tailwind.config.ts, so excused days rendered
  // an invisible dot. The theme's cyan is `secondary`.
  EXCUSED: "bg-secondary",
};

/** C-ST-04 — monthly calendar: P/A/L/E colour-coded with a subject tooltip. */
export function StudentAttendanceCalendarPage() {
  const [month, setMonth] = useState(monthKey());
  const resource = useResource(() => fetchStudentAttendanceCalendar(month), [month]);

  function shift(months: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(year ?? 2026, (monthNumber ?? 1) - 1 + months, 1);
    setMonth(`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`);
  }

  const byDate = new Map((resource.data?.days ?? []).map((day) => [day.date, day.entries]));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year ?? 2026, (monthNumber ?? 1) - 1, 1);
  const daysInMonth = new Date(year ?? 2026, monthNumber ?? 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7; // Monday-first offset
  const monthName = firstDay.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Attendance calendar" subtitle="One colour per day and status — hover a day for subject detail." />
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="inline-flex h-9 w-9 items-center justify-center rounded-field border border-border text-muted-foreground hover:border-accent hover:text-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-display text-base font-bold text-primary">{monthName}</h2>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="inline-flex h-9 w-9 items-center justify-center rounded-field border border-border text-muted-foreground hover:border-accent hover:text-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading the calendar…">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leading }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const dayNumber = index + 1;
              const key = `${month}-${`${dayNumber}`.padStart(2, "0")}`;
              const entries = byDate.get(key) ?? [];
              return (
                <div
                  key={key}
                  title={
                    entries.length
                      ? entries.map((entry) => `${entry.subject_code} (${entry.period_label}): ${statusLabel(entry.status)}`).join("\n")
                      : "No sessions"
                  }
                  className={`min-h-12 rounded-md border p-1.5 text-left text-[10px] ${entries.length ? "border-border bg-white" : "border-transparent bg-muted/40"}`}
                >
                  <span className="font-semibold text-primary">{dayNumber}</span>
                  <span className="mt-1 flex flex-wrap gap-0.5">
                    {entries.slice(0, 6).map((entry, entryIndex) => (
                      <span
                        key={`${key}-${entryIndex}`}
                        className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[entry.status] ?? "bg-border"}`}
                        aria-label={`${entry.subject_code}: ${statusLabel(entry.status)}`}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </AsyncState>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] font-semibold text-muted-foreground">
          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
              {statusLabel(status)}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
