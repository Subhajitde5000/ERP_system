"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, TriangleAlert, UserMinus, UserPlus, Users } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { FormAlert } from "@/components/auth/form-alert";
import { EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "@/components/structure/structure-bits";
import type { MentorBoard as Board, MentorGroup } from "@/types/mentor";

/**
 * C-HD-08 — Mentor Assignments.
 * "Assign students to mentors (if Mentor role enabled)"
 *
 * §4.4 gives the HOD "Mentors: Assign students to mentors", scoped to their
 * own department.
 *
 * The parenthetical is a real gate, but not a module one — MENTOR is an
 * optional *role* (§4.5), not one of the 16 module keys, so "enabled" means
 * somebody in the department holds the grant. When nobody does, the page
 * explains that and names who could take it, rather than rendering an empty
 * board the HOD can't act on.
 *
 * Attendance travels with every mentee because that is what the role is for
 * (§4.5: "View mentee attendance"). An HOD balancing groups by headcount
 * alone would happily put both at-risk students on one mentor.
 */
export function MentorBoardView({
  board,
  canEdit,
}: {
  board: Board;
  /** §4.3: Principal / VP read the groups; assigning is the HOD's. */
  canEdit: boolean;
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{
    mentorId: string;
    mentorName: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const totalAtRisk = board.groups.reduce((a, g) => a + g.atRiskCount, 0);
  const unassignedAtRisk = board.unassigned.filter(
    (u) => u.attendancePct < board.attendanceThreshold,
  ).length;

  /* ── "if Mentor role enabled" ─────────────────────────────────────────── */
  if (!board.mentorRoleInUse) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <StructureHeader
          title="Mentors"
          description={`Mentee groups in ${board.departmentCode}.`}
        />

        <div className="mb-4 flex min-w-0 items-start gap-2.5 rounded-field border border-accent-border bg-accent-light px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 text-[12px] leading-6 text-[#3730A3]">
            <p className="font-semibold">
              Nobody in {board.departmentCode} holds the Mentor role.
            </p>
            <p>
              Mentor is an optional role, not a module — assigning it to a
              teacher is what switches this page on. An Institution Admin
              grants it from the staff record.
            </p>
          </div>
        </div>

        {board.eligibleTeachers.length > 0 && (
          <StructureCard>
            <h2 className="mb-1 font-display text-[15px] font-bold text-foreground">
              Teachers who could mentor
            </h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Any teaching staff member in the department can take the grant.
            </p>
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {board.eligibleTeachers.map((t) => (
                <li key={t.id} className="flex min-w-0 items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/staff/${t.id}`}
                      className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      {t.name}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.designation}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </StructureCard>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Mentors"
        description={`Mentee groups in ${board.departmentCode}. Every student should have exactly one mentor.`}
        action={canEdit ? undefined : <ReadOnlyNote />}
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      <div className="mb-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Mentors" value={String(board.groups.length)} hint="holding the role" />
        <Kpi
          label="Mentored"
          value={`${board.assignedCount}/${board.totalStudents}`}
          hint="students with a mentor"
          tone={board.assignedCount < board.totalStudents ? "warning" : "success"}
        />
        <Kpi
          label="Unassigned"
          value={String(board.unassigned.length)}
          hint="nobody is watching them"
          tone={board.unassigned.length > 0 ? "warning" : "success"}
        />
        <Kpi
          label="At risk"
          value={String(totalAtRisk + unassignedAtRisk)}
          hint={`below ${board.attendanceThreshold}% attendance`}
          tone={totalAtRisk + unassignedAtRisk > 0 ? "danger" : "success"}
        />
      </div>

      {/* The queue this page clears */}
      {board.unassigned.length > 0 && (
        <StructureCard className="mb-4">
          <div className="mb-2 flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
                <TriangleAlert
                  className="h-4 w-4 shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
                {board.unassigned.length} without a mentor
              </h2>
              <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
                Nobody is tracking their attendance or results. Lowest
                attendance first — place those before the rest.
              </p>
            </div>
          </div>

          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {board.unassigned.map((u) => {
              const atRisk = u.attendancePct < board.attendanceThreshold;
              return (
                <li key={u.studentId} className="flex min-w-0 items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {/* The chip drops below the name under `sm`. Sharing one
                        row, the `shrink-0` chip cannot give way, so at 320px
                        it clipped "Kiran Patel" to 40px — and a name is the
                        one thing on this row that must stay readable. */}
                    <p className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <Link
                        href={`/students/${u.studentId}`}
                        className="w-full min-w-0 truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 sm:w-auto"
                      >
                        {u.studentName}
                      </Link>
                      {atRisk && (
                        <StructureChip tone="danger">At risk</StructureChip>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{u.rollNo}</span> ·{" "}
                      {u.className}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-semibold tabular-nums",
                      atRisk ? "text-destructive-text" : "text-muted-foreground",
                    )}
                  >
                    {u.attendancePct}%
                  </span>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setAssigning(u.studentId)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      Assign
                      <span className="sr-only"> a mentor to {u.studentName}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </StructureCard>
      )}

      {board.unassigned.length === 0 && (
        <FormAlert variant="success" className="mb-4">
          Every student in {board.departmentCode} has a mentor.
        </FormAlert>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {board.groups.map((g) => (
          <MentorGroupCard
            key={g.mentorId}
            group={g}
            canEdit={canEdit}
            threshold={board.attendanceThreshold}
            onRemove={(studentId, studentName) =>
              setRemoving({
                mentorId: g.mentorId,
                mentorName: g.mentorName,
                studentId,
                studentName,
              })
            }
          />
        ))}
      </div>

      <p className="mt-4 flex min-w-0 items-start gap-1.5 text-[12px] text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        A student has one mentor; a mentor carries many. Reassigning moves the
        student — it never leaves them with two.
      </p>

      {assigning && (
        <AssignMentorDialog
          student={board.unassigned.find((u) => u.studentId === assigning)!}
          groups={board.groups}
          threshold={board.attendanceThreshold}
          onClose={() => setAssigning(null)}
          onDone={(message) => {
            setAssigning(null);
            setNotice(message);
          }}
        />
      )}

      {removing && (
        <StructureDialog
          titleId="remove-mentee-title"
          title={`Remove ${removing.studentName} from ${removing.mentorName}?`}
          onClose={() => setRemoving(null)}
        >
          <p className="text-[13px] leading-6 text-muted-foreground">
            {removing.studentName} goes back to the unassigned list until
            another mentor takes them. Their attendance and results are
            unaffected — only who watches them changes.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setRemoving(null)}
              className="inline-flex h-10 items-center rounded-field border border-border px-4 text-[13px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={() => {
                const label = removing.studentName;
                setRemoving(null);
                setNotice(
                  `DELETE /mentor-assignments (student: ${removing.studentId}) — API not connected yet (Dev-A, C-HD-08). ${label} would be unassigned.`,
                );
              }}
              className="h-10 w-auto bg-destructive px-4 text-[13px] shadow-none hover:bg-[#DC2626]"
            >
              Remove
            </Button>
          </div>
        </StructureDialog>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "accent" | "warning" | "danger" | "success";
}) {
  return (
    <StructureCard className="!p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-bold tabular-nums",
          tone === "accent"
            ? "text-foreground"
            : tone === "warning"
              ? "text-[#B45309]"
              : tone === "danger"
                ? "text-destructive-text"
                : "text-success-text",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </StructureCard>
  );
}

function MentorGroupCard({
  group,
  canEdit,
  threshold,
  onRemove,
}: {
  group: MentorGroup;
  canEdit: boolean;
  threshold: number;
  onRemove: (studentId: string, studentName: string) => void;
}) {
  return (
    <StructureCard>
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="flex min-w-0 flex-wrap items-center gap-2">
            <Link
              href={`/staff/${group.mentorId}`}
              className="min-w-0 truncate rounded font-display text-[15px] font-bold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              {group.mentorName}
            </Link>
            {group.atRiskCount > 0 && (
              <StructureChip tone="danger">
                {group.atRiskCount} at risk
              </StructureChip>
            )}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {group.designation}
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
          {group.menteeCount} {group.menteeCount === 1 ? "mentee" : "mentees"}
        </span>
      </div>

      {group.mentees.length === 0 ? (
        <EmptyState message="No mentees assigned to this mentor yet." />
      ) : (
        <ul className="min-w-0 divide-y divide-border">
          {group.mentees.map((m) => {
            const atRisk = m.attendancePct < threshold;
            return (
              <li key={m.studentId} className="flex min-w-0 items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/students/${m.studentId}`}
                    className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    {m.studentName}
                  </Link>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{m.rollNo}</span> ·{" "}
                    {m.className} · since {formatDate(m.assignedAt)}
                  </p>
                </div>

                <span
                  className={cn(
                    "shrink-0 text-[13px] font-semibold tabular-nums",
                    atRisk ? "text-destructive-text" : "text-muted-foreground",
                  )}
                >
                  {m.attendancePct}%
                </span>

                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.studentName} from ${group.mentorName}`}
                    onClick={() => onRemove(m.studentId, m.studentName)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive-light hover:text-destructive-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </StructureCard>
  );
}

/* ── Assign a mentor ────────────────────────────────────────────────────── */

/**
 * Places one student with one mentor.
 *
 * Each option carries the group's current size and at-risk count, because
 * that is the whole decision: an HOD should not add a third struggling
 * student to the mentor already carrying two.
 */
function AssignMentorDialog({
  student,
  groups,
  threshold,
  onClose,
  onDone,
}: {
  student: Board["unassigned"][number];
  groups: MentorGroup[];
  threshold: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Smallest group first — the default answer to "who has room?"
  const byLoad = useMemo(
    () => [...groups].sort((a, b) => a.menteeCount - b.menteeCount),
    [groups],
  );
  const [mentorId, setMentorId] = useState(byLoad[0]?.mentorId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const picked = groups.find((g) => g.mentorId === mentorId);
  const atRisk = student.attendancePct < threshold;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!mentorId) {
      setError("Choose a mentor.");
      return;
    }
    setError(null);
    setBusy(true);
    // TODO(Dev-A): POST /api/v1/mentor-assignments — the table does not
    // exist yet; see `types/mentor.ts`. UNIQUE (student_id) makes this a
    // move rather than a second row when the student already has a mentor.
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    onDone(
      `POST /mentor-assignments { student_id: "${student.studentId}", mentor_id: "${mentorId}" } — API not connected yet (Dev-A, C-HD-08).`,
    );
  }

  return (
    <StructureDialog
      titleId="assign-mentor-title"
      title={`Assign a mentor to ${student.studentName}`}
      description={`${student.rollNo} · ${student.className} · ${student.attendancePct}% attendance. Groups are listed smallest first.`}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {atRisk && (
          <FormAlert variant="error">
            {student.studentName} is below the {threshold}% attendance
            threshold. Prefer a mentor who is not already carrying several
            at-risk students.
          </FormAlert>
        )}

        <Field id="mentor-select" label="Mentor">
          <select
            id="mentor-select"
            value={mentorId}
            onChange={(e) => {
              setMentorId(e.target.value);
              setError(null);
            }}
            className={structureInput(!!error)}
          >
            {byLoad.map((g) => (
              <option key={g.mentorId} value={g.mentorId}>
                {g.mentorName} — {g.menteeCount}{" "}
                {g.menteeCount === 1 ? "mentee" : "mentees"}
                {g.atRiskCount > 0 ? `, ${g.atRiskCount} at risk` : ""}
              </option>
            ))}
          </select>
        </Field>

        {picked && (
          <div className="min-w-0 rounded-field bg-background px-3.5 py-3">
            <p className="text-[12px] leading-6 text-muted-foreground">
              {picked.mentorName} would carry {picked.menteeCount + 1}{" "}
              {picked.menteeCount + 1 === 1 ? "mentee" : "mentees"}
              {atRisk && (
                <>
                  , {picked.atRiskCount + 1} of them below {threshold}%
                </>
              )}
              .
            </p>
          </div>
        )}

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
            Assign mentor
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
