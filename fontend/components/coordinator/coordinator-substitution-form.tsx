"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Info, RefreshCw, Repeat, TriangleAlert } from "lucide-react";

import { Card, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import {
  createCoordinatorSubstitution,
  fetchCoordinatorSubstitutionContext,
  type CoordinatorSubstituteCandidate,
  type CoordinatorSubstitutableSlot,
  type CoordinatorSubstitutionFormContext,
} from "@/lib/coordinator-api";
import {
  dateLabel,
  dowOf,
  findSubstitutionIssues,
  hasBlockingIssue,
} from "@/lib/coordinator";
import type { SubstitutionIssue } from "@/types/coordinator";
import { formatTime } from "@/lib/timetable";
import { useRouter } from "next/navigation";

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface BusyInfo {
  taken: { slotId: string; date: string; substituteTeacherId: string }[];
  busyCells: Record<string, string[]>;
}

/** C-AC-06 — arrange cover for one period on one date, served by the live API. */
export function CoordinatorSubstitutionFormPage() {
  const context = useResource(fetchCoordinatorSubstitutionContext, []);
  const router = useRouter();

  if (context.loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Add substitution" subtitle="Loading form…" />
      </div>
    );
  }
  if (context.error || !context.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Add substitution" subtitle="Could not load the form." />
        <p className="rounded-field border border-destructive-border bg-destructive-light/30 px-3 py-2 text-sm text-destructive-text">
          {context.error ?? "Form context unavailable."}
        </p>
        <button
          type="button"
          onClick={context.reload}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          Try again
        </button>
      </div>
    );
  }

  return <SubstitutionFormBody context={context.data} router={router} />;
}

