"use client";

import { useMemo, useState } from "react";
import { Check, DoorOpen, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/dashboard/primitives";
import { FormAlert } from "@/components/auth/form-alert";
import type { AttendanceStatus, ExamHall } from "@/types/attendance";

/**
 * Exam Controller — offline exam hall attendance (PAGE 5).
 * Only PRESENT / ABSENT apply in a hall; late arrivals past the cut-off are
 * recorded as absent per exam rules, so the four-state cycle isn't used here.
 */
const HALL_STATES: AttendanceStatus[] = ["PRESENT", "ABSENT"];

export function ExamHallView({
  halls,
  canLock,
}: {
  halls: ExamHall[];
  canLock: boolean;
}) {
  const [activeId, setActiveId] = useState(halls[0]?.id ?? "");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const hall = halls.find((h) => h.id === activeId);
  const isLocked = hall ? (locked[hall.id] ?? hall.isLocked) : false;

  const statusFor = (id: string, fallback: AttendanceStatus) =>
    marks[`${activeId}:${id}`] ?? fallback;

  const tally = useMemo(() => {
    if (!hall) return { present: 0, absent: 0 };
    let present = 0;
    for (const c of hall.candidates) {
      if (statusFor(c.id, c.status) === "PRESENT") present += 1;
    }
    return { present, absent: hall.candidates.length - present };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall, marks, activeId]);

  async function submit() {
    setSaving(true);
    // TODO(Dev-B): PATCH /api/v1/attendance/sessions/:id/records (exam hall)
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    if (hall) setLocked((l) => ({ ...l, [hall.id]: true }));
    setStatus(
      "Exam attendance API not connected yet — see lib/attendance-data.ts (Dev-B).",
    );
  }

  if (!hall) {
    return (
      <Card className="p-8 text-center">
        <p className="text-[13px] text-muted-foreground">
          No exam halls scheduled today.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {/* Hall selector */}
      <div
        role="group"
        aria-label="Select hall"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {halls.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setActiveId(h.id)}
            aria-pressed={h.id === activeId}
            className={cn(
              "flex shrink-0 flex-col items-start gap-0.5 rounded-field border px-3.5 py-2 text-left transition",
              h.id === activeId
                ? "border-accent bg-accent-light"
                : "border-border bg-white hover:border-accent",
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {h.hallName}
              {(locked[h.id] ?? h.isLocked) && (
                <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked" />
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {h.examName} · {h.startTime}
            </span>
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[13px] text-muted-foreground">
            {hall.candidates.length} candidates
          </span>
          <span className="text-[13px]">
            <span className="font-semibold text-success">{tally.present}</span>{" "}
            <span className="text-muted-foreground">present</span>
          </span>
          <span className="text-[13px]">
            <span className="font-semibold text-destructive">{tally.absent}</span>{" "}
            <span className="text-muted-foreground">absent</span>
          </span>
        </div>
        {isLocked && (
          <p className="mt-3 flex items-center gap-2 rounded-field bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            This hall is locked and can no longer be edited.
          </p>
        )}
      </Card>

      {/* Seat-ordered candidate list */}
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {hall.candidates.map((c) => {
            const current = statusFor(c.id, c.status);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="w-14 shrink-0 rounded bg-muted px-2 py-1 text-center font-mono text-[11px] font-semibold text-muted-foreground">
                  {c.seatNo}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {c.name}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {c.rollNo}
                  </p>
                </div>
                <div
                  role="group"
                  aria-label={`Attendance for ${c.name}`}
                  className="flex shrink-0 gap-1"
                >
                  {HALL_STATES.map((s) => {
                    const on = current === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          setMarks((m) => ({ ...m, [`${activeId}:${c.id}`]: s }))
                        }
                        aria-pressed={on}
                        className={cn(
                          "h-8 rounded-field border px-3 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                          on
                            ? s === "PRESENT"
                              ? "border-success bg-success text-white"
                              : "border-destructive bg-destructive text-white"
                            : "border-border bg-white text-muted-foreground hover:border-accent hover:text-accent",
                        )}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {!isLocked && canLock && (
        <div className="flex justify-end">
          <Button
            type="button"
            loading={saving}
            loadingText="Submitting…"
            onClick={submit}
            className="sm:w-56"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Submit hall attendance
          </Button>
        </div>
      )}
    </div>
  );
}
