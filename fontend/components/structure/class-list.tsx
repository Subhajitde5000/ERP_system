"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { classDeleteBlock, validateClassCode } from "@/lib/structure";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  FilterBar,
  FilterSelect,
  ResultCount,
  SearchBox,
} from "@/components/platform/list-filters";
import { Button } from "@/components/ui/button";
import {
  CapacityMeter,
  CreateButton,
  DeleteDialog,
  Field,
  RosterScopeNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  ReadOnlyNote,
  StructureHeader,
  structureInput,
  VacantLabel,
} from "./structure-bits";
import type { AcademicYearRow } from "@/types/settings";
import type { ClassRow, DepartmentRow } from "@/types/structure";

/**
 * C-IA-05 — Class Management.
 * "All classes: filter by dept, year. Create/edit/delete."
 *
 * Both filters the doc names are here, and the year one matters: `classes`
 * is keyed on `academic_year_id` (§6.3), so last year's cohort is still a row
 * and would otherwise pad every count. It defaults to the **current year**
 * rather than "all" — an admin managing classes means this year's, and
 * showing the archive by default makes the list look duplicated.
 *
 * The department filter accepts `?department=` so C-IA-03's "Manage classes"
 * link lands pre-filtered.
 */
export function ClassList({
  classes,
  departments,
  years,
  staff,
  canEdit,
}: {
  classes: ClassRow[];
  departments: DepartmentRow[];
  years: AcademicYearRow[];
  staff: { id: string; name: string; departmentName: string }[];
  /** §4.3: Principal / VP read the structure, they don't edit it. */
  canEdit: boolean;
}) {
  const params = useSearchParams();
  const currentYear = years.find((y) => y.isCurrent);

  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(
    params.get("department") ?? "ALL",
  );
  const [year, setYear] = useState(currentYear?.id ?? "ALL");
  const [teacherFilter, setTeacherFilter] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => {
      if (department !== "ALL" && c.departmentId !== department) return false;
      if (year !== "ALL" && c.academicYearId !== year) return false;
      if (teacherFilter === "VACANT" && c.classTeacherId !== null) return false;
      if (teacherFilter === "ASSIGNED" && c.classTeacherId === null) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.departmentCode.toLowerCase().includes(q) ||
        (c.roomNo ?? "").toLowerCase().includes(q) ||
        (c.classTeacherName ?? "").toLowerCase().includes(q)
      );
    });
  }, [classes, query, department, year, teacherFilter]);

  const enrolled = shown.reduce((a, c) => a + c.enrolledCount, 0);
  const capacity = shown.reduce((a, c) => a + c.maxStrength, 0);
  const unstaffed = shown.filter((c) => c.classTeacherId === null).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <StructureHeader
        title="Classes"
        description="Every cohort, by department and academic year."
        action={
          canEdit ? (
            <CreateButton label="New class" onClick={() => setCreating(true)} />
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

      <StructureCard>
        <SearchBox
          id="class-search"
          label="Search classes"
          value={query}
          onChange={setQuery}
          placeholder="Search by name, code, room or class teacher…"
        />

        <FilterBar>
          <FilterSelect
            id="class-year"
            label="Filter by academic year"
            value={year}
            onChange={setYear}
            allLabel="All years"
            options={years.map((y) => [
              y.id,
              y.isCurrent ? `${y.name} (current)` : y.name,
            ])}
          />
          <FilterSelect
            id="class-dept"
            label="Filter by department"
            value={department}
            onChange={setDepartment}
            allLabel="All departments"
            options={departments.map((d) => [d.id, d.code])}
          />
          <FilterSelect
            id="class-teacher"
            label="Filter by class teacher"
            value={teacherFilter}
            onChange={setTeacherFilter}
            allLabel="Any class teacher"
            options={[
              ["ASSIGNED", "Teacher assigned"],
              ["VACANT", "No class teacher"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="class" plural="classes" />

        {shown.length === 0 ? (
          <EmptyState
            message={
              year !== "ALL"
                ? "No classes match these filters in the selected year."
                : "No classes match these filters."
            }
          />
        ) : (
          <>
            {/* ≥768px: table */}
            <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
              <table className="w-full min-w-[820px] border-collapse">
                <caption className="sr-only">
                  Classes — {shown.length} rows, {enrolled} of {capacity} seats
                  filled
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    {[
                      ["Class", false],
                      ["Department", false],
                      ["Year", false],
                      ["Class teacher", false],
                      ["Room", false],
                      ["Subjects", true],
                      ["Enrolled", false],
                      ["", false],
                    ].map(([h, numeric], i) => (
                      <th
                        key={i}
                        scope="col"
                        className={cn(
                          "py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          numeric ? "text-right" : "text-left",
                        )}
                      >
                        {h as string}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left align-top">
                        <Link
                          href={`/classes/${c.id}`}
                          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          {c.name}
                        </Link>
                        <span className="font-mono text-[11px] font-normal text-muted-foreground">
                          {c.code}
                        </span>
                      </th>
                      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.departmentCode}
                      </td>
                      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.academicYearName}
                      </td>
                      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.classTeacherName ?? (
                          <VacantLabel>Unassigned</VacantLabel>
                        )}
                      </td>
                      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.roomNo ?? "—"}
                      </td>
                      <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {c.subjectCount}
                      </td>
                      <td className="w-28 py-3 pr-3 align-top">
                        <CapacityMeter
                          enrolled={c.enrolledCount}
                          maxStrength={c.maxStrength}
                        />
                      </td>
                      <td className="py-3 align-top">
                        {canEdit && (
                          <div className="flex shrink-0 items-center justify-end gap-1">
                            <IconAction
                              label={`Edit ${c.name}`}
                              onClick={() => setEditing(c)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label={`Delete ${c.name}`}
                              onClick={() => setDeleting(c)}
                              danger
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </IconAction>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* <768px: stacked */}
            <ul className="min-w-0 divide-y divide-border border-t border-border md:hidden">
              {shown.map((c) => (
                <li key={c.id} className="min-w-0 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/classes/${c.id}`}
                        className="block truncate rounded text-[13px] font-medium text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {c.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {c.code} · {c.departmentCode}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        <IconAction
                          label={`Edit ${c.name}`}
                          onClick={() => setEditing(c)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconAction>
                        <IconAction
                          label={`Delete ${c.name}`}
                          onClick={() => setDeleting(c)}
                          danger
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconAction>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.academicYearName} · {c.enrolledCount}/{c.maxStrength}{" "}
                    enrolled · {c.subjectCount} subjects ·{" "}
                    {c.classTeacherName ?? <VacantLabel>Unassigned</VacantLabel>}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </StructureCard>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {enrolled} of {capacity} seats filled across {shown.length}{" "}
          {shown.length === 1 ? "class" : "classes"}
        </span>
        {unstaffed > 0 && (
          <span className="font-medium text-[#B45309]">
            {unstaffed} without a class teacher
          </span>
        )}
      </div>
      <RosterScopeNote className="mt-2" />

      {(creating || editing) && (
        <ClassForm
          klass={editing}
          classes={classes}
          departments={departments}
          years={years}
          staff={staff}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={(message) => {
            setCreating(false);
            setEditing(null);
            setNotice(message);
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          entity="class"
          name={deleting.name}
          blockedReason={classDeleteBlock(deleting)}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const name = deleting.name;
            setDeleting(null);
            setNotice(
              `DELETE /classes/${deleting.id} — API not connected yet (Dev-A, C-IA-05). ${name} would be removed.`,
            );
          }}
        />
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
        danger
          ? "text-muted-foreground hover:bg-destructive-light hover:text-destructive-text"
          : "text-muted-foreground hover:bg-accent-light hover:text-accent",
      )}
    >
      {children}
    </button>
  );
}

/* ── Create / edit ──────────────────────────────────────────────────────── */

function ClassForm({
  klass,
  classes,
  departments,
  years,
  staff,
  onClose,
  onDone,
}: {
  klass: ClassRow | null;
  classes: ClassRow[];
  departments: DepartmentRow[];
  years: AcademicYearRow[];
  staff: { id: string; name: string; departmentName: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const currentYear = years.find((y) => y.isCurrent);

  const [name, setName] = useState(klass?.name ?? "");
  const [code, setCode] = useState(klass?.code ?? "");
  const [departmentId, setDepartmentId] = useState(
    klass?.departmentId ?? departments[0]?.id ?? "",
  );
  const [yearId, setYearId] = useState(
    klass?.academicYearId ?? currentYear?.id ?? years[0]?.id ?? "",
  );
  const [maxStrength, setMaxStrength] = useState(String(klass?.maxStrength ?? 60));
  const [roomNo, setRoomNo] = useState(klass?.roomNo ?? "");
  const [teacherId, setTeacherId] = useState(klass?.classTeacherId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const editing = klass !== null;

  /**
   * UNIQUE is `(tenant_id, department_id, academic_year_id, code)` — the code
   * only has to be unique *within* the chosen department and year, which is
   * why `SY-A` legitimately exists in both CSE and ECE.
   */
  const siblings = useMemo(
    () =>
      classes
        .filter(
          (c) => c.departmentId === departmentId && c.academicYearId === yearId,
        )
        .map((c) => ({ code: c.code, id: c.id })),
    [classes, departmentId, yearId],
  );

  const dept = departments.find((d) => d.id === departmentId);
  // Staff in the chosen department first — a class teacher from elsewhere is
  // legal but unusual
  const preferred = staff.filter((s) => s.departmentName === dept?.code);
  const others = staff.filter((s) => s.departmentName !== dept?.code);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter the class name";

    const codeError = validateClassCode(code, siblings, klass?.id);
    if (codeError) next.code = codeError;

    // Validated in JS: a native `min` on a number input suppresses the form's
    // own message and the field silently refuses to submit.
    const max = Number(maxStrength);
    if (!Number.isFinite(max) || max <= 0)
      next.maxStrength = "Maximum strength must be above zero";
    else if (max > 500) next.maxStrength = "That looks too high — cap is 500";
    else if (editing && klass && max < klass.enrolledCount)
      next.maxStrength = `${klass.enrolledCount} students are already enrolled`;

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-A): POST/PATCH /api/v1/classes — writes `classes` (§6.3).
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      editing
        ? `PATCH /classes/${klass.id} { code: "${code.toUpperCase()}", max_strength: ${max} } — API not connected yet (Dev-A, C-IA-05).`
        : `POST /classes { name: "${name}", code: "${code.toUpperCase()}", department_id: "${departmentId}", academic_year_id: "${yearId}" } — API not connected yet (Dev-A, C-IA-05).`,
    );
  }

  return (
    <StructureDialog
      titleId="class-form-title"
      title={editing ? `Edit ${klass.name}` : "New class"}
      description="The code has to be unique within its department and academic year — the same code in two departments is fine."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="class-name" label="Class name" error={errors.name}>
            <input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="FY-BSc-A"
              className={structureInput(!!errors.name)}
            />
          </Field>

          <Field id="class-code" label="Code" error={errors.code}>
            <input
              id="class-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FY-A"
              className={cn(structureInput(!!errors.code), "font-mono")}
            />
          </Field>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="class-form-department" label="Department">
            <select
              id="class-form-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={structureInput()}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="class-form-year" label="Academic year">
            <select
              id="class-form-year"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className={structureInput()}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field
            id="class-strength"
            label="Maximum strength"
            error={errors.maxStrength}
            hint="Enrolment beyond this is refused."
          >
            <input
              id="class-strength"
              type="number"
              inputMode="numeric"
              value={maxStrength}
              onChange={(e) => setMaxStrength(e.target.value)}
              className={structureInput(!!errors.maxStrength)}
            />
          </Field>

          <Field id="class-room" label="Default room" optional>
            <input
              id="class-room"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              placeholder="CS-101"
              className={structureInput()}
            />
          </Field>
        </div>

        <Field
          id="class-form-teacher"
          label="Class teacher"
          optional
          hint="The teacher who owns attendance and parent contact for this class."
        >
          <select
            id="class-form-teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={structureInput()}
          >
            <option value="">Leave unassigned</option>
            {preferred.length > 0 && (
              <optgroup label={`In ${dept?.code ?? "department"}`}>
                {preferred.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label="Other departments">
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.departmentName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

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
            loadingText="Saving…"
            className="w-auto px-5"
          >
            {editing ? "Save changes" : "Create class"}
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}

/** Re-exported so the detail page can show the same chip vocabulary. */
export { StructureChip };
