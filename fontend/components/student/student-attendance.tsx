"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  applyStudentLeave,
  cancelStudentLeave,
  fetchStudentAttendance,
  fetchStudentLeaves,
  type StudentAttendanceOverview,
} from "@/lib/student";
import {
  AsyncState,
  MetricCard,
  ProgressBar,
  StatusPill,
  dateOnly,
  percent,
} from "@/components/teacher/teacher-ui";

/**
 * C-ST-03 / C-ST-04 — subject-wise attendance plus a month calendar.
 *
 * The two live on one page because they answer the same question at different
 * resolutions: "am I short?" and "which days did I miss?". Splitting them
 * would mean loading the same range twice.
 */
export function StudentAttendancePage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const load = useCallback(
    () =>
      fetchStudentAttendance({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [fromDate, toDate],
  );
  const resource = useResource(load, [fromDate, toDate]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="My attendance"
        subtitle="Subject by subject, plus a calendar of the days you missed."
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="attendance-from">
              From
            </label>
            <input
              id="attendance-from"
              type="date"
              className={inputClass}
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="attendance-to">
              To
            </label>
            <input
              id="attendance-to"
              type="date"
              className={inputClass}
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </div>
      </Card>

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your attendance…"
      >
        {resource.data ? <AttendanceBody data={resource.data} /> : null}
      </AsyncState>
    </div>
  );
}

function AttendanceBody({ data }: { data: StudentAttendanceOverview }) {
  const threshold = data.attendance_threshold ?? 75;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Overall"
          value={percent(data.attendance_percentage)}
          hint={`Threshold ${threshold}%`}
          tone={data.is_short ? "warning" : "success"}
        />
        <MetricCard
          label="Attended"
          value={data.present_count}
          hint={`Of ${data.total_sessions} periods`}
        />
        <MetricCard
          label="Missed"
          value={data.absent_count}
          tone={data.absent_count ? "danger" : "success"}
        />
      </section>

      <Card>
        <h2 className="mb-4 font-display text-base font-bold text-primary">By subject</h2>
        {data.subjects.length ? (
          <div className="space-y-4">
            {data.subjects.map((subject) => (
              <div key={subject.subject_id}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-primary">
                    {subject.subject_code} · {subject.subject_name}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      subject.is_short ? "text-warning-text" : "text-primary"
                    }`}
                  >
                    {percent(subject.attendance_percentage)}
                  </span>
                </div>
                <ProgressBar value={subject.attendance_percentage} threshold={threshold} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {subject.present_count} present · {subject.absent_count} absent ·{" "}
                  {subject.late_count} late · {subject.excused_count} excused
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No attendance has been recorded for you yet." />
        )}
      </Card>

      <AttendanceCalendar data={data} />
    </div>
  );
}

/** C-ST-04 — a month grid: green for a full day, red where a period was missed. */
function AttendanceCalendar({ data }: { data: StudentAttendanceOverview }) {
  const days = data.days;
  const byMonth = useMemo(() => {
    const grouped = new Map<string, typeof days>();
    for (const day of days) {
      const key = day.date.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) ?? []), day]);
    }
    // Newest month first: a learner checks the current month, not September.
    return [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  }, [days]);

  if (!byMonth.length) return null;

  return (
    // `id` is the anchor `/student/attendance/calendar` (C-ST-04) forwards to.
    <Card>
      <h2 id="calendar" className="mb-4 scroll-mt-24 font-display text-base font-bold text-primary">
        Calendar
      </h2>
      <div className="space-y-5">
        {byMonth.map(([month, days]) => (
          <div key={month}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
                new Date(`${month}-01T00:00:00`),
              )}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {days.map((day) => (
                <li
                  key={day.date}
                  title={`${dateOnly(day.date)} · ${day.present_count} attended, ${day.absent_count} missed`}
                  className={`flex h-9 w-9 items-center justify-center rounded-field text-xs font-semibold ${
                    day.absent_count
                      ? "bg-destructive-light text-destructive-text"
                      : "bg-success-light text-success-text"
                  }`}
                >
                  {Number(day.date.slice(-2))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-success-light" /> Full attendance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-destructive-light" /> At least one period missed
        </span>
      </p>
    </Card>
  );
}

/** C-ST-05 — apply for class leave and track what you have already asked for. */
export function StudentLeavesPage() {
  const resource = useResource(() => fetchStudentLeaves(), []);
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "", document_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await applyStudentLeave({
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
        document_url: form.document_url.trim() || null,
      });
      setForm({ from_date: "", to_date: "", reason: "", document_url: "" });
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelStudentLeave(id);
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not withdraw the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Apply for leave"
        subtitle="Your class teacher reviews each request. Approved days are marked as excused."
      />

      <Card className="mb-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="leave-from">
                From
              </label>
              <input
                id="leave-from"
                type="date"
                required
                className={inputClass}
                value={form.from_date}
                onChange={(event) => setForm({ ...form, from_date: event.target.value })}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="leave-to">
                To
              </label>
              <input
                id="leave-to"
                type="date"
                required
                className={inputClass}
                value={form.to_date}
                onChange={(event) => setForm({ ...form, to_date: event.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="leave-reason">
              Reason
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              required
              minLength={5}
              className={`${inputClass} h-auto py-2.5`}
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="leave-document">
              Supporting document URL (optional)
            </label>
            <input
              id="leave-document"
              type="url"
              className={inputClass}
              placeholder="https://…"
              value={form.document_url}
              onChange={(event) => setForm({ ...form, document_url: event.target.value })}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive-text">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {busy ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </Card>

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your requests…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((leave) => (
              <Card key={leave.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">
                      {dateOnly(leave.from_date)} → {dateOnly(leave.to_date)} ({leave.total_days}{" "}
                      day{leave.total_days > 1 ? "s" : ""})
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {leave.reason}
                    </p>
                    {leave.reviewed_by_name ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Reviewed by {leave.reviewed_by_name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={leave.status} />
                    {leave.status === "PENDING" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => withdraw(leave.id)}
                        aria-label="Withdraw request"
                        className="rounded p-1.5 text-destructive-text hover:bg-destructive-light disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState text="You have not applied for any leave." />
        )}
      </AsyncState>
    </div>
  );
}
