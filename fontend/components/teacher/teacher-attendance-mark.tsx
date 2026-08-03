"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchAttendanceBoard,
  fetchTeachingAssignments,
  saveAttendanceSession,
  type AttendanceMarkStatus,
  type AttendanceRecordIn,
  type AttendanceRosterEntry,
} from "@/lib/teacher";
import { AsyncState, dateOnly } from "@/components/principal/principal-ui";

const STATUSES: AttendanceMarkStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function localDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** C-TC-03 — select class + subject + date, then mark P/A/L/E per student. */
export function TeacherMarkAttendancePage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [picked, setPicked] = useState<{ subjectId: string; classId: string } | null>(null);
  const [date, setDate] = useState(localDate());
  const [periodLabel, setPeriodLabel] = useState("P1");

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        key: `${assignment.subject_id}:${assignment.class_id}`,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  useEffect(() => {
    if (!picked && options.length) {
      setPicked({ subjectId: options[0]!.subjectId, classId: options[0]!.classId });
    }
  }, [options, picked]);

  const board = useResource(
    () =>
      picked
        ? fetchAttendanceBoard({ subjectId: picked.subjectId, classId: picked.classId, on: date, periodLabel })
        : Promise.resolve(null),
    [picked?.subjectId, picked?.classId, date, periodLabel],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Mark attendance" subtitle="Pick a class and subject, then mark each student. Locked sessions are read-only." />
      <AsyncState loading={assignments.loading} error={assignments.error} onRetry={assignments.reload} loadingLabel="Loading your teaching scope…">
        <Card className="mb-5 !p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label htmlFor="attendance-subject" className={labelClass}>Class &amp; subject</label>
              <select
                id="attendance-subject"
                className={inputClass}
                value={picked ? `${picked.subjectId}:${picked.classId}` : ""}
                onChange={(event) => {
                  const [subjectId, classId] = event.target.value.split(":");
                  if (subjectId && classId) setPicked({ subjectId, classId });
                }}
              >
                {options.length ? null : <option value="">No teaching assignments</option>}
                {options.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="attendance-date" className={labelClass}>Date</label>
              <input
                id="attendance-date"
                type="date"
                className={inputClass}
                value={date}
                max={localDate()}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="attendance-period" className={labelClass}>Period</label>
              <input
                id="attendance-period"
                className={inputClass}
                value={periodLabel}
                maxLength={30}
                onChange={(event) => setPeriodLabel(event.target.value)}
                placeholder="P1"
              />
            </div>
          </div>
        </Card>
        {picked ? (
          <AsyncState loading={board.loading} error={board.error} onRetry={board.reload} loadingLabel="Loading class roster…">
            {board.data ? (
              <MarkingBoard
                key={`${picked.subjectId}:${picked.classId}:${date}:${periodLabel}:${board.data.existing_session?.id ?? "new"}`}
                board={board.data}
                classId={picked.classId}
                subjectId={picked.subjectId}
                date={date}
                periodLabel={periodLabel}
                onSaved={board.reload}
              />
            ) : null}
          </AsyncState>
        ) : (
          <Card>
            <EmptyState text="No teaching assignments yet. Ask your HOD to assign subjects to you." />
          </Card>
        )}
      </AsyncState>
    </div>
  );
}

function MarkingBoard({
  board,
  classId,
  subjectId,
  date,
  periodLabel,
  onSaved,
}: {
  board: Awaited<ReturnType<typeof fetchAttendanceBoard>>;
  classId: string;
  subjectId: string;
  date: string;
  periodLabel: string;
  onSaved: () => Promise<void>;
}) {
  const locked = board.existing_session?.is_locked ?? false;
  const [entries, setEntries] = useState<AttendanceRecordIn[]>(
    board.roster.map((entry: AttendanceRosterEntry) => ({
      student_id: entry.student_id,
      status: (entry.status as AttendanceMarkStatus | null) ?? "PRESENT",
      late_by_minutes: entry.late_by_minutes,
      remarks: entry.remarks,
    })),
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const visible = board.roster.filter((entry) =>
    `${entry.student_name} ${entry.roll_number ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function statusFor(studentId: string): AttendanceMarkStatus {
    return entries.find((entry) => entry.student_id === studentId)?.status ?? "PRESENT";
  }

  function mark(studentId: string, status: AttendanceMarkStatus) {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) =>
        entry.student_id === studentId
          ? { ...entry, status, late_by_minutes: status === "LATE" ? (entry.late_by_minutes ?? 5) : null }
          : entry,
      ),
    );
  }

  function markAll(status: AttendanceMarkStatus) {
    setSaved(false);
    setEntries((current) =>
      current.map((entry) => ({ ...entry, status, late_by_minutes: status === "LATE" ? (entry.late_by_minutes ?? 5) : null })),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveAttendanceSession({ class_id: classId, subject_id: subjectId, date, period_label: periodLabel || "P1", records: entries });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save attendance.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-primary">
            {board.existing_session ? "Edit session" : "New session"} · {dateOnly(date)} · {periodLabel || "P1"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {locked ? "This session is locked and can no longer be edited." : `${board.roster.length} students on the roster.`}
          </p>
        </div>
        {!locked ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => markAll("PRESENT")} className="inline-flex h-8 items-center rounded-field border border-border px-2.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent">
              All present
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {busy ? "Saving…" : "Save attendance"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search students"
          className={`${inputClass} pl-10`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or roll number"
        />
      </div>
      {error ? <p role="alert" className="mb-3 text-sm text-destructive-text">{error}</p> : null}
      {saved && !error ? <p role="status" className="mb-3 text-sm text-success-text">Attendance saved.</p> : null}
      {visible.length ? (
        <ul className="divide-y divide-border">
          {visible.map((entry) => {
            const status = statusFor(entry.student_id);
            return (
              <li key={entry.student_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">{entry.student_name}</p>
                  <p className="text-xs text-muted-foreground">{entry.roll_number ?? "No roll number"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5" role="group" aria-label={`Attendance for ${entry.student_name}`}>
                  {STATUSES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={locked}
                      onClick={() => mark(entry.student_id, option)}
                      aria-pressed={status === option}
                      className={`h-8 rounded-field border px-2.5 text-[11px] font-bold transition disabled:opacity-60 ${
                        status === option
                          ? option === "PRESENT"
                            ? "border-success-border bg-success-light text-success-text"
                            : option === "ABSENT"
                              ? "border-destructive-border bg-destructive-light text-destructive-text"
                              : "border-warning-border bg-warning-light text-warning-text"
                          : "border-border text-muted-foreground hover:border-accent hover:text-accent"
                      }`}
                    >
                      {option === "PRESENT" ? "P" : option === "ABSENT" ? "A" : option === "LATE" ? "L" : "E"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState text={board.roster.length ? "No students match this search." : "No students are enrolled in this class."} />
      )}
    </Card>
  );
}
