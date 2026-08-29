"use client";

/**
 * C-PA-05 / C-PA-06 — attendance, and the one thing a guardian may write.
 *
 * Attendance is read through the student's own numbers, so a parent and a child
 * never see two different percentages. The calendar is colour-per-day rather than
 * a list because a guardian reads it in ten seconds on a phone.
 *
 * Leave is the single write path in this portal. Filing an absence for a child is
 * the one action a school actually wants from home, and the server records it as
 * `request_source: "PARENT"` with the class teacher as the approver — so the
 * teacher can tell whose words these are. Everything else (marks, submissions,
 * a result) is deliberately read-only here.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";

import { Card, EmptyState, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, MetricCard, dateOnly, dateTime, percent, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  applyChildLeave,
  cancelChildLeave,
  fetchChildAttendance,
  fetchChildAttendanceCalendar,
  fetchChildLeaves,
} from "@/lib/parent";
import { useParentConsole } from "./parent-console-context";
import { ChildGate, ListTable } from "./parent-shared";

const STATUS_DOT: Record<string, string> = {
  PRESENT: "bg-success",
  ABSENT: "bg-destructive",
  LATE: "bg-warning",
  EXCUSED: "bg-secondary",  // `secondary` is this theme's cyan; there is no `info` token
};

function useChildId() {
  const { activeChild } = useParentConsole();
  return activeChild?.student_id ?? "";
}

function monthKey(offset = 0): string {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${first.getFullYear()}-${`${first.getMonth() + 1}`.padStart(2, "0")}`;
}

export function ParentChildAttendancePage() {
  const childId = useChildId();
  const { activeChild } = useParentConsole();
  const summary = useResource(
    () => (childId ? fetchChildAttendance(childId) : Promise.reject(new Error("no child"))),
    [childId],
  );
  const [month, setMonth] = useState(monthKey());
  const calendar = useResource(
    () => (childId ? fetchChildAttendanceCalendar(childId, month) : Promise.reject(new Error("no child"))),
    [childId, month],
  );

  return (
    <ChildGate module="attendance" title="{child}'s attendance" subtitle="Marked by subject teachers, published by the school">
      <AsyncState
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        loadingLabel="Loading attendance…"
      >
        {summary.data ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Overall"
                value={percent(summary.data.attendance_percentage)}
                tone={
                  summary.data.attendance_percentage !== null && summary.data.attendance_percentage < 75
                    ? "warning"
                    : "success"
                }
                hint={`${summary.data.total_marks} sessions marked`}
              />
              <MetricCard label="Present" value={summary.data.present_count} tone="success" hint="Sessions attended" />
              <MetricCard
                label="Absent"
                value={summary.data.absent_count}
                tone={summary.data.absent_count ? "warning" : "default"}
                hint="Sessions missed"
              />
              <MetricCard
                label="Late / excused"
                value={summary.data.late_count + summary.data.excused_count}
                hint="Counted as attended"
              />
            </section>

            <Card className="!p-0">
              <p className="border-b border-border px-5 py-4 font-display text-base font-bold text-primary">
                By subject
              </p>
              <ListTable
                head={["Subject", "Present", "Absent", "Late", "Excused", "Attendance"]}
                rows={summary.data.subjects.map((subject) => [
                  <span key="subject">
                    {subject.subject_name}
                    <span className="block text-[11px] font-normal text-muted-foreground">{subject.subject_code}</span>
                  </span>,
                  <span key="present" className="text-success-text">{subject.present_count}</span>,
                  <span key="absent" className="text-destructive-text">{subject.absent_count}</span>,
                  <span key="late" className="text-warning-text">{subject.late_count}</span>,
                  <span key="excused" className="text-muted-foreground">{subject.excused_count}</span>,
                  percent(subject.attendance_percentage),
                ])}
              />
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-primary">Month by month</h2>
                <div className="flex items-center gap-2">
                  <MonthButton label="Previous month" onClick={() => shift(month, -1, setMonth)}>
                    <ChevronLeft className="h-4 w-4" />
                  </MonthButton>
                  <span className="min-w-32 text-center text-sm font-semibold text-primary">
                    {new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </span>
                  <MonthButton label="Next month" onClick={() => shift(month, 1, setMonth)}>
                    <ChevronRight className="h-4 w-4" />
                  </MonthButton>
                </div>
              </div>
              <AsyncState
                loading={calendar.loading}
                error={calendar.error}
                onRetry={calendar.reload}
                loadingLabel="Loading the calendar…"
              >
                {calendar.data ? (
                  <AttendanceMonth month={month} days={calendar.data.days} childName={activeChild?.name ?? null} />
                ) : null}
              </AsyncState>
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </ChildGate>
  );
}

function shift(month: string, by: number, set: (next: string) => void) {
  const [year, number] = month.split("-").map(Number);
  const next = new Date(year ?? 2026, (number ?? 1) - 1 + by, 1);
  set(`${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, "0")}`);
}

function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-field border border-border text-muted-foreground transition hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

/** Monday-first grid, one dot per marked session — the student console's view. */
function AttendanceMonth({
  month,
  days,
  childName,
}: {
  month: string;
  days: { date: string; entries: { status: string; subject_code: string; subject_name: string; period_label: string }[] }[];
  childName: string | null;
}) {
  const entriesByDate = new Map(days.map((day) => [day.date, day.entries]));
  const [year, number] = month.split("-").map(Number);
  const first = new Date(year ?? 2026, (number ?? 1) - 1, 1);
  const total = new Date(year ?? 2026, number ?? 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  return (
    <>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: total }, (_, index) => {
          const dayNumber = index + 1;
          const key = `${month}-${`${dayNumber}`.padStart(2, "0")}`;
          const entries = entriesByDate.get(key) ?? [];
          return (
            <div
              key={key}
              title={
                entries.length
                  ? entries.map((entry) => `${entry.subject_code} (${entry.period_label}): ${statusLabel(entry.status)}`).join("\n")
                  : childName
                    ? `${childName}: no sessions marked`
                    : "No sessions marked"
              }
              className={`min-h-12 rounded-md border p-1.5 text-[10px] ${
                entries.length ? "border-border bg-white" : "border-transparent bg-muted/40"
              }`}
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
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] font-semibold text-muted-foreground">
        {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
            {statusLabel(status)}
          </span>
        ))}
      </div>
    </>
  );
}

