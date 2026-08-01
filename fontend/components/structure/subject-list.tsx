"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2, UserPlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SUBJECT_TYPE_LABELS,
  SUBJECT_TYPE_TONE,
  subjectRoleLabel,
  validateMarks,
  validateSubjectCode,
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
  StructureChip,
  StructureDialog,
  ReadOnlyNote,
  StructureHeader,
  structureInput,
  VacantLabel,
} from "./structure-bits";
import type {
  ClassRow,
  DepartmentRow,
  SubjectRow,
  SubjectType,
} from "@/types/structure";

/**
 * C-IA-07 — Subject Management.
 * "All subjects by class. Assign teachers."
 *
 * Grouped **by class**, as the description says, rather than a flat table —
 * a subject only means anything inside its class, and `subjects.code` is only
 * unique per class (§6.4), so two rows reading "CS301" in a flat list would
 * look like a duplicate when they are not.
 *
 * "Assign teachers" is the second sentence and gets its own dialog, because
 * `teacher_subjects` (§6.5) is a separate table with its own `role_in_subject`
 * — a subject can carry a teacher, a co-teacher and a lab assistant at once,
 * which a single "teacher" dropdown on the edit form could not express.
 */
export function SubjectList({
  subjects,
  classes,
  departments,
  staff,
  canEdit,
}: {
  subjects: SubjectRow[];
  classes: ClassRow[];
  departments: DepartmentRow[];
  staff: { id: string; name: string; departmentName: string }[];
  /** §4.3: Principal / VP read the structure, they don't edit it. */
  canEdit: boolean;
}) {
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(
    params.get("department") ?? "ALL",
  );
  const [classId, setClassId] = useState(params.get("class") ?? "ALL");
  const [type, setType] = useState("ALL");
  const [staffing, setStaffing] = useState("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const [assigning, setAssigning] = useState<SubjectRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      if (department !== "ALL" && s.departmentId !== department) return false;
      if (classId !== "ALL" && s.classId !== classId) return false;
      if (type !== "ALL" && s.subjectType !== type) return false;
      if (staffing === "UNSTAFFED" && s.teachers.length > 0) return false;
      if (staffing === "STAFFED" && s.teachers.length === 0) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        s.teachers.some((t) => t.teacherName.toLowerCase().includes(q))
      );
    });
  }, [subjects, query, department, classId, type, staffing]);

  /** Grouped by class, in the class list's own order. */
  const grouped = useMemo(() => {
    const byClass = new Map<string, SubjectRow[]>();
    for (const s of shown) {
      byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s]);
    }
    return classes
      .filter((c) => byClass.has(c.id))
      .map((c) => ({ klass: c, items: byClass.get(c.id)! }));
  }, [shown, classes]);

  const unstaffed = subjects.filter((s) => s.teachers.length === 0).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Subjects"
        description="Every subject taught, grouped by the class it belongs to."
        action={
          canEdit ? (
            <CreateButton label="New subject" onClick={() => setCreating(true)} />
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

      {unstaffed > 0 && (
        <FormAlert variant="error" className="mb-4">
          {unstaffed} {unstaffed === 1 ? "subject has" : "subjects have"} no
          teacher assigned. Attendance and marks cannot be recorded against
          them until somebody owns them.
        </FormAlert>
      )}

      <StructureCard>
        <SearchBox
          id="subject-search"
          label="Search subjects"
          value={query}
          onChange={setQuery}
          placeholder="Search by code, name, class or teacher…"
        />

        <FilterBar>
          <FilterSelect
            id="subject-dept"
            label="Filter by department"
            value={department}
            onChange={setDepartment}
            allLabel="All departments"
            options={departments.map((d) => [d.id, d.code])}
          />
          <FilterSelect
            id="subject-class"
            label="Filter by class"
            value={classId}
            onChange={setClassId}
            allLabel="All classes"
            options={classes.map((c) => [c.id, `${c.name} · ${c.departmentCode}`])}
          />
          <FilterSelect
            id="subject-type"
            label="Filter by type"
            value={type}
            onChange={setType}
            allLabel="Any type"
            options={(
              ["THEORY", "PRACTICAL", "ELECTIVE", "PROJECT"] as SubjectType[]
            ).map((t) => [t, SUBJECT_TYPE_LABELS[t]])}
          />
          <FilterSelect
            id="subject-staffing"
            label="Filter by staffing"
            value={staffing}
            onChange={setStaffing}
            allLabel="Any staffing"
            options={[
              ["UNSTAFFED", "No teacher"],
              ["STAFFED", "Teacher assigned"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="subject" />

        {grouped.length === 0 ? (
          <EmptyState message="No subjects match these filters." />
        ) : (
          <div className="min-w-0 space-y-5">
            {grouped.map(({ klass, items }) => (
              <section key={klass.id} className="min-w-0">
                <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b border-border pb-1.5">
                  <h2 className="min-w-0 text-[13px] font-semibold text-foreground">
                    <Link
                      href={`/classes/${klass.id}`}
                      className="rounded transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      {klass.name}
                    </Link>
                    <span className="ml-2 font-normal text-muted-foreground">
                      {klass.departmentCode} · {klass.academicYearName}
                    </span>
                  </h2>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {items.length} {items.length === 1 ? "subject" : "subjects"}
                  </span>
                </div>

                <ul className="min-w-0 divide-y divide-border">
                  {items.map((s) => (
                    <li key={s.id} className="min-w-0 py-2.5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="shrink-0 font-mono text-[12px] font-semibold text-foreground">
                              {s.code}
                            </span>
                            <span className="min-w-0 truncate text-[13px] text-foreground">
                              {s.name}
                            </span>
                            <StructureChip tone={SUBJECT_TYPE_TONE[s.subjectType]}>
                              {SUBJECT_TYPE_LABELS[s.subjectType]}
                            </StructureChip>
                          </p>
                          <p className="mt-0.5 min-w-0 text-[11px] text-muted-foreground">
                            {s.credits !== null && `${s.credits} credits · `}
                            {s.maxMarks} marks, pass at {s.passingMarks}
                          </p>
                          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                            {s.teachers.length === 0 ? (
                              <span className="text-[11px]">
                                <VacantLabel>No teacher assigned</VacantLabel>
                              </span>
                            ) : (
                              s.teachers.map((t) => (
                                <span
                                  key={`${t.teacherId}-${t.roleInSubject}`}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-[#475569]"
                                >
                                  {t.teacherName}
                                  <span className="opacity-70">
                                    {subjectRoleLabel(t.roleInSubject)}
                                  </span>
                                </span>
                              ))
                            )}
                          </p>
                        </div>

                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-1">
                            <IconAction
                              label={`Assign teachers to ${s.code} ${s.name}`}
                              onClick={() => setAssigning(s)}
                            >
                              <UserPlus className="h-4 w-4" aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label={`Edit ${s.code} ${s.name}`}
                              onClick={() => setEditing(s)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label={`Delete ${s.code} ${s.name}`}
                              onClick={() => setDeleting(s)}
                              danger
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </IconAction>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </StructureCard>

      {(creating || editing) && (
        <SubjectForm
          subject={editing}
          subjects={subjects}
          classes={classes}
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
        <AssignTeachersDialog
          subject={assigning}
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
          entity="subject"
          name={`${deleting.code} ${deleting.name}`}
          blockedReason={null}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const label = `${deleting.code} ${deleting.name}`;
            setDeleting(null);
            setNotice(
              `DELETE /subjects/${deleting.id} — API not connected yet (Dev-A, C-IA-07). ${label} would be removed.`,
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

function SubjectForm({
  subject,
  subjects,
  classes,
  onClose,
  onDone,
}: {
  subject: SubjectRow | null;
  subjects: SubjectRow[];
  classes: ClassRow[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(subject?.name ?? "");
  const [code, setCode] = useState(subject?.code ?? "");
  const [classId, setClassId] = useState(subject?.classId ?? classes[0]?.id ?? "");
  const [subjectType, setSubjectType] = useState<SubjectType>(
    subject?.subjectType ?? "THEORY",
  );
  const [credits, setCredits] = useState(
    subject?.credits === null || subject?.credits === undefined
      ? ""
      : String(subject.credits),
  );
  const [maxMarks, setMaxMarks] = useState(String(subject?.maxMarks ?? 100));
  const [passingMarks, setPassingMarks] = useState(
    String(subject?.passingMarks ?? 35),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const editing = subject !== null;

  // UNIQUE (tenant_id, class_id, code) — scoped to the class, so the same
  // code in a different class is legal and must not be rejected.
  const siblings = useMemo(
    () =>
      subjects
        .filter((s) => s.classId === classId)
        .map((s) => ({ code: s.code, id: s.id })),
    [subjects, classId],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter the subject name";

    const codeError = validateSubjectCode(code, siblings, subject?.id);
    if (codeError) next.code = codeError;

    const marksError = validateMarks(Number(maxMarks), Number(passingMarks));
    if (marksError) next.marks = marksError;

    if (credits.trim() !== "") {
      const c = Number(credits);
      if (!Number.isFinite(c) || c < 0) next.credits = "Credits cannot be negative";
      else if (c > 20) next.credits = "That looks too high";
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    // TODO(Dev-A): POST/PATCH /api/v1/subjects — writes `subjects` (§6.4).
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      editing
        ? `PATCH /subjects/${subject.id} { code: "${code.toUpperCase()}" } — API not connected yet (Dev-A, C-IA-07).`
        : `POST /subjects { code: "${code.toUpperCase()}", name: "${name}", class_id: "${classId}", subject_type: "${subjectType}" } — API not connected yet (Dev-A, C-IA-07).`,
    );
  }

  return (
    <StructureDialog
      titleId="subject-form-title"
      title={editing ? `Edit ${subject.code}` : "New subject"}
      description="The code has to be unique within its class — the same code in another class is fine."
      onClose={onClose}
      wide
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="subj-name" label="Subject name" error={errors.name}>
            <input
              id="subj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Data Structures"
              className={structureInput(!!errors.name)}
            />
          </Field>

          <Field id="subj-code" label="Code" error={errors.code}>
            <input
              id="subj-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CS201"
              className={cn(structureInput(!!errors.code), "font-mono")}
            />
          </Field>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id="subj-class" label="Class">
            <select
              id="subj-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={structureInput()}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.departmentCode} · {c.academicYearName}
                </option>
              ))}
            </select>
          </Field>

          <Field id="subj-type" label="Type">
            <select
              id="subj-type"
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value as SubjectType)}
              className={structureInput()}
            >
              {(
                ["THEORY", "PRACTICAL", "ELECTIVE", "PROJECT"] as SubjectType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {SUBJECT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          <Field
            id="subj-credits"
            label="Credits"
            optional
            error={errors.credits}
            hint="Colleges only."
          >
            <input
              id="subj-credits"
              type="number"
              inputMode="numeric"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="4"
              className={structureInput(!!errors.credits)}
            />
          </Field>

          <Field id="subj-max" label="Maximum marks">
            <input
              id="subj-max"
              type="number"
              inputMode="numeric"
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
              className={structureInput(!!errors.marks)}
            />
          </Field>

          <Field id="subj-pass" label="Passing marks" error={errors.marks}>
            <input
              id="subj-pass"
              type="number"
              inputMode="numeric"
              value={passingMarks}
              onChange={(e) => setPassingMarks(e.target.value)}
              className={structureInput(!!errors.marks)}
            />
          </Field>
        </div>

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
            {editing ? "Save changes" : "Create subject"}
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}

/* ── Assign teachers (§6.5) ─────────────────────────────────────────────── */

/**
 * `teacher_subjects` is a join table with `role_in_subject`, unique on
 * `(teacher_id, subject_id, role_in_subject)` — so a subject legitimately
 * carries several people, and the same person can hold two roles on it.
 * The dialog therefore edits a *list*, not a single dropdown.
 */
function AssignTeachersDialog({
  subject,
  staff,
  onClose,
  onDone,
}: {
  subject: SubjectRow;
  staff: { id: string; name: string; departmentName: string }[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rows, setRows] = useState(
    subject.teachers.map((t) => ({
      teacherId: t.teacherId,
      roleInSubject: t.roleInSubject,
    })),
  );
  const [pickTeacher, setPickTeacher] = useState("");
  const [pickRole, setPickRole] = useState("TEACHER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  function add() {
    if (!pickTeacher) {
      setError("Choose someone to assign.");
      return;
    }
    // Mirrors the UNIQUE constraint rather than letting the API reject it
    if (
      rows.some(
        (r) => r.teacherId === pickTeacher && r.roleInSubject === pickRole,
      )
    ) {
      setError(
        `${nameOf(pickTeacher)} already holds ${subjectRoleLabel(pickRole).toLowerCase()} on this subject.`,
      );
      return;
    }
    setError(null);
    setRows([...rows, { teacherId: pickTeacher, roleInSubject: pickRole }]);
    setPickTeacher("");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    // TODO(Dev-A): POST/DELETE /api/v1/subjects/:id/teachers — reconciles
    // `teacher_subjects` (§6.5) against this list.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `PUT /subjects/${subject.id}/teachers — ${rows.length} assignment${rows.length === 1 ? "" : "s"}, API not connected yet (Dev-A, C-IA-07).`,
    );
  }

  return (
    <StructureDialog
      titleId="assign-teachers-title"
      title={`Teachers for ${subject.code}`}
      description={`${subject.name} · ${subject.className}. A subject can carry a teacher, a co-teacher and a lab assistant at once.`}
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <EmptyState message="Nobody is assigned to this subject yet." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-y border-border">
          {rows.map((r, i) => (
            <li
              key={`${r.teacherId}-${r.roleInSubject}`}
              className="flex min-w-0 items-center gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {nameOf(r.teacherId)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {subjectRoleLabel(r.roleInSubject)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${nameOf(r.teacherId)} as ${subjectRoleLabel(r.roleInSubject).toLowerCase()}`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[1fr,auto,auto] sm:items-end">
        <Field id="assign-teacher" label="Add teacher">
          <select
            id="assign-teacher"
            value={pickTeacher}
            onChange={(e) => setPickTeacher(e.target.value)}
            className={structureInput()}
          >
            <option value="">Choose someone…</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.departmentName}
              </option>
            ))}
          </select>
        </Field>

        <Field id="assign-role" label="Role">
          <select
            id="assign-role"
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value)}
            className={structureInput()}
          >
            <option value="TEACHER">Teacher</option>
            <option value="CO_TEACHER">Co-teacher</option>
            <option value="LAB_ASSISTANT">Lab assistant</option>
          </select>
        </Field>

        <button
          type="button"
          onClick={add}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-field border border-border px-4 text-[13px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>

      {error && (
        <FormAlert variant="error" className="mt-3">
          {error}
        </FormAlert>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center rounded-field border border-border px-4 text-[14px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          Cancel
        </button>
        <Button
          type="button"
          loading={busy}
          loadingText="Saving…"
          onClick={save}
          className="w-auto px-5"
        >
          Save assignments
        </Button>
      </div>
    </StructureDialog>
  );
}
