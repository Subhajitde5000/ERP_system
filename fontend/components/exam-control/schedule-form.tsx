"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Info, TriangleAlert } from "lucide-react";

import { cn, istToIso } from "@/lib/utils";
import { dueDateTime } from "@/lib/assignment";
import {
  findScheduleClashes,
  hasBlockingClash,
  minutesLabel,
} from "@/lib/exam-control";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  StructureCard,
  structureInput,
} from "@/components/structure/structure-bits";
import type { ExamMode, ExamType } from "@/types/examination";
import type { ScheduleFormContext } from "@/types/exam-control";

/**
 * C-EC-03 — Create / Edit Exam Schedule.
 * "Schedule exam date/time/hall for any class"
 *
 * The fields are the easy part. What this page is actually for is **refusing
 * a schedule that cannot happen**, and the database will not do it: `exams`
 * has no constraint stopping a class sitting two papers at once (§7.2 indexes
 * `class_id` and `scheduled_at` separately), and
 * `exam_hall_allocations.room_no` is free text with no cross-exam uniqueness.
 *
 * So the clash check runs live as the form is filled, exactly as the
 * timetable builder does on PAGE 10 — a controller finds out *while
 * choosing*, not after a 409.
 *
 * Blocking vs. warning is a real distinction: a class double-booked or a room
 * given away twice is impossible and refused, while an invigilator covering
 * two adjacent halls is a choice controllers legitimately make.
 */
