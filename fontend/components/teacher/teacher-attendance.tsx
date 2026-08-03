"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Lock, Save } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createTeacherSession,
  fetchTeacherMarkContext,
  fetchTeacherSession,
  fetchTeacherSessions,
  lockTeacherSession,
  updateTeacherSession,
  type AttendanceStatus,
  type TeacherAttendanceMark,
  type TeacherRosterStudent,
  type TeacherSessionDetail,
} from "@/lib/teacher";
import {
  AsyncState,
  ProgressBar,
  StatusPill,
  clockTime,
  dateOnly,
  percent,
} from "@/components/teacher/teacher-ui";

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-success text-white border-success",
  ABSENT: "bg-destructive text-white border-destructive",
  LATE: "bg-warning text-white border-warning",
  EXCUSED: "bg-accent text-white border-accent",
};

/**
 * C-TC-03 — Mark Attendance.
 *
 * The sheet is optimistic in exactly one way: it defaults every learner to
 * PRESENT, because in a normal period most of them are, and a teacher marking
 * three absences is far faster than one ticking forty boxes. Everything else
 * is server truth — the roster, the running percentage and whether a register
 * already exists for this class/subject/date all come from the API.
 */
export function TeacherMarkAttendancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(params.get("subjectId") ?? "");
  const [classId, setClassId] = useState(params.get("classId") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const [periodLabel, setPeriodLabel] = useState("");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(
    () => fetchTeacherMarkContext({ subjectId, classId, date: date || undefined }),
    [subjectId, classId, date],
  );
  const resource = useResource(load, [subjectId, classId, date]);
  const context = resource.data;

  // Selecting a subject fixes the class, because a subject belongs to exactly
  // one class (§6.4). Doing it here keeps the two selects from disagreeing.
  useEffect(() => {
    if (!subjectId || !context) return;
    const subject = context.subjects.find((item) => item.id === subjectId);
    if (subject && subject.class_id !== classId) setClassId(subject.class_id);
  }, [subjectId, classId, context]);

  // Seed the sheet from whatever the server returned: an existing register's
  // marks when there is one, PRESENT otherwise.
  useEffect(() => {
    if (!context?.roster.length) return;
    setMarks(
      Object.fromEntries(
        context.roster.map((student) => [student.student_id, student.status ?? "PRESENT"]),
      ),
    );
    if (context.period_label) setPeriodLabel(context.period_label);
  }, [context]);

  const summary = useMemo(() => {
    const values = Object.values(marks);
    return {
      present: values.filter((value) => value !== "ABSENT").length,
      absent: values.filter((value) => value === "ABSENT").length,
    };
  }, [marks]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!context || !subjectId || !classId) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    const records: TeacherAttendanceMark[] = context.roster.map((student) => ({
      student_id: student.student_id,
      status: marks[student.student_id] ?? "PRESENT",
    }));
    try {
      if (context.existing_session_id) {
        await updateTeacherSession(context.existing_session_id, { records });
        setSaved("Register updated.");
      } else {
        const session = await createTeacherSession({
          subject_id: subjectId,
          class_id: classId,
          date: context.date,
          period_label: periodLabel.trim() || "Period 1",
          records,
        });
        setSaved("Register saved.");
        router.push(`/teacher/attendance/sessions/${session.id}`);
        return;
      }
      await resource.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Mark attendance"
        subtitle="Select a subject and date, then mark each student. Only your assigned subjects appear."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your classes…"
      >
        {context ? (
          <form onSubmit={submit} className="space-y-5">
            <Card>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="mark-subject">
                    Subject
                  </label>
                  <select
                    id="mark-subject"
                    className={inputClass}
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    required
                  >
                    <option value="">Select subject</option>
                    {context.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.class_name} · {subject.code} · {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="mark-date">
                    Date
                  </label>
                  <input
                    id="mark-date"
                    type="date"
                    className={inputClass}
                    value={date || context.date}
                    max={context.date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="mark-period">
                    Period
                  </label>
                  <input
                    id="mark-period"
                    className={inputClass}
                    value={periodLabel}
                    placeholder="Period 1"
                    disabled={Boolean(context.existing_session_id)}
                    onChange={(event) => setPeriodLabel(event.target.value)}
                  />
                </div>
              </div>
              {context.existing_session_id ? (
                <p className="mt-3 rounded-field border border-accent-border bg-accent-light px-3 py-2 text-xs text-accent">
                  A register already exists for this subject and date
                  {context.period_label ? ` (${context.period_label})` : ""}. Saving updates it.
                </p>
              ) : null}
            </Card>

            {context.is_locked ? (
              <Card className="border-warning-border">
                <p className="text-sm text-warning-text">
                  This register is locked. Ask your HOD to reopen it if a correction is needed.
                </p>
              </Card>
            ) : null}

            {!subjectId ? (
              <EmptyState text="Choose a subject to load its class roster." />
            ) : context.roster.length ? (
              <Card className="!p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <p className="text-sm font-semibold text-primary">
                    {context.roster.length} students
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-success-text">{summary.present}</span>{" "}
                    present ·{" "}
                    <span className="font-semibold text-destructive-text">{summary.absent}</span>{" "}
                    absent
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {context.roster.map((student) => (
                    <RosterRow
                      key={student.student_id}
                      student={student}
                      value={marks[student.student_id] ?? "PRESENT"}
                      disabled={context.is_locked || busy}
                      onChange={(status) =>
                        setMarks((current) => ({ ...current, [student.student_id]: status }))
                      }
                    />
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState text="No students are enrolled in this class yet." />
            )}

            {error ? (
              <p role="alert" className="text-sm text-destructive-text">
                {error}
              </p>
            ) : null}
            {saved ? <p className="text-sm text-success-text">{saved}</p> : null}

            {subjectId && context.roster.length && !context.is_locked ? (
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {busy ? "Saving…" : context.existing_session_id ? "Update register" : "Save register"}
              </button>
            ) : null}
          </form>
        ) : null}
      </AsyncState>
    </div>
  );
}

function RosterRow({
  student,
  value,
  disabled,
  onChange,
}: {
  student: TeacherRosterStudent;
  value: AttendanceStatus;
  disabled: boolean;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{student.name}</p>
        <p className="text-xs text-muted-foreground">
          {student.roll_number ?? "—"}
          {student.overall_percentage !== null
            ? ` · ${percent(student.overall_percentage)} so far`
            : ""}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={`Attendance for ${student.name}`}
        className="flex shrink-0 gap-1"
      >
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={value === status}
            disabled={disabled}
            onClick={() => onChange(status)}
            className={`h-8 rounded-field border px-2.5 text-[11px] font-semibold transition disabled:opacity-50 ${
              value === status
                ? STATUS_STYLE[status]
                : "border-border bg-white text-muted-foreground hover:border-accent"
            }`}
          >
            {status[0]}
            <span className="sr-only">{status}</span>
          </button>
        ))}
      </div>
    </li>
  );
}

/** C-TC-04 — every register this teacher has marked, filterable. */
export function TeacherSessionsPage() {
  const [classId, setClassId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(
    () =>
      fetchTeacherSessions({
        classId: classId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [classId, fromDate, toDate],
  );
  const resource = useResource(load, [classId, fromDate, toDate]);
  const context = useResource(() => fetchTeacherMarkContext(), []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Attendance sessions"
        subtitle="Every register you have marked. Open one to correct it before it is locked."
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="session-class">
              Class
            </label>
            <select
              id="session-class"
              className={inputClass}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">All classes</option>
              {(context.data?.classes ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="session-from">
              From
            </label>
            <input
              id="session-from"
              type="date"
              className={inputClass}
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="session-to">
              To
            </label>
            <input
              id="session-to"
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
        loadingLabel="Loading sessions…"
      >
        {resource.data?.items.length ? (
          <div className="space-y-3">
            {resource.data.items.map((session) => (
              <Link
                key={session.id}
                href={`/teacher/attendance/sessions/${session.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-5 py-4 transition hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold text-primary">
                    {session.subject_code} · {session.class_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateOnly(session.date)} · {session.period_label}
                    {session.start_time ? ` · ${clockTime(session.start_time)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">
                      {percent(session.attendance_percentage)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {session.total_present}/{session.total_marked} present
                    </p>
                  </div>
                  <StatusPill
                    status={session.is_locked ? "LOCKED" : "OPEN"}
                    tone={session.is_locked ? "default" : "warning"}
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState text="You have not marked any registers in this range." />
        )}
      </AsyncState>
    </div>
  );
}

/** C-TC-05 — one register: view, correct before lock, then lock. */
export function TeacherSessionDetailPage({ sessionId }: { sessionId: string }) {
  const load = useCallback(() => fetchTeacherSession(sessionId), [sessionId]);
  const resource = useResource(load, [sessionId]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resource.data) return;
    setMarks(
      Object.fromEntries(
        resource.data.records.map((record) => [record.student_id, record.status]),
      ),
    );
  }, [resource.data]);

  async function save() {
    if (!resource.data) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateTeacherSession(sessionId, {
        records: resource.data.records.map((record) => ({
          student_id: record.student_id,
          status: marks[record.student_id] ?? record.status,
        })),
      });
      resource.setData(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the register.");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      resource.setData(await lockTeacherSession(sessionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not lock the register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Attendance session"
        subtitle="Correct individual marks until the register is locked."
        action={
          <Link
            href="/teacher/attendance/sessions"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Back to sessions
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading register…"
      >
        {resource.data ? (
          <SessionBody
            session={resource.data}
            marks={marks}
            busy={busy}
            error={error}
            onChange={(id, status) => setMarks((current) => ({ ...current, [id]: status }))}
            onSave={save}
            onLock={lock}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}

function SessionBody({
  session,
  marks,
  busy,
  error,
  onChange,
  onSave,
  onLock,
}: {
  session: TeacherSessionDetail;
  marks: Record<string, AttendanceStatus>;
  busy: boolean;
  error: string | null;
  onChange: (id: string, status: AttendanceStatus) => void;
  onSave: () => void;
  onLock: () => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">
              {session.subject_code} · {session.subject_name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.class_name} · {dateOnly(session.date)} · {session.period_label}
            </p>
          </div>
          <StatusPill
            status={session.is_locked ? "LOCKED" : "OPEN"}
            tone={session.is_locked ? "default" : "warning"}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
          <Stat label="Present" value={session.total_present} />
          <Stat label="Absent" value={session.total_absent} />
          <Stat label="Attendance" value={percent(session.attendance_percentage)} />
        </div>
        <div className="mt-3">
          <ProgressBar value={session.attendance_percentage} />
        </div>
      </Card>

      <Card className="!p-0">
        <ul className="divide-y divide-border">
          {session.records.map((record) => (
            <RosterRow
              key={record.student_id}
              student={record}
              value={marks[record.student_id] ?? record.status}
              disabled={session.is_locked || busy}
              onChange={(status) => onChange(record.student_id, status)}
            />
          ))}
        </ul>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}

      {!session.is_locked ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            Save corrections
          </button>
          <button
            type="button"
            onClick={onLock}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            Lock register
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-primary">{value}</p>
    </div>
  );
}
