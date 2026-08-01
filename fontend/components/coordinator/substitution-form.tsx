"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Info, Repeat, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  dateLabel,
  dowOf,
  findSubstitutionIssues,
  hasBlockingIssue,
} from "@/lib/coordinator";
import { DAYS, formatTime } from "@/lib/timetable";
import { usePreviewHref } from "@/lib/use-preview-href";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  StructureCard,
  structureInput,
} from "@/components/structure/structure-bits";
import type { SubstitutionFormContext } from "@/types/coordinator";

/**
 * C-AC-06 — Add Substitution.
 * "Assign substitute teacher for a specific slot + date"
 *
 * Three decisions in order — when, which period, who covers it — because each
 * one narrows the next: the date fixes the weekday, the weekday fixes which
 * periods exist, and the period decides who is actually free to take it.
 *
 * Conflicts are checked as the coordinator chooses rather than on submit. The
 * point is to steer the choice; refusing it afterwards means re-picking a
 * teacher who was never available.
 */
export function SubstitutionForm({
  context,
}: {
  context: SubstitutionFormContext;
}) {
  const href = usePreviewHref();

  const [date, setDate] = useState(context.today);
  const [slotId, setSlotId] = useState("");
  const [substituteId, setSubstituteId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  /** The weekday the chosen date falls on — 1=Mon…6=Sat, null on Sunday. */
  const dow = useMemo(() => dowOf(date), [date]);

  /** Only periods that exist on that weekday can be covered. */
  const slotsThatDay = useMemo(
    () => (dow === null ? [] : context.slots.filter((s) => s.dayOfWeek === dow)),
    [context.slots, dow],
  );

  const slot = useMemo(
    () => slotsThatDay.find((s) => s.slotId === slotId) ?? null,
    [slotsThatDay, slotId],
  );

  /**
   * How many *other* periods this substitute already covers on that date.
   *
   * Counted from the rows the server shipped, excluding the slot being edited
   * so re-picking the same period doesn't count against itself. Drives the
   * `HEAVY_LOAD` warning.
   */
  const coveringCount = useMemo(
    () =>
      context.taken.filter(
        (t) =>
          t.date === date &&
          t.substituteTeacherId === substituteId &&
          t.slotId !== slotId,
      ).length,
    [context.taken, date, substituteId, slotId],
  );

  const issues = useMemo(() => {
    if (!slot || !substituteId) return [];
    const sub = context.candidates.find((c) => c.id === substituteId);
    if (!sub) return [];

    return findSubstitutionIssues(
      { slot, date, substituteId, substituteName: sub.name },
      {
        today: context.today,
        taken: context.taken,
        busyCells: context.busyCells,
        coveringCount,
      },
    );
  }, [
    slot,
    substituteId,
    date,
    context.candidates,
    context.today,
    context.taken,
    context.busyCells,
    coveringCount,
  ]);

  const blocked = hasBlockingIssue(issues);

  /** Who is free for this period — computed so the picker can say so. */
  const availability = useMemo(() => {
    if (!slot || dow === null) return new Map<string, boolean>();
    const cell = `${dow}-${slot.periodNumber}`;
    return new Map(
      context.candidates.map((c) => [
        c.id,
        c.id !== slot.teacherId &&
          !(context.busyCells[c.id] ?? []).includes(cell),
      ]),
    );
  }, [slot, dow, context.candidates, context.busyCells]);

  const freeCount = [...availability.values()].filter(Boolean).length;

  function validate() {
    const next: Record<string, string> = {};
    if (!date) next.date = "Pick a date.";
    else if (dow === null) next.date = "There are no classes on a Sunday.";
    if (!slotId) next.slot = "Choose the period to cover.";
    if (!substituteId) next.substitute = "Choose who will cover it.";
    return next;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length || blocked) return;

    setSaving(true);
    const sub = context.candidates.find((c) => c.id === substituteId);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(
        `POST /timetable/substitutions { slot_id: "${slotId}", date: "${date}", substitute_teacher_id: "${substituteId}", original_teacher_id: "${slot?.teacherId}", reason: ${reason ? `"${reason}"` : "null"} } — API not connected yet (Dev-B, C-AC-06). ${sub?.name} would cover ${slot?.className}.`,
      );
    }, 400);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href={href("/coordinator/substitutions")}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Substitutions
      </Link>

      <h1 className="mt-3 font-display text-[22px] font-bold text-foreground">
        Add a substitution
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Cover one period on one date. Clashes are checked as you choose.
      </p>

      {saved && (
        <FormAlert variant="info" className="mt-4">
          {saved}
        </FormAlert>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-4 grid min-w-0 gap-4">
        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            1. When
          </h2>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field
              id="sub-date"
              label="Date"
              error={errors.date}
              hint={dow === null ? undefined : dateLabel(date)}
            >
              <input
                id="sub-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  // The weekday changes, so the chosen period may not exist
                  setSlotId("");
                }}
                className={structureInput(!!errors.date)}
              />
            </Field>

            <Field
              id="sub-slot"
              label="Period to cover"
              error={errors.slot}
              hint={
                dow === null
                  ? undefined
                  : `${slotsThatDay.length} on ${DAYS.find((d) => d.value === dow)?.long}`
              }
            >
              <select
                id="sub-slot"
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className={structureInput(!!errors.slot)}
              >
                <option value="">Choose a period...</option>
                {slotsThatDay.map((s) => (
                  <option key={s.slotId} value={s.slotId}>
                    P{s.periodNumber} {formatTime(s.startTime)} · {s.className} ·{" "}
                    {s.subjectCode ?? s.subjectName} — {s.teacherName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {dow === null && (
            <p className="mt-3 text-[12px] text-destructive-text">
              There are no classes on a Sunday — pick another date.
            </p>
          )}
        </StructureCard>

        {slot && (
          <StructureCard>
            <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
              2. Who covers it
            </h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              {slot.teacherName} normally teaches {slot.subjectCode ?? slot.subjectName}{" "}
              to {slot.className} in period {slot.periodNumber}.{" "}
              {freeCount === 1
                ? "1 teacher is free then."
                : `${freeCount} teachers are free then.`}
            </p>

            <Field id="sub-teacher" label="Substitute" error={errors.substitute}>
              <select
                id="sub-teacher"
                value={substituteId}
                onChange={(e) => setSubstituteId(e.target.value)}
                className={structureInput(!!errors.substitute)}
              >
                <option value="">Choose a teacher...</option>
                {context.candidates.map((c) => {
                  const free = availability.get(c.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.departmentName}
                      {c.id === slot.teacherId
                        ? " (already teaches this period)"
                        : free
                          ? ""
                          : " (busy this period)"}
                    </option>
                  );
                })}
              </select>
            </Field>

            <div className="mt-4">
              <Field
                id="sub-reason"
                label="Reason"
                optional
                hint="Recorded on the substitution so the timetable explains itself later."
              >
                <textarea
                  id="sub-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Medical leave"
                  className="mt-1.5 w-full min-w-0 rounded-field border border-border bg-white px-3 py-2 text-[14px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                />
              </Field>
            </div>
          </StructureCard>
        )}

        {/* Clashes — the reason the page checks as you choose */}
        {issues.length > 0 && (
          <div
            className={cn(
              "min-w-0 rounded-field border p-4",
              blocked
                ? "border-destructive-border bg-destructive-light/30"
                : "border-warning-border bg-warning-light/40",
            )}
          >
            <ul className="grid min-w-0 gap-2">
              {issues.map((issue) => (
                <li key={issue.kind} className="flex min-w-0 items-start gap-2">
                  <TriangleAlert
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      issue.blocking ? "text-destructive" : "text-warning",
                    )}
                    aria-hidden="true"
                  />
                  <p className="min-w-0 break-words text-[13px] text-foreground">
                    {issue.message}{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        issue.blocking
                          ? "text-destructive-text"
                          : "text-warning-text",
                      )}
                    >
                      {issue.blocking
                        ? "This must be resolved."
                        : "Allowed, but check it is intended."}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {slot && issues.length === 0 && substituteId && (
          <p className="flex min-w-0 items-start gap-2 text-[13px] text-success-text">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              No clashes — this period is free to reassign on {dateLabel(date)}.
            </span>
          </p>
        )}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-start gap-2 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              {context.taken.length} substitution
              {context.taken.length === 1 ? "" : "s"} already arranged.
            </span>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={href("/coordinator/substitutions")}
              className="inline-flex h-11 items-center rounded-field border border-border bg-white px-5 text-[14px] font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Cancel
            </Link>
            <Button type="submit" loading={saving} disabled={blocked} className="w-auto px-5">
              <Repeat className="h-4 w-4" aria-hidden="true" />
              Save substitution
            </Button>
          </div>
        </div>

        {blocked && (
          <p
            className="text-right text-[12px] font-medium text-destructive-text"
            role="status"
          >
            Resolve the clash above before saving.
          </p>
        )}
      </form>
    </div>
  );
}
