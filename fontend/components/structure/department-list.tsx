"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Trash2, UserCog } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  departmentDeleteBlock,
  validateDepartmentCode,
} from "@/lib/structure";
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
  CreateButton,
  DeleteDialog,
  Field,
  StructureCard,
  StructureDialog,
  ReadOnlyNote,
  StructureHeader,
  structureInput,
  VacantLabel,
} from "./structure-bits";
import type { DepartmentRow } from "@/types/structure";

/**
 * C-IA-02 — Department Management.
 * "List, create, edit, delete departments. Assign HOD."
 *
 * All four verbs plus the HOD assignment are here. The one that needs care is
 * **delete**: §12's FK map has `departments ←── classes.department_id`, so a
 * department with classes cannot be removed. The dialog refuses and names
 * what to clear rather than offering a button that would 409.
 *
 * A vacant HOD is shown as "Vacant" in amber, not an em dash — four of the
 * six departments have nobody holding the grant in `role_assignments` (§5.6),
 * and that vacancy is the work this page exists to do.
 */
export function DepartmentList({
  departments,
  staff,
  canEdit,
}: {
  departments: DepartmentRow[];
  /** Candidates for the HOD picker — teaching staff, from `users` (§5.5) */
  staff: { id: string; name: string; departmentName: string }[];
  /**
   * §4.3 gives the Principal and Vice Principal institution-wide visibility
   * but not structural edit, so they read this page without any lever.
   * Decided on the server by `structureAccess()`.
   */
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hodFilter, setHodFilter] = useState("ALL");
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [assigning, setAssigning] = useState<DepartmentRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return departments.filter((d) => {
      if (hodFilter === "VACANT" && d.hodId !== null) return false;
      if (hodFilter === "ASSIGNED" && d.hodId === null) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.hodName ?? "").toLowerCase().includes(q)
      );
    });
  }, [departments, query, hodFilter]);

  const vacant = departments.filter((d) => d.hodId === null).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Departments"
        description="The academic units every class, subject and staff record hangs off."
        action={
          canEdit ? (
            <CreateButton label="New department" onClick={() => setCreating(true)} />
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

      {vacant > 0 && (
        <FormAlert variant="error" className="mb-4">
          {vacant} of {departments.length} departments have no HOD assigned.
          Approvals scoped to those departments have nobody to route to.
        </FormAlert>
      )}

      <StructureCard>
        <SearchBox
          id="dept-search"
          label="Search departments"
          value={query}
          onChange={setQuery}
          placeholder="Search by name, code or HOD…"
        />

        <FilterBar>
          <FilterSelect
            id="dept-hod"
            label="Filter by HOD"
            value={hodFilter}
            onChange={setHodFilter}
            allLabel="Any HOD state"
            options={[
              ["ASSIGNED", "HOD assigned"],
              ["VACANT", "HOD vacant"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="department" />

        {shown.length === 0 ? (
          <EmptyState message="No departments match these filters." />
        ) : (
          <>
            {/* ≥768px: table */}
            <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
              <table className="w-full min-w-[760px] border-collapse">
                <caption className="sr-only">
                  Departments — {shown.length} rows
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    {[
                      ["Department", false],
                      ["HOD", false],
                      ["Classes", true],
                      ["Subjects", true],
                      ["Teachers", true],
                      ["Students", true],
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
                  {shown.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left align-top">
                        <Link
                          href={`/departments/${d.id}`}
                          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          {d.name}
                        </Link>
                        <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                          {d.code}
                        </span>
                      </th>
                      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
                        {d.hodName ?? <VacantLabel />}
                      </td>
                      <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {d.classCount}
                      </td>
                      <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {d.subjectCount}
                      </td>
                      <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {d.teacherCount}
                      </td>
                      <td className="py-3 pr-3 text-right align-top text-[13px] tabular-nums text-foreground">
                        {d.studentCount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 align-top">
                        {canEdit && (
                          <RowActions
                            department={d}
                            onAssign={() => setAssigning(d)}
                            onEdit={() => setEditing(d)}
                            onDelete={() => setDeleting(d)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* <768px: stacked */}
            <ul className="min-w-0 divide-y divide-border border-t border-border md:hidden">
              {shown.map((d) => (
                <li key={d.id} className="min-w-0 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/departments/${d.id}`}
                        className="block truncate rounded text-[13px] font-medium text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {d.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {d.code}
                      </p>
                    </div>
                    {canEdit && (
                      <RowActions
                        department={d}
                        onAssign={() => setAssigning(d)}
                        onEdit={() => setEditing(d)}
                        onDelete={() => setDeleting(d)}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    HOD: {d.hodName ?? <VacantLabel />} · {d.classCount} classes ·{" "}
                    {d.subjectCount} subjects ·{" "}
                    {d.studentCount.toLocaleString("en-IN")} students
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </StructureCard>

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        A department cannot be deleted while classes still reference it.
        Student counts are the institution&apos;s full headcount.
      </p>

      {(creating || editing) && (
        <DepartmentForm
          department={editing}
          existingCodes={departments
            .filter((d) => d.id !== editing?.id)
            .map((d) => d.code)}
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

      {assigning && (
        <AssignHodDialog
          department={assigning}
          staff={staff}
          onClose={() => setAssigning(null)}
          onDone={(message) => {
            setAssigning(null);
            setNotice(message);
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          entity="department"
          name={deleting.name}
          blockedReason={departmentDeleteBlock(deleting)}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const name = deleting.name;
            setDeleting(null);
            setNotice(
              `DELETE /departments/${deleting.id} — API not connected yet (Dev-A, C-IA-02). ${name} would be removed.`,
            );
          }}
        />
      )}
    </div>
  );
}

function RowActions({
  department,
  onAssign,
  onEdit,
  onDelete,
}: {
  department: DepartmentRow;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <IconAction
        label={`${department.hodId ? "Change" : "Assign"} HOD for ${department.name}`}
        onClick={onAssign}
      >
        <UserCog className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction label={`Edit ${department.name}`} onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </IconAction>
      <IconAction
        label={`Delete ${department.name}`}
        onClick={onDelete}
        danger
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </IconAction>
    </div>
  );
}

/** Icon-only button — the accessible name goes in `aria-label`, not a title. */
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

function DepartmentForm({
  department,
  existingCodes,
  staff,
  onClose,
  onDone,
}: {
  department: DepartmentRow | null;
  existingCodes: string[];
  staff: { id: string; name: string; departmentName: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [hodId, setHodId] = useState(department?.hodId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const editing = department !== null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter the department's name";
    const codeError = validateDepartmentCode(code, existingCodes);
    if (codeError) next.code = codeError;

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-A): POST/PATCH /api/v1/departments — writes `departments`
    // (§6.2) and, when an HOD is picked, the HOD `role_assignments` row
    // scoped to this department (§5.6).
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      editing
        ? `PATCH /departments/${department.id} { code: "${code.toUpperCase()}" } — API not connected yet (Dev-A, C-IA-02).`
        : `POST /departments { name: "${name}", code: "${code.toUpperCase()}" } — API not connected yet (Dev-A, C-IA-02).`,
    );
  }

  return (
    <StructureDialog
      titleId="dept-form-title"
      title={editing ? `Edit ${department.name}` : "New department"}
      description="The code appears on timetables and mark sheets, so it is fixed to uppercase letters and numbers."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field id="dept-name" label="Department name" error={errors.name}>
          <input
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Computer Science & Engineering"
            className={structureInput(!!errors.name)}
          />
        </Field>

        <Field
          id="dept-code"
          label="Code"
          error={errors.code}
          hint="Unique across the institution. Max 20 characters."
        >
          <input
            id="dept-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CSE"
            className={cn(structureInput(!!errors.code), "font-mono")}
          />
        </Field>

        <Field id="dept-form-hod" label="Head of department" optional>
          <select
            id="dept-form-hod"
            value={hodId}
            onChange={(e) => setHodId(e.target.value)}
            className={structureInput()}
          >
            <option value="">Leave vacant for now</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.departmentName}
              </option>
            ))}
          </select>
        </Field>

        <Field id="dept-desc" label="Description" optional>
          <textarea
            id="dept-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What this department covers, and where it sits on campus."
            className={cn(structureInput(), "h-auto py-2.5 leading-6")}
          />
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
            {editing ? "Save changes" : "Create department"}
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}

/* ── Assign HOD ─────────────────────────────────────────────────────────── */

/**
 * "Assign HOD" is called out in C-IA-02's own description, so it gets a
 * dedicated action rather than being buried in the edit form — it is the one
 * change an admin makes to an existing department most often.
 */
function AssignHodDialog({
  department,
  staff,
  onClose,
  onDone,
}: {
  department: DepartmentRow;
  staff: { id: string; name: string; departmentName: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [hodId, setHodId] = useState(department.hodId ?? "");
  const [busy, setBusy] = useState(false);

  // Staff already in the department first — an HOD from outside it is
  // possible but unusual, so the common case leads.
  const sorted = useMemo(() => {
    const inDept = staff.filter((s) => s.departmentName === department.code);
    const outside = staff.filter((s) => s.departmentName !== department.code);
    return { inDept, outside };
  }, [staff, department.code]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // TODO(Dev-A): PATCH /api/v1/departments/:id { hod_id } — also writes the
    // HOD grant into `role_assignments` scoped to this department (§5.6),
    // and revokes the previous holder's.
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    onDone(
      hodId
        ? `PATCH /departments/${department.id} { hod_id: "${hodId}" } — API not connected yet (Dev-A, C-IA-02).`
        : `PATCH /departments/${department.id} { hod_id: null } — API not connected yet (Dev-A, C-IA-02).`,
    );
  }

  return (
    <StructureDialog
      titleId="hod-title"
      title={`Head of ${department.name}`}
      description="Assigning an HOD grants them the HOD role scoped to this department. The previous holder's grant is revoked."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="hod-select" label="Head of department">
          <select
            id="hod-select"
            value={hodId}
            onChange={(e) => setHodId(e.target.value)}
            className={structureInput()}
          >
            <option value="">Vacant — nobody assigned</option>
            {sorted.inDept.length > 0 && (
              <optgroup label={`In ${department.code}`}>
                {sorted.inDept.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {sorted.outside.length > 0 && (
              <optgroup label="Other departments">
                {sorted.outside.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.departmentName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        <div className="flex flex-wrap justify-end gap-2">
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
            Save
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
