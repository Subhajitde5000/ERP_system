"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchAttendanceSession,
  fetchAttendanceSessions,
  fetchTeachingAssignments,
  lockAttendanceSession,
} from "@/lib/teacher";
import { AsyncState, EmptyTable, dateOnly, dateTime } from "@/components/principal/principal-ui";

/** C-TC-04 — every attendance session the teacher marked, with filters. */
export function TeacherAttendanceSessionsPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", classId: "", subjectId: "" });
  const resource = useResource(
    () =>
      fetchAttendanceSessions({
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        limit: 100,
      }),
    [filters.fromDate, filters.toDate, filters.classId, filters.subjectId],
  );

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const assignment of assignments.data ?? []) seen.set(assignment.class_id, assignment.class_name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [assignments.data]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Attendance sessions" subtitle="Sessions you marked, filterable by date, class and subject." />
      <Card className="mb-5 !p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filter-from" className={labelClass}>From</label>
            <input id="filter-from" type="date" className={inputClass} value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} />
          </div>
          <div>
            <label htmlFor="filter-to" className={labelClass}>To</label>
            <input id="filter-to" type="date" className={inputClass} value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} />
          </div>
          <div>
            <label htmlFor="filter-class" className={labelClass}>Class</label>
            <select id="filter-class" className={inputClass} value={filters.classId} onChange={(event) => setFilters({ ...filters, classId: event.target.value })}>
              <option value="">All classes</option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-subject" className={labelClass}>Subject</label>
            <select id="filter-subject" className={inputClass} value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}>
              <option value="">All subjects</option>
              {(assignments.data ?? []).map((assignment) => (
                <option key={`${assignment.subject_id}:${assignment.class_id}`} value={assignment.subject_id}>
                  {assignment.subject_code} · {assignment.subject_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading attendance sessions…">
        {resource.data ? (
          <Card className="!p-0">
            {resource.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Period</th>
                      <th className="px-5 py-3">Class</th>
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Present</th>
                      <th className="px-5 py-3">Absent</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resource.data.items.map((session) => (
                      <tr key={session.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-medium text-primary">{dateOnly(session.date)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{session.period_label}</td>
                        <td className="px-5 py-3 text-muted-foreground">{session.class_name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{session.subject_code}</td>
                        <td className="px-5 py-3 font-semibold text-success-text">{session.total_present}</td>
                        <td className="px-5 py-3 font-semibold text-destructive-text">{session.total_absent}</td>
                        <td className="px-5 py-3">
                          {session.is_locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                              <Lock className="h-3 w-3" /> Locked
                            </span>
                          ) : (
                            <span className="rounded-full bg-success-light px-2.5 py-1 text-[11px] font-bold text-success-text">Editable</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link href={`/teacher/attendance/sessions/${session.id}`} className="text-xs font-semibold text-accent hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyTable text="No attendance sessions match these filters." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </div>
  );
}

/** C-TC-05 — one session's records; editable until locked. */
export function TeacherAttendanceSessionDetailPage() {
  const params = useParams<{ id?: string }>();
  const sessionId = params?.id ?? "";
  const resource = useResource(
    () => (sessionId ? fetchAttendanceSession(sessionId) : Promise.reject(new Error("No session ID provided"))),
    [sessionId],
  );
  const [busy, setBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    setLockError(null);
    try {
      const updated = await lockAttendanceSession(sessionId);
      if (resource.data) resource.setData({ ...resource.data, ...updated });
    } catch (caught) {
      setLockError(caught instanceof Error ? caught.message : "Could not lock this session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Attendance session" subtitle="View the recorded marks. Locking a session freezes it permanently." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading session…">
        {resource.data ? (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-primary">
                    {resource.data.subject_code} · {resource.data.class_name}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateOnly(resource.data.date)} · Period {resource.data.period_label} · {resource.data.total_present} present / {resource.data.total_absent} absent
                    {resource.data.locked_at ? ` · Locked ${dateTime(resource.data.locked_at)}` : ""}
                  </p>
                  {resource.data.notes ? <p className="mt-2 text-sm text-muted-foreground">{resource.data.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/teacher/attendance/mark`}
                    className="inline-flex h-9 items-center rounded-field border border-border px-3 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
                  >
                    {resource.data.is_locked ? "Back to marking" : "Edit in marking board"}
                  </Link>
                  {!resource.data.is_locked ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={lock}
                      className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {busy ? "Locking…" : "Lock session"}
                    </button>
                  ) : null}
                </div>
              </div>
              {lockError ? <p role="alert" className="mt-3 text-sm text-destructive-text">{lockError}</p> : null}
            </Card>
            <Card className="!p-0">
              {resource.data.records.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Roll no</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Late by</th>
                        <th className="px-5 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {resource.data.records.map((record) => (
                        <tr key={record.student_id}>
                          <td className="px-5 py-3 font-medium text-primary">{record.student_name}</td>
                          <td className="px-5 py-3 text-muted-foreground">{record.roll_number ?? "—"}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                record.status === "ABSENT"
                                  ? "bg-destructive-light text-destructive-text"
                                  : record.status === "PRESENT"
                                    ? "bg-success-light text-success-text"
                                    : "bg-warning-light text-warning-text"
                              }`}
                            >
                              {record.status ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {record.late_by_minutes ? `${record.late_by_minutes} min` : "—"}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{record.remarks ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyTable text="No records in this session." />
              )}
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