function SubstitutionFormBody({
  context,
  router,
}: {
  context: CoordinatorSubstitutionFormContext;
  router: ReturnType<typeof useRouter>;
}) {
  const [date, setDate] = useState(context.today);
  const [slotId, setSlotId] = useState("");
  const [substituteId, setSubstituteId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dow = useMemo(() => dowOf(date), [date]);
  const slotsThatDay = useMemo(
    () => (dow === null ? [] : context.slots.filter((s) => s.day_of_week === dow)),
    [context.slots, dow],
  );

  const slot = useMemo(
    () => slotsThatDay.find((s) => s.slot_id === slotId) ?? null,
    [slotsThatDay, slotId],
  );

  // Pick a sensible default slot when the date changes.
  useEffect(() => {
    if (!slotsThatDay.find((s) => s.slot_id === slotId)) {
      setSlotId(slotsThatDay[0]?.slot_id ?? "");
    }
  }, [slotsThatDay, slotId]);

  const coveringCount = useMemo(
    () =>
      context.taken.filter(
        (t) =>
          t.date === date &&
          t.substitute_teacher_id === substituteId &&
          t.slot_id !== slotId,
      ).length,
    [context.taken, date, substituteId, slotId],
  );

  const issues = useMemo<SubstitutionIssue[]>(() => {
    if (!slot || !substituteId) return [];
    const sub = context.candidates.find((c) => c.id === substituteId);
    if (!sub) return [];
    return findSubstitutionIssues(
      {
        slot: legacySlot(slot),
        date,
        substituteId,
        substituteName: sub.name,
      },
      {
        today: context.today,
        taken: context.taken.map((entry) => ({
          slotId: entry.slot_id,
          date: entry.date,
          substituteTeacherId: entry.substitute_teacher_id,
        })),
        busyCells: context.busy_cells,
        coveringCount,
      },
    );
  }, [slot, substituteId, date, context.candidates, context.today, context.taken, context.busy_cells, coveringCount]);

  const blocked = hasBlockingIssue(issues);

  const availability = useMemo(() => {
    if (!slot || dow === null) return new Map<string, boolean>();
    const cell = `${dow}-${slot.period_number}`;
    return new Map(
      context.candidates.map((c) => [
        c.id,
        !!slot.teacher_id &&
          c.id !== slot.teacher_id &&
          !(context.busy_cells[c.id] ?? []).includes(cell),
      ]),
    );
  }, [slot, dow, context.candidates, context.busy_cells]);

  const freeCount = useMemo(
    () => [...availability.values()].filter(Boolean).length,
    [availability],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || !substituteId) {
      setError("Pick a date, a period and a substitute teacher.");
      return;
    }
    if (blocked) {
      setError("Resolve the blocking issues above before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await createCoordinatorSubstitution({
        slot_id: slot.slot_id,
        date,
        substitute_teacher_id: substituteId,
        reason: reason.trim() || null,
      });
      setSaved("Cover arranged. The board has been updated.");
      setTimeout(() => router.push("/coordinator/substitutions"), 600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save substitution.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/coordinator/substitutions"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Substitutions
      </Link>

      <PageHeader
        title="Add substitution"
        subtitle="Cover one period on one date. Clashes are checked as you choose."
      />

      {saved ? (
        <FormAlert variant="info">{saved}</FormAlert>
      ) : null}
      {error ? (
        <FormAlert variant="error">{error}</FormAlert>
      ) : null}

      <form onSubmit={submit} className="space-y-4">
        <Card className="!p-4">
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            1. When
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Date"
              hint={dow === null ? "Sunday has no classes" : dateLabel(date)}
            >
              <input
                type="date"
                value={date}
                min={context.today}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlotId("");
                }}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm focus:border-accent focus:outline-none"
              />
            </Field>
            <Field
              label="Period to cover"
              hint={
                dow === null
                  ? undefined
                  : `${slotsThatDay.length} on ${DAY_LABELS[dow] ?? ""}`
              }
            >
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                disabled={dow === null}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">Choose a period…</option>
                {slotsThatDay.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>
                    P{s.period_number} {formatTime(s.start_time)} · {s.class_name} ·{" "}
                    {s.subject_code ?? s.subject_name} — {s.teacher_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {slot ? (
          <Card className="!p-4">
            <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
              2. Who covers it
            </h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              {slot.teacher_name} normally teaches {slot.subject_code ?? slot.subject_name}{" "}
              to {slot.class_name} in period {slot.period_number}.{" "}
              {freeCount === 1
                ? "1 teacher is free then."
                : `${freeCount} teachers are free then.`}
            </p>
            <Field label="Substitute">
              <select
                value={substituteId}
                onChange={(e) => setSubstituteId(e.target.value)}
                className="h-10 rounded-field border border-border bg-white px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">Choose a teacher…</option>
                {context.candidates.map((c) => {
                  const free = availability.get(c.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.department_name ?? "—"}
                      {slot.teacher_id && c.id === slot.teacher_id
                        ? " (already teaches this period)"
                        : free
                          ? ""
                          : " (busy this period)"}
                    </option>
                  );
                })}
              </select>
            </Field>
            <div className="mt-3">
              <Field
                label="Reason (optional)"
                hint="Recorded on the substitution so the timetable explains itself later."
              >
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-field border border-border bg-white px-3 py-2 text-sm"
                  placeholder="e.g. Medical leave"
                />
              </Field>
            </div>
          </Card>
        ) : null}

        {issues.length > 0 ? (
          <div
            className={`rounded-field border p-4 ${
              blocked
                ? "border-destructive-border bg-destructive-light/30"
                : "border-warning-border bg-warning-light/40"
            }`}
          >
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li key={issue.kind} className="flex items-start gap-2 text-[13px] text-foreground">
                  <TriangleAlert
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      issue.blocking ? "text-destructive" : "text-warning"
                    }`}
                    aria-hidden
                  />
                  <span>
                    {issue.message}{" "}
                    <span
                      className={
                        issue.blocking
                          ? "font-semibold text-destructive-text"
                          : "font-semibold text-warning-text"
                      }
                    >
                      {issue.blocking ? "This must be resolved." : "Allowed, but check it is intended."}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {slot && issues.length === 0 && substituteId ? (
          <p className="flex items-start gap-2 text-[13px] text-success-text">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>No clashes — this period is free to reassign on {dateLabel(date)}.</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {context.taken.length} substitution
              {context.taken.length === 1 ? "" : "s"} already arranged.
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/coordinator/substitutions"
              className="inline-flex h-10 items-center rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              loading={saving}
              disabled={blocked || !slot || !substituteId}
              className="w-auto px-5"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Repeat className="h-4 w-4" aria-hidden />
              )}
              {saving ? "Saving…" : "Save substitution"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

// The conflict checker in `lib/coordinator.ts` works with the legacy
// SubstitutableSlot shape; translate the API DTO on the way in so the rule
// remains a single source of truth.
function legacySlot(slot: CoordinatorSubstitutableSlot) {
  return {
    slotId: slot.slot_id,
    classId: slot.class_id,
    className: slot.class_name,
    dayOfWeek: slot.day_of_week as 1 | 2 | 3 | 4 | 5 | 6,
    periodNumber: slot.period_number,
    startTime: slot.start_time,
    endTime: slot.end_time,
    subjectCode: slot.subject_code,
    subjectName: slot.subject_name,
    // The conflict check only uses teacherId to detect a self-substitution;
    // an empty string makes the rule skip the comparison, which is what
    // we want for a brand-new slot that has no teacher yet.
    teacherId: slot.teacher_id ?? "",
    teacherName: slot.teacher_name ?? "",
    roomNo: slot.room_no,
    slotType: slot.slot_type,
  };
}

// `BusyInfo` is a type kept in sync with the conflict checker input above.
export type { BusyInfo, CoordinatorSubstituteCandidate };
