"use client";

import { useState } from "react";
import { CalendarRange, Check } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  CreateButton,
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "./structure-bits";
import type { AcademicYearRow } from "@/types/settings";

/**
 * C-IA-04 — Academic Year Setup.
 * "Create years, set current year, view archive"
 *
 * The three verbs are the three things this page does. The rule that shapes
 * it is §6.1's partial unique index —
 * `CREATE UNIQUE INDEX uq_one_current_year ON academic_years (tenant_id)
 *  WHERE is_current = TRUE` — so making a year current is inherently a *swap*,
 * not a toggle. The confirmation says which year is being displaced, because
 * changing it repoints every class, enrolment and timetable in the app.
 *
 * The archive is not a separate tab: past years are the same rows with
 * `is_current = false`, and splitting them would hide the one comparison an
 * admin actually makes — is this year's intake bigger than last year's.
 */
export function AcademicYears({
  years,
  canEdit,
}: {
  years: AcademicYearRow[];
  /** §4.3: PAGE 16 already gives the Principal a read-only Academic Year
   *  section — a Principal needs to know which year is current, not set it. */
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<AcademicYearRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Newest first. Sorted on `startDate` (an ISO key), never on the formatted
  // name — "2024-25" vs "2023-24" happens to sort correctly as a string, but
  // that is luck, not a guarantee.
  const sorted = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = years.find((y) => y.isCurrent);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <StructureHeader
        title="Academic years"
        description="Classes, enrolments and results are all scoped to a year. Exactly one can be current."
        action={
          canEdit ? (
            <CreateButton label="New year" onClick={() => setCreating(true)} />
          ) : (
            <ReadOnlyNote />
          )
        }
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {!current && (
        <FormAlert variant="error" className="mb-4">
          No year is marked current. Enrolment, attendance and results have no
          year to attach to until one is set.
        </FormAlert>
      )}

      <StructureCard>
        <ul className="min-w-0 divide-y divide-border">
          {sorted.map((y) => (
            <li key={y.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-foreground">
                      {y.name}
                    </span>
                    {y.isCurrent ? (
                      <StructureChip tone="success">Current</StructureChip>
                    ) : (
                      <StructureChip tone="muted">Archived</StructureChip>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {formatDate(y.startDate)} – {formatDate(y.endDate)} ·{" "}
                    {y.classCount} classes ·{" "}
                    {y.studentCount.toLocaleString("en-IN")} students
                  </p>
                </div>

                {y.isCurrent ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-success-text">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    In use
                  </span>
                ) : canEdit ? (
                  <button
                    type="button"
                    onClick={() => setSwitching(y)}
                    className="shrink-0 rounded-field border border-border px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    Make current
                    <span className="sr-only"> — {y.name}</span>
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </StructureCard>

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Only one year is current at a time — the database enforces it. Past
        years stay readable; their classes and results are never deleted.
      </p>

      {creating && (
        <YearForm
          years={years}
          onClose={() => setCreating(false)}
          onDone={(message) => {
            setCreating(false);
            setNotice(message);
          }}
        />
      )}

      {switching && (
        <SwitchYearDialog
          target={switching}
          current={current ?? null}
          onCancel={() => setSwitching(null)}
          onConfirm={() => {
            const name = switching.name;
            setSwitching(null);
            setNotice(
              `PATCH /academic-years/${switching.id}/current — API not connected yet (Dev-A, C-IA-04). ${name} would become the current year.`,
            );
          }}
        />
      )}
    </div>
  );
}

/* ── Create ─────────────────────────────────────────────────────────────── */

function YearForm({
  years,
  onClose,
  onDone,
}: {
  years: AcademicYearRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function validate() {
    const e: Record<string, string> = {};

    if (!name.trim()) e.name = "Enter a name, e.g. 2026-27";
    // UNIQUE (tenant_id, name) — §6.1
    else if (
      years.some((y) => y.name.toLowerCase() === name.trim().toLowerCase())
    )
      e.name = `“${name.trim()}” already exists`;

    if (!startDate) e.startDate = "Set the start date";
    if (!endDate) e.endDate = "Set the end date";
    // Validated here, not with a native `min` on the date input: the native
    // attribute suppresses the form's own message and the field silently
    // refuses to submit.
    else if (startDate && endDate && endDate <= startDate)
      e.endDate = "The end date must be after the start date";

    // Overlapping years would make "which year is this class in?" ambiguous
    if (startDate && endDate && !e.endDate) {
      const clash = years.find(
        (y) => startDate <= y.endDate && endDate >= y.startDate,
      );
      if (clash) e.startDate = `Overlaps ${clash.name} (${formatDate(clash.startDate)} – ${formatDate(clash.endDate)})`;
    }

    return e;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-A): POST /api/v1/academic-years — §6.1. Setting `is_current`
    // must clear the previous holder in the same transaction, or the partial
    // unique index rejects the insert.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `POST /academic-years { name: "${name}", start_date: "${startDate}", end_date: "${endDate}", is_current: ${makeCurrent} } — API not connected yet (Dev-A, C-IA-04).`,
    );
  }

  return (
    <StructureDialog
      titleId="year-form-title"
      title="New academic year"
      description="Years cannot overlap — a class has to belong to exactly one."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="year-name"
          label="Name"
          error={errors.name}
          hint="However your institution writes it, e.g. 2026-27."
        >
          <input
            id="year-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2026-27"
            className={structureInput(!!errors.name)}
          />
        </Field>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="year-start" label="Starts" error={errors.startDate}>
            <input
              id="year-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={structureInput(!!errors.startDate)}
            />
          </Field>
          <Field id="year-end" label="Ends" error={errors.endDate}>
            <input
              id="year-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={structureInput(!!errors.endDate)}
            />
          </Field>
        </div>

        {/* Explicit id + `for`, not a wrapping label — assistive tech
            resolves a bound label more reliably. */}
        <label
          htmlFor="year-current"
          className="flex min-w-0 items-start gap-2.5"
        >
          <input
            id="year-current"
            type="checkbox"
            checked={makeCurrent}
            onChange={(e) => setMakeCurrent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
          />
          <span className="min-w-0 text-[13px] text-[#334155]">
            Make this the current year
            <span className="block text-[12px] text-muted-foreground">
              New enrolments, attendance and results will attach to it. The
              year that is current now becomes archived.
            </span>
          </span>
        </label>

        {Object.keys(errors).length > 0 && (
          <FormAlert variant="error">
            Check the highlighted fields and try again.
          </FormAlert>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            Cancel
          </button>
          <Button
            type="submit"
            loading={busy}
            loadingText="Creating…"
            className="w-auto px-5"
          >
            Create year
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}

/* ── Switch current year ────────────────────────────────────────────────── */

/**
 * Making a year current displaces the one that holds it — §6.1's partial
 * unique index allows only one. The dialog names both sides, because this
 * single switch changes what every other page in the app defaults to.
 */
function SwitchYearDialog({
  target,
  current,
  onCancel,
  onConfirm,
}: {
  target: AcademicYearRow;
  current: AcademicYearRow | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <StructureDialog
      titleId="switch-year-title"
      title={`Make ${target.name} the current year?`}
      onClose={onCancel}
    >
      <p className="text-[13px] leading-6 text-muted-foreground">
        {current ? (
          <>
            <span className="font-medium text-foreground">{current.name}</span>{" "}
            becomes archived and{" "}
            <span className="font-medium text-foreground">{target.name}</span>{" "}
            takes over. New enrolments, attendance sessions and results attach
            to {target.name}; everything already recorded stays where it is.
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">{target.name}</span>{" "}
            becomes the year that new enrolments, attendance and results attach
            to.
          </>
        )}
      </p>

      <div
        className={cn(
          "mt-4 rounded-field border border-accent-border bg-accent-light px-3.5 py-3",
        )}
      >
        <p className="text-[12px] leading-6 text-[#3730A3]">
          {target.classCount} classes and{" "}
          {target.studentCount.toLocaleString("en-IN")} students are already
          recorded against {target.name}.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          Cancel
        </button>
        <Button
          type="button"
          onClick={onConfirm}
          className="h-10 w-auto px-4 text-[13px] shadow-none"
        >
          Make current
        </Button>
      </div>
    </StructureDialog>
  );
}
