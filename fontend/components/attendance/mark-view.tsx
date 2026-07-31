"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Lock, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ATTENDANCE_THRESHOLD,
  STATUS_LABELS,
  STATUS_SHORT,
  STATUS_TONE,
  pctTone,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Card, TONE_TEXT } from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import type {
  AttendanceStatus,
  MarkableSession,
} from "@/types/attendance";

/**
 * Teacher marking view — PAGE 5.
 * Class selector → student list → P/A/L per student, then lock the session.
 * A locked session is read-only (DB §7.1 `is_locked`).
 */

/** The four states a teacher can record (DB §7.1 `attendance_status`). */
const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function MarkView({
  sessions,
  canLock,
}: {
  sessions: MarkableSession[];
  canLock: boolean;
}) {
  const [activeId, setActiveId] = useState(
    sessions.find((s) => !s.isLocked)?.id ?? sessions[0]?.id ?? "",
  );
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const session = sessions.find((s) => s.id === activeId);
  const isLocked = session ? (locked[session.id] ?? session.isLocked) : false;

  const statusFor = (studentId: string, fallback: AttendanceStatus) =>
    marks[`${activeId}:${studentId}`] ?? fallback;

  const tally = useMemo(() => {
    if (!session) return { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    return session.students.reduce(
      (acc, s) => {
        acc[statusFor(s.id, s.status)] += 1;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<
        AttendanceStatus,
        number
      >,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, marks, activeId]);

  function setAll(next: AttendanceStatus) {
    if (!session || isLocked) return;
    const patch: Record<string, AttendanceStatus> = {};
    for (const s of session.students) patch[`${session.id}:${s.id}`] = next;
    setMarks((m) => ({ ...m, ...patch }));
  }

  /** Clicking a status button sets that status directly. */
  function setStatusFor(studentId: string, next: AttendanceStatus) {
    if (isLocked) return;
    setMarks((m) => ({ ...m, [`${activeId}:${studentId}`]: next }));
  }

  async function submit(lock: boolean) {
    setSaving(true);
    // TODO(Dev-B): PATCH /attendance/sessions/:id/records  → bulkMarkRecords()
    //              PATCH /attendance/sessions/:id/lock     → when `lock`
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    if (lock && session) setLocked((l) => ({ ...l, [session.id]: true }));
    setStatus(
      "Attendance API not connected yet — see lib/attendance-data.ts (Dev-B, §9.1).",
    );
  }

  if (!session) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[13px] text-muted-foreground">
          No sessions scheduled for today.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {/* Class / session selector */}
      <div
        role="group"
        aria-label="Select session"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {sessions.map((s) => {
          const sLocked = locked[s.id] ?? s.isLocked;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              aria-pressed={s.id === activeId}
              className={cn(
                "flex shrink-0 flex-col items-start gap-0.5 rounded-field border px-3.5 py-2 text-left transition",
                s.id === activeId
                  ? "border-accent bg-accent-light"
                  : "border-border bg-white hover:border-accent",
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                {s.className} · {s.periodLabel}
                {sLocked && (
                  <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked" />
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {s.subjectName} · {s.startTime}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tally + bulk actions */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              {session.students.length} students
            </span>
            {STATUSES.map((s) => (
              <span key={s} className="text-[13px]">
                <span className={cn("font-semibold", TONE_TEXT[STATUS_TONE[s]])}>
                  {tally[s]}
                </span>{" "}
                <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
              </span>
            ))}
          </div>

          {!isLocked && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAll("PRESENT")}
                className="rounded-field border border-border px-2.5 py-1 text-[12px] font-medium text-success transition-colors hover:border-success hover:bg-success-light"
              >
                All present
              </button>
              <button
                type="button"
                onClick={() => setAll("ABSENT")}
                className="rounded-field border border-border px-2.5 py-1 text-[12px] font-medium text-destructive transition-colors hover:border-destructive hover:bg-destructive-light"
              >
                All absent
              </button>
            </div>
          )}
        </div>

        {isLocked && (
          <p className="mt-3 flex items-center gap-2 rounded-field bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            This session is locked
            {session.lockedAt ? " and can no longer be edited." : "."}
          </p>
        )}
      </Card>

      {/* Student list */}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {session.students.map((student) => {
            const current = statusFor(student.id, student.status);
            const atRisk = student.overallPct < ATTENDANCE_THRESHOLD;

            return (
              <li
                key={student.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {student.name.charAt(0)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {student.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{student.rollNo}</span>
                    <span
                      className={cn("font-medium", TONE_TEXT[pctTone(student.overallPct)])}
                    >
                      · {student.overallPct}% overall
                    </span>
                    {atRisk && (
                      <AlertTriangle
                        className="h-3 w-3 text-destructive"
                        aria-label="Below attendance requirement"
                      />
                    )}
                  </p>
                </div>

                {/* P / A / L / E toggle */}
                <div
                  role="group"
                  aria-label={`Attendance for ${student.name}`}
                  className="flex shrink-0 gap-1"
                >
                  {STATUSES.map((s) => {
                    const on = current === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setStatusFor(student.id, s)}
                        aria-pressed={on}
                        aria-label={STATUS_LABELS[s]}
                        title={STATUS_LABELS[s]}
                        className={cn(
                          "h-8 w-8 rounded-field border text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
                          on
                            ? s === "PRESENT"
                              ? "border-success bg-success text-white"
                              : s === "ABSENT"
                                ? "border-destructive bg-destructive text-white"
                                : s === "LATE"
                                  ? "border-warning bg-warning text-white"
                                  : "border-accent bg-accent text-white"
                            : "border-border bg-white text-muted-foreground hover:border-accent hover:text-accent",
                        )}
                      >
                        {STATUS_SHORT[s]}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Submit */}
      {!isLocked && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            loading={saving}
            loadingText="Saving…"
            onClick={() => submit(false)}
            className="sm:w-40"
          >
            Save draft
          </Button>
          {canLock && (
            <Button
              type="button"
              loading={saving}
              loadingText="Submitting…"
              onClick={() => submit(true)}
              className="sm:w-48"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Submit &amp; lock
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