// ── C-PA-06 leave ────────────────────────────────────────────────────────────


export function ParentChildLeavePage() {
  const childId = useChildId();
  const { activeChild } = useParentConsole();
  const leaves = useResource(
    () => (childId ? fetchChildLeaves(childId, { limit: 100 }) : Promise.reject(new Error("no child"))),
    [childId],
  );
  const [composing, setComposing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(leaveId: string) {
    setBusyId(leaveId);
    setActionError(null);
    try {
      const updated = await cancelChildLeave(childId, leaveId);
      if (leaves.data) {
        leaves.setData({
          ...leaves.data,
          items: leaves.data.items.map((leave) => (leave.id === leaveId ? updated : leave)),
        });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "This request could not be cancelled.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ChildGate
      module="attendance"
      title="{child}'s leave"
      subtitle="Absence requests filed by you or by the student"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The class teacher approves these. Cancelling is possible only while a request is pending.
        </p>
        <button
          type="button"
          onClick={() => setComposing((open) => !open)}
          className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> {composing ? "Close" : "Report an absence"}
        </button>
      </div>

      {composing ? (
        <LeaveForm
          childName={activeChild?.name ?? "your child"}
          onDone={async () => {
            setComposing(false);
            await leaves.reload();
          }}
        />
      ) : null}

      {actionError ? (
        <p role="alert" className="mb-3 text-sm text-destructive-text">
          {actionError}
        </p>
      ) : null}

      <AsyncState loading={leaves.loading} error={leaves.error} onRetry={leaves.reload} loadingLabel="Loading leave requests…">
        {leaves.data?.items.length ? (
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
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          leave.request_source === "PARENT"
                            ? "bg-secondary-light text-secondary-text"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {leave.request_source === "PARENT" ? (leave.mine ? "Filed by you" : "Filed by another guardian") : "Filed by the student"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{leave.reason}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Filed {dateTime(leave.created_at)}
                      {leave.reviewed_at ? ` · reviewed ${dateTime(leave.reviewed_at)}` : ""}
                    </p>
                  </div>
                  {leave.status === "PENDING" ? (
                    <button
                      type="button"
                      disabled={busyId === leave.id}
                      onClick={() => cancel(leave.id)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light disabled:opacity-60"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {busyId === leave.id ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState text={`No leave has been reported for ${activeChild?.name ?? "this student"} yet.`} />
          </Card>
        )}
      </AsyncState>
    </ChildGate>
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

function LeaveForm({ childName, onDone }: { childName: string; onDone: () => void | Promise<void> }) {
  const childId = useChildId();
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "", document_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.to_date && form.from_date && form.to_date < form.from_date) {
      setError("The end date cannot be before the start date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyChildLeave(childId, {
        from_date: form.from_date,
        to_date: form.to_date || form.from_date,
        reason: form.reason.trim(),
        document_url: form.document_url.trim() || null,
      });
      setForm({ from_date: "", to_date: "", reason: "", document_url: "" });
      await onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm font-semibold text-primary">Report an absence for {childName}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="leave-from" className={labelClass}>
              First day missed
            </label>
            <input
              id="leave-from"
              type="date"
              className={inputClass}
              value={form.from_date}
              onChange={(event) => setForm({ ...form, from_date: event.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="leave-to" className={labelClass}>
              Last day missed
            </label>
            <input
              id="leave-to"
              type="date"
              className={inputClass}
              min={form.from_date || undefined}
              value={form.to_date}
              onChange={(event) => setForm({ ...form, to_date: event.target.value })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Leave it blank for a single day.</p>
          </div>
        </div>
        <div>
          <label htmlFor="leave-reason" className={labelClass}>
            Reason
          </label>
          <textarea
            id="leave-reason"
            className={`${inputClass} min-h-28 py-3`}
            minLength={5}
            maxLength={2000}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="Fever since last night; seeing the paediatrician today."
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            The school accepts a fortnight of retroactive dates only from the office — a request starting
            more than a week ago has to go to the class teacher.
          </p>
        </div>
        <div>
          <label htmlFor="leave-document" className={labelClass}>
            Medical or other note (optional link)
          </label>
          <input
            id="leave-document"
            type="url"
            className={inputClass}
            value={form.document_url}
            onChange={(event) => setForm({ ...form, document_url: event.target.value })}
            placeholder="https://…"
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
          className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Send to the class teacher"}
        </button>
      </form>
    </Card>
  );
}