export function ScheduleForm({
  context,
  canEdit,
}: {
  context: ScheduleFormContext;
  canEdit: boolean;
}) {
  const [classId, setClassId] = useState(context.classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<ExamType>("MIXED");
  const [mode, setMode] = useState<ExamMode>("ONLINE");
  const [date, setDate] = useState(context.today);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(
    String(context.defaultDurationMinutes),
  );
  const [totalMarks, setTotalMarks] = useState("50");
  const [passingMarks, setPassingMarks] = useState("20");
  const [rooms, setRooms] = useState<string[]>([]);
  const [invigilators, setInvigilators] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /** Subjects belong to a class (§6.4), so the picker follows the class. */
  const classSubjects = useMemo(
    () => context.subjects.filter((s) => s.classId === classId),
    [context.subjects, classId],
  );

  const klass = context.classes.find((c) => c.id === classId);
  const durationMinutes = Number(duration);

  /**
   * ISO start, rebuilt whenever the date or time changes.
   *
   * Both inputs hand back a wall-clock value the controller typed in IST, so
   * they go through `istToIso` rather than being pasted into a `…Z` string —
   * that read 10:00 as UTC and pushed every exam to 15:30 IST, which is why
   * a real double-booking once reported "no clashes".
   */
  const scheduledAt = useMemo(() => istToIso(date, time), [date, time]);

  /**
   * Live clash check. Recomputed on every change rather than on submit —
   * the point is to steer the choice, not to reject it afterwards.
   */
  const clashes = useMemo(() => {
    if (!scheduledAt || !klass || !Number.isFinite(durationMinutes)) return [];
    return findScheduleClashes(
      {
        classId,
        className: klass.name,
        scheduledAt,
        durationMinutes,
        rooms: mode === "OFFLINE" ? rooms : [],
        invigilatorNames:
          mode === "OFFLINE"
            ? invigilators
                .map(
                  (id) => context.invigilators.find((i) => i.id === id)?.name,
                )
                .filter((n): n is string => n !== undefined)
            : [],
      },
      context.scheduled,
      context.today,
    );
  }, [
    scheduledAt,
    klass,
    classId,
    durationMinutes,
    mode,
    rooms,
    invigilators,
    context.invigilators,
    context.scheduled,
    context.today,
  ]);

  const blocked = hasBlockingClash(clashes);
  const warnings = clashes.filter((c) => !c.blocking);

  /** Seats the chosen rooms provide, against the class the exam is for. */
  const seatCapacity = rooms.reduce(
    (a, r) => a + (context.rooms.find((x) => x.roomNo === r)?.capacity ?? 0),
    0,
  );

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the exam a title";
    if (!subjectId) e.subject = "Choose the subject being examined";

    // Validated in JS, not with native `min`/`max`: the native attributes
    // suppress the form's own message and the field silently refuses.
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
      e.duration = "Duration must be above zero";
    else if (durationMinutes > 360) e.duration = "That is longer than 6 hours";

    const total = Number(totalMarks);
    const pass = Number(passingMarks);
    if (!Number.isFinite(total) || total <= 0)
      e.marks = "Total marks must be above zero";
    else if (!Number.isFinite(pass) || pass < 0)
      e.marks = "Passing marks cannot be negative";
    else if (pass > total) e.marks = "Passing marks cannot exceed the total";

    if (mode === "OFFLINE" && rooms.length === 0)
      e.rooms = "An offline exam needs at least one hall";

    return e;
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy || blocked) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-B): POST /api/v1/exams — writes `exams` (§7.2) and, for an
    // offline exam, one `exam_hall_allocations` row per room. The server must
    // re-run the clash check inside the transaction: this UI check is a
    // courtesy, not the constraint.
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    setDone(
      `POST /exams { class_id: "${classId}", subject_id: "${subjectId}", scheduled_at: "${scheduledAt}", duration_minutes: ${durationMinutes}, mode: "${mode}"${mode === "OFFLINE" ? `, rooms: [${rooms.length}]` : ""} } — API not connected yet (Dev-B, C-EC-03).`,
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/examination"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Exam schedule
      </Link>

      <h1 className="font-display text-[22px] font-bold text-foreground">
        Schedule an exam
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        For any class in the institution. Clashes are checked as you choose.
      </p>

      {done && (
        <FormAlert variant="success" className="mt-4">
          {done}
        </FormAlert>
      )}

      {!canEdit && (
        <FormAlert variant="info" className="mt-4">
          You can review the schedule but not change it — creating exams
          belongs to the Exam Controller.
        </FormAlert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-4 grid min-w-0 gap-4">
        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            1. What is being examined
          </h2>

          <div className="grid min-w-0 gap-4">
            <Field id="exam-title" label="Title" error={errors.title}>
              <input
                id="exam-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mid-term Examination — Algorithms"
                className={structureInput(!!errors.title)}
              />
            </Field>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id="exam-class" label="Class">
                <select
                  id="exam-class"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    // A subject belongs to one class, so the old choice is
                    // never valid for the new one.
                    setSubjectId("");
                  }}
                  className={structureInput()}
                >
                  {context.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.departmentCode}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="exam-subject" label="Subject" error={errors.subject}>
                <select
                  id="exam-subject"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={structureInput(!!errors.subject)}
                >
                  <option value="">Choose a subject…</option>
                  {classSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {classSubjects.length === 0 && (
              <p className="text-[12px] text-[#B45309]">
                {klass?.name} has no subjects yet — add one before scheduling
                an exam for it.
              </p>
            )}

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id="exam-type" label="Paper type">
                <select
                  id="exam-type"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className={structureInput()}
                >
                  <option value="MCQ">MCQ</option>
                  <option value="DESCRIPTIVE">Descriptive</option>
                  <option value="MIXED">Mixed</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </Field>

              <Field id="exam-mode" label="Mode">
                <select
                  id="exam-mode"
                  value={mode}
                  onChange={(e) => {
                    const next = e.target.value as ExamMode;
                    setMode(next);
                    // An online exam has no hall; clearing avoids submitting
                    // rooms that would never be written.
                    if (next === "ONLINE") {
                      setRooms([]);
                      setInvigilators([]);
                    }
                  }}
                  className={structureInput()}
                >
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline (needs a hall)</option>
                </select>
              </Field>
            </div>
          </div>
        </StructureCard>

        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            2. When
          </h2>

          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Field id="exam-date" label="Date">
              <input
                id="exam-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={structureInput()}
              />
            </Field>
            <Field id="exam-time" label="Start time">
              <input
                id="exam-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={structureInput()}
              />
            </Field>
            <Field
              id="exam-duration"
              label="Duration"
              error={errors.duration}
              hint={
                Number.isFinite(durationMinutes) && durationMinutes > 0
                  ? minutesLabel(durationMinutes)
                  : undefined
              }
            >
              <input
                id="exam-duration"
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={structureInput(!!errors.duration)}
              />
            </Field>
          </div>

          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            <Field id="exam-total" label="Total marks" error={errors.marks}>
              <input
                id="exam-total"
                type="number"
                inputMode="numeric"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className={structureInput(!!errors.marks)}
              />
            </Field>
            <Field id="exam-pass" label="Passing marks" error={errors.marks}>
              <input
                id="exam-pass"
                type="number"
                inputMode="numeric"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className={structureInput(!!errors.marks)}
              />
            </Field>
          </div>
        </StructureCard>

        {/* Halls — offline only (§7.2: `exam_hall_allocations` is for
            offline exams) */}
        {mode === "OFFLINE" && (
          <StructureCard>
            <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
              3. Halls and invigilators
            </h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              §4.6 puts both in your hands. A hall already taken at this time
              is refused below.
            </p>

            <fieldset className="min-w-0">
              <legend className="text-[13px] font-medium text-[#334155]">
                Halls
                {seatCapacity > 0 && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {seatCapacity} seats selected
                  </span>
                )}
              </legend>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                {context.rooms.map((room) => (
                  <label
                    key={room.roomNo}
                    htmlFor={`room-${room.roomNo}`}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-field border px-3 py-2.5 transition",
                      rooms.includes(room.roomNo)
                        ? "border-accent bg-accent-light/40"
                        : "border-border hover:border-accent",
                    )}
                  >
                    <input
                      id={`room-${room.roomNo}`}
                      type="checkbox"
                      checked={rooms.includes(room.roomNo)}
                      onChange={() => setRooms(toggle(rooms, room.roomNo))}
                      className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {room.roomNo}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {room.capacity} seats
                    </span>
                  </label>
                ))}
              </div>
              {errors.rooms && (
                <p className="mt-1 text-[12px] text-destructive-text">
                  {errors.rooms}
                </p>
              )}
            </fieldset>

            <fieldset className="mt-4 min-w-0">
              <legend className="text-[13px] font-medium text-[#334155]">
                Invigilators
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional — can be assigned later)
                </span>
              </legend>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                {context.invigilators.map((inv) => (
                  <label
                    key={inv.id}
                    htmlFor={`inv-${inv.id}`}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-field border px-3 py-2.5 transition",
                      invigilators.includes(inv.id)
                        ? "border-accent bg-accent-light/40"
                        : "border-border hover:border-accent",
                    )}
                  >
                    <input
                      id={`inv-${inv.id}`}
                      type="checkbox"
                      checked={invigilators.includes(inv.id)}
                      onChange={() =>
                        setInvigilators(toggle(invigilators, inv.id))
                      }
                      className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {inv.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {inv.departmentCode}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </StructureCard>
        )}

        {/* Clashes — the reason this page exists */}
        {clashes.length > 0 && (
          <div className="grid min-w-0 gap-2">
            {clashes.map((c, i) => (
              <div
                key={`${c.kind}-${i}`}
                className={cn(
                  "flex min-w-0 items-start gap-2.5 rounded-field border px-3.5 py-3",
                  c.blocking
                    ? "border-destructive-border bg-destructive-light"
                    : "border-warning-border bg-warning-light",
                )}
              >
                <TriangleAlert
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    c.blocking ? "text-destructive-text" : "text-[#B45309]",
                  )}
                  aria-hidden="true"
                />
                <p
                  className={cn(
                    "min-w-0 text-[12px] leading-6",
                    c.blocking ? "text-destructive-text" : "text-[#B45309]",
                  )}
                >
                  {c.message}
                  <span className="ml-1 font-medium">
                    {c.blocking ? "This must be resolved." : "Allowed, but check it is intended."}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {clashes.length === 0 && scheduledAt && (
          <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-success-text">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            No clashes — {klass?.name} is free at{" "}
            {dueDateTime(scheduledAt)}.
          </p>
        )}

        {Object.keys(errors).length > 0 && (
          <FormAlert variant="error">
            Check the highlighted fields and try again.
          </FormAlert>
        )}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {context.scheduled.length} exams already on the institution
            timetable.
          </p>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/examination"
              className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              loading={busy}
              loadingText="Scheduling…"
              disabled={!canEdit || blocked}
              className="w-auto px-5"
            >
              Schedule exam
            </Button>
          </div>
        </div>

        {blocked && (
          <p className="text-right text-[12px] text-destructive-text">
            Resolve the clash above before scheduling.
          </p>
        )}
        {!blocked && warnings.length > 0 && (
          <p className="text-right text-[12px] text-[#B45309]">
            {warnings.length} warning
            {warnings.length === 1 ? "" : "s"} — you can still schedule.
          </p>
        )}
      </form>
    </div>
  );
}
