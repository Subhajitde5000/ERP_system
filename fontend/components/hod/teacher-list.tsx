"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, TriangleAlert, UserPlus, X } from "lucide-react";

import { formatDate } from "@/lib/utils";
import { subjectRoleLabel } from "@/lib/structure";
import { roleChip } from "@/lib/roles";
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
  Field,
  StructureCard,
  StructureChip,
  StructureDialog,
  ReadOnlyNote,
  StructureHeader,
  structureInput,
  VacantLabel,
} from "@/components/structure/structure-bits";
import type { DepartmentTeacher, TeacherListBoard } from "@/types/mentor";

/**
 * C-HD-07 — Teacher List.
 * "Teachers in own dept — assign to subjects"
 *
 * §4.4 gives the HOD "Teachers: View, **assign subjects**", scoped to their
 * own department. The assignment half is what makes this more than a
 * filtered `/users`: an HOD deciding who takes an unstaffed subject needs to
 * see who has room, so every row leads with its teaching load.
 *
 * The load is two numbers because `teacher_subjects` (§6.5) allows several
 * rows per person — "3 subjects, 3 as lead" and "3 subjects, 1 as lead" are
 * very different workloads and a single count would hide it.
 */
export function TeacherList({
  board,
  canEdit,
}: {
  board: TeacherListBoard;
  /**
   * §4.3 admits the Principal and Vice Principal to look, not to staff
   * subjects. Decided on the server by `HodPage`.
   */
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [load, setLoad] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [assigning, setAssigning] = useState<DepartmentTeacher | null>(null);
  const [staffingSubject, setStaffingSubject] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.teachers.filter((t) => {
      if (load === "UNLOADED" && t.totalCount > 0) return false;
      if (load === "HEAVY" && t.totalCount < 3) return false;
      if (role === "MENTOR" && !t.roles.includes("MENTOR")) return false;
      if (role === "VISITING" && t.employmentType !== "VISITING") return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.employeeCode.toLowerCase().includes(q) ||
        t.designation.toLowerCase().includes(q) ||
        t.subjects.some(
          (s) =>
            s.code.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q),
        )
      );
    });
  }, [board.teachers, query, load, role]);

  const unloaded = board.teachers.filter((t) => t.totalCount === 0).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Teachers"
        description={`Teaching staff in ${board.departmentCode}, and the subjects they carry.`}
        action={canEdit ? undefined : <ReadOnlyNote />}
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {/* The queue this page clears: a subject nobody owns cannot take
          attendance or marks. */}
      {board.unstaffed.length > 0 && (
        <StructureCard className="mb-4">
          <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <TriangleAlert
              className="h-4 w-4 shrink-0 text-[#B45309]"
              aria-hidden="true"
            />
            {board.unstaffed.length}{" "}
            {board.unstaffed.length === 1 ? "subject has" : "subjects have"} no
            teacher
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
            Attendance and marks cannot be recorded against them until somebody
            owns them.
          </p>
          <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            {board.unstaffed.map((s) =>
              canEdit ? (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStaffingSubject(s.id)}
                    className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-[#B45309] transition-colors hover:bg-[#FDE68A] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <span className="shrink-0 font-mono">{s.code}</span>
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className="shrink-0 opacity-80">· {s.className}</span>
                  </button>
                </li>
              ) : (
                <li
                  key={s.id}
                  className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-[#B45309]"
                >
                  <span className="shrink-0 font-mono">{s.code}</span>
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span className="shrink-0 opacity-80">· {s.className}</span>
                </li>
              ),
            )}
          </ul>
        </StructureCard>
      )}

      <StructureCard>
        <SearchBox
          id="teacher-search"
          label="Search teachers"
          value={query}
          onChange={setQuery}
          placeholder="Search by name, employee code, designation or subject…"
        />

        <FilterBar>
          <FilterSelect
            id="teacher-load"
            label="Filter by load"
            value={load}
            onChange={setLoad}
            allLabel="Any load"
            options={[
              ["UNLOADED", "No subjects"],
              ["HEAVY", "3 or more"],
            ]}
          />
          <FilterSelect
            id="teacher-role"
            label="Filter by role"
            value={role}
            onChange={setRole}
            allLabel="Any role"
            options={[
              ["MENTOR", "Mentors"],
              ["VISITING", "Visiting faculty"],
            ]}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="teacher" />

        {shown.length === 0 ? (
          <EmptyState message="No teachers match these filters." />
        ) : (
          <ul className="min-w-0 space-y-3">
            {shown.map((t) => (
              <TeacherCard
                key={t.id}
                teacher={t}
                canEdit={canEdit}
                onAssign={() => setAssigning(t)}
              />
            ))}
          </ul>
        )}
      </StructureCard>

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {board.totalSubjects} subjects across {board.teachers.length} teachers —{" "}
        {board.averageLoad} each on average.
        {unloaded > 0 && (
          <span className="font-medium text-[#B45309]">
            {" "}
            {unloaded} carrying nothing.
          </span>
        )}
      </p>

      {assigning && (
        <AssignSubjectsDialog
          teacher={assigning}
          subjects={board.subjects}
          onClose={() => setAssigning(null)}
          onDone={(message) => {
            setAssigning(null);
            setNotice(message);
          }}
        />
      )}

      {staffingSubject && (
        <StaffSubjectDialog
          subject={board.subjects.find((s) => s.id === staffingSubject)!}
          teachers={board.teachers}
          onClose={() => setStaffingSubject(null)}
          onDone={(message) => {
            setStaffingSubject(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

/** One teacher, led by their load. */
function TeacherCard({
  teacher,
  canEdit,
  onAssign,
}: {
  teacher: DepartmentTeacher;
  canEdit: boolean;
  onAssign: () => void;
}) {
  return (
    <li className="min-w-0 rounded-field border border-border p-4">
      {/* `flex-wrap` alone did not save the name: the button is `shrink-0`
          and sits on the same line, so the identity column was squeezed to
          59px and "Arun Kumar" rendered as "A.". Stack below `sm`, and only
          put the button beside the name once there is room for both. */}
      <div className="flex min-w-0 flex-col items-start gap-x-3 gap-y-2 sm:flex-row sm:justify-between">
        <div className="flex w-full min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-light text-[13px] font-semibold text-accent"
            aria-hidden="true"
          >
            {teacher.name.charAt(0)}
          </span>
          <div className="min-w-0">
            {/* The name gets its own line and the chips wrap under it.
                Sharing one `flex-wrap` row meant the truncating name competed
                with `shrink-0` chips for space and collapsed to "A." at
                320px — the chips won because they cannot shrink. */}
            <Link
              href={`/staff/${teacher.id}`}
              className="block min-w-0 truncate rounded text-[14px] font-semibold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {teacher.name}
            </Link>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              {teacher.roles.map((r) => (
                <StructureChip
                  key={r}
                  tone={r === "MENTOR" ? "cyan" : r === "HOD" ? "accent" : "muted"}
                >
                  {roleChip(r)}
                </StructureChip>
              ))}
              {!teacher.isActive && (
                <StructureChip tone="danger">Deactivated</StructureChip>
              )}
            </p>
            <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
              <span className="font-mono">{teacher.employeeCode}</span> ·{" "}
              {teacher.designation} ·{" "}
              {teacher.employmentType.replace("_", " ").toLowerCase()} · since{" "}
              {formatDate(teacher.dateOfJoining)}
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onAssign}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Assign subjects
            <span className="sr-only"> to {teacher.name}</span>
          </button>
        )}
      </div>

      {/* Load first — it is what the assign decision turns on */}
      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 sm:grid-cols-4">
        <Metric label="Subjects" value={String(teacher.totalCount)} />
        <Metric label="As lead" value={String(teacher.primaryCount)} />
        <Metric label="Classes" value={String(teacher.classCount)} />
        <Metric
          label="Mentees"
          value={
            teacher.roles.includes("MENTOR") ? String(teacher.menteeCount) : "—"
          }
        />
      </dl>

      <div className="mt-3 min-w-0 border-t border-border pt-3">
        {teacher.subjects.length === 0 ? (
          <p className="text-[12px]">
            <VacantLabel>No subjects assigned</VacantLabel>
          </p>
        ) : (
          // `max-w-full` on each chip, not just `min-w-0` on the list: a
          // `shrink-0` chip in a wrapping flex is sized by its content, so a
          // long subject name pushed past 320px. Capping the chip lets the
          // name inside it truncate instead.
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {teacher.subjects.map((s) => (
              <li
                key={`${s.subjectId}-${s.roleInSubject}`}
                className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-[#475569]"
              >
                <span className="shrink-0 font-mono font-semibold">
                  {s.code}
                </span>
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="shrink-0 opacity-70">{s.className}</span>
                {s.roleInSubject !== "TEACHER" && (
                  <span className="shrink-0 rounded-full bg-white px-1.5 text-[10px] font-medium">
                    {subjectRoleLabel(s.roleInSubject)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/* ── Assign subjects to a teacher (§6.5) ────────────────────────────────── */

/**
 * Edits `teacher_subjects` from the teacher's side.
 *
 * The unique key is `(teacher_id, subject_id, role_in_subject)`, so the same
 * person may hold two roles on one subject — the dialog mirrors that rather
 * than letting the API reject it.
 */
function AssignSubjectsDialog({
  teacher,
  subjects,
  onClose,
  onDone,
}: {
  teacher: DepartmentTeacher;
  subjects: TeacherListBoard["subjects"];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rows, setRows] = useState(
    teacher.subjects.map((s) => ({
      subjectId: s.subjectId,
      roleInSubject: s.roleInSubject,
    })),
  );
  const [pickSubject, setPickSubject] = useState("");
  const [pickRole, setPickRole] = useState("TEACHER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const labelOf = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    return s ? `${s.code} ${s.name} · ${s.className}` : id;
  };

  function add() {
    if (!pickSubject) {
      setError("Choose a subject to assign.");
      return;
    }
    if (
      rows.some(
        (r) => r.subjectId === pickSubject && r.roleInSubject === pickRole,
      )
    ) {
      setError(
        `${teacher.name} already holds ${subjectRoleLabel(pickRole).toLowerCase()} on ${labelOf(pickSubject)}.`,
      );
      return;
    }
    setError(null);
    setRows([...rows, { subjectId: pickSubject, roleInSubject: pickRole }]);
    setPickSubject("");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    // TODO(Dev-A): POST/DELETE /api/v1/subjects/:id/teachers — reconciles
    // `teacher_subjects` (§6.5) against this list for one teacher.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `PUT /teachers/${teacher.id}/subjects — ${rows.length} assignment${rows.length === 1 ? "" : "s"}, API not connected yet (Dev-A, C-HD-07).`,
    );
  }

  return (
    <StructureDialog
      titleId="assign-subjects-title"
      title={`Subjects for ${teacher.name}`}
      description={`${teacher.designation}. A teacher can hold several subjects, and two roles on the same one.`}
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <EmptyState message="No subjects assigned to this teacher yet." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-y border-border">
          {rows.map((r, i) => (
            <li
              key={`${r.subjectId}-${r.roleInSubject}`}
              className="flex min-w-0 items-center gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {labelOf(r.subjectId)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {subjectRoleLabel(r.roleInSubject)}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${labelOf(r.subjectId)} as ${subjectRoleLabel(r.roleInSubject).toLowerCase()}`}
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
        <Field id="assign-subject" label="Add subject">
          <select
            id="assign-subject"
            value={pickSubject}
            onChange={(e) => setPickSubject(e.target.value)}
            className={structureInput()}
          >
            <option value="">Choose a subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.name} · {s.className}
                {s.teachers.length === 0 ? " (unstaffed)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field id="assign-subject-role" label="Role">
          <select
            id="assign-subject-role"
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

/* ── Staff one unassigned subject ───────────────────────────────────────── */

/**
 * The same write from the *subject's* side.
 *
 * Reached by clicking an unstaffed subject in the banner: an HOD clearing
 * that queue is thinking "who takes CS309?", not "what else does Arun
 * teach?". Same endpoint, one field.
 */
function StaffSubjectDialog({
  subject,
  teachers,
  onClose,
  onDone,
}: {
  subject: TeacherListBoard["subjects"][number];
  teachers: DepartmentTeacher[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [roleInSubject, setRoleInSubject] = useState("TEACHER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Lightest load first — the HOD is looking for who has room
  const byLoad = [...teachers]
    .filter((t) => t.isActive)
    .sort((a, b) => a.totalCount - b.totalCount);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!teacherId) {
      setError("Choose a teacher.");
      return;
    }
    setError(null);
    setBusy(true);
    // TODO(Dev-A): POST /api/v1/subjects/:id/teachers (§6.5)
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `POST /subjects/${subject.id}/teachers { teacher_id: "${teacherId}", role_in_subject: "${roleInSubject}" } — API not connected yet (Dev-A, C-HD-07).`,
    );
  }

  return (
    <StructureDialog
      titleId="staff-subject-title"
      title={`Who teaches ${subject.code}?`}
      description={`${subject.name} · ${subject.className}. Teachers are listed lightest-load first.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field id="staff-teacher" label="Teacher">
          <select
            id="staff-teacher"
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setError(null);
            }}
            className={structureInput(!!error)}
          >
            <option value="">Choose a teacher…</option>
            {byLoad.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.totalCount}{" "}
                {t.totalCount === 1 ? "subject" : "subjects"}
              </option>
            ))}
          </select>
        </Field>

        <Field id="staff-role" label="Role">
          <select
            id="staff-role"
            value={roleInSubject}
            onChange={(e) => setRoleInSubject(e.target.value)}
            className={structureInput()}
          >
            <option value="TEACHER">Teacher</option>
            <option value="CO_TEACHER">Co-teacher</option>
            <option value="LAB_ASSISTANT">Lab assistant</option>
          </select>
        </Field>

        {error && <FormAlert variant="error">{error}</FormAlert>}

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
            loadingText="Assigning…"
            className="w-auto px-5"
          >
            Assign
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
