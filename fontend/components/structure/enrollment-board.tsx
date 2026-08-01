"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRightLeft, TriangleAlert, UserPlus } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONE,
  seatsLeft,
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
  Field,
  ReadOnlyNote,
  StructureCard,
  StructureChip,
  StructureDialog,
  StructureHeader,
  structureInput,
} from "./structure-bits";
import type { EnrollmentBoard as Board, EnrollmentStatus } from "@/types/structure";

/**
 * C-IA-11 — Student Enrollment.
 * "Bulk enroll students into class for academic year"
 *
 * The word that shapes this page is **bulk**: enrolling one student at a time
 * is a detail-page action, and an admin arriving here at the start of term
 * has a cohort to place. So the primary surface is a multi-select of
 * unplaced students with one destination class, and the guard that matters is
 * `max_strength` (§6.3) — selecting 30 students for a class with 12 seats
 * left has to be refused *before* the request, not after a partial write.
 *
 * "For academic year" is the second constraint: `student_enrollments` is keyed
 * on `academic_year_id` (§6.6), so the year is fixed to the current one and
 * shown, never silently assumed.
 */
export function EnrollmentBoardView({
  board,
  canEdit,
}: {
  board: Board;
  /** §4.3: Principal / VP see who is enrolled; placing them is the Admin's. */
  canEdit: boolean;
}) {
  const params = useSearchParams();

  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState(params.get("class") ?? "ALL");
  const [status, setStatus] = useState("ALL");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.enrollments.filter((e) => {
      if (classId !== "ALL" && e.classId !== classId) return false;
      if (status !== "ALL" && e.status !== status) return false;
      if (!q) return true;
      return (
        e.studentName.toLowerCase().includes(q) ||
        (e.rollNumber ?? "").toLowerCase().includes(q) ||
        e.className.toLowerCase().includes(q)
      );
    });
  }, [board.enrollments, query, classId, status]);

  const counts = {
    all: board.enrollments.length,
    active: board.enrollments.filter((e) => e.status === "ACTIVE").length,
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <StructureHeader
        title="Enrolment"
        description={`Placing students into classes for ${board.currentYearName}.`}
        action={
          !canEdit ? (
            <ReadOnlyNote />
          ) : (
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            disabled={board.unassigned.length === 0}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Bulk enrol
          </button>
          )
        }
      />

      {notice && (
        <FormAlert variant="info" className="mb-4">
          {notice}
        </FormAlert>
      )}

      {/* The queue this page exists to clear */}
      {board.unassigned.length > 0 ? (
        <StructureCard className="mb-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex min-w-0 items-center gap-2 font-display text-[15px] font-bold text-foreground">
                <TriangleAlert
                  className="h-4 w-4 shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
                {board.unassigned.length} without a class
              </h2>
              <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
                These students have accounts but no active enrolment in{" "}
                {board.currentYearName}. Attendance, results and the timetable
                have nothing to attach them to until they are placed.
              </p>
              <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                {board.unassigned.map((u) => (
                  <li
                    key={u.studentId}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-medium text-[#B45309]"
                  >
                    {u.studentName}
                    <span className="font-mono opacity-80">{u.rollNo}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </StructureCard>
      ) : (
        <FormAlert variant="success" className="mb-4">
          Every student has an active enrolment for {board.currentYearName}.
        </FormAlert>
      )}

      <StructureCard>
        <SearchBox
          id="enr-search"
          label="Search enrolments"
          value={query}
          onChange={setQuery}
          placeholder="Search by student, roll number or class…"
        />

        <FilterBar>
          <FilterSelect
            id="enr-class"
            label="Filter by class"
            value={classId}
            onChange={setClassId}
            allLabel="All classes"
            options={board.classes.map((c) => [
              c.id,
              `${c.name} · ${c.departmentCode}`,
            ])}
          />
          <FilterSelect
            id="enr-status"
            label="Filter by status"
            value={status}
            onChange={setStatus}
            allLabel="Any status"
            options={(
              ["ACTIVE", "TRANSFERRED", "DROPPED", "COMPLETED"] as EnrollmentStatus[]
            ).map((s) => [s, ENROLLMENT_STATUS_LABELS[s]])}
          />
        </FilterBar>

        <ResultCount count={shown.length} noun="enrolment" />

        {shown.length === 0 ? (
          <EmptyState message="No enrolments match these filters." />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[680px] border-collapse">
              <caption className="sr-only">
                Enrolments for {board.currentYearName} — {shown.length} rows
              </caption>
              <thead>
                <tr className="border-b border-border">
                  {["Roll", "Student", "Class", "Enrolled", "Status"].map(
                    (h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={cn(
                          "py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          i === 0 && "w-24",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 align-top font-mono text-[12px] text-muted-foreground">
                      {e.rollNumber ?? "—"}
                    </td>
                    <th scope="row" className="py-2.5 pr-3 text-left align-top">
                      <Link
                        href={`/students/${e.studentId}`}
                        className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {e.studentName}
                      </Link>
                    </th>
                    <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                      <Link
                        href={`/classes/${e.classId}`}
                        className="rounded transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {e.className}
                      </Link>
                      <span className="block text-[10px]">{e.departmentCode}</span>
                    </td>
                    <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                      {formatDate(e.enrollmentDate)}
                    </td>
                    <td className="py-2.5 align-top">
                      <StructureChip tone={ENROLLMENT_STATUS_TONE[e.status]}>
                        {ENROLLMENT_STATUS_LABELS[e.status]}
                      </StructureChip>
                      {e.transferredToName && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <ArrowRightLeft
                            className="h-3 w-3 shrink-0"
                            aria-hidden="true"
                          />
                          {e.transferredToName}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          {counts.active} active of {counts.all} recorded enrolments in{" "}
          {board.currentYearName}.
        </p>
      </StructureCard>

      {bulkOpen && (
        <BulkEnrolDialog
          board={board}
          onClose={() => setBulkOpen(false)}
          onDone={(message) => {
            setBulkOpen(false);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}

/* ── Bulk enrol ─────────────────────────────────────────────────────────── */

function BulkEnrolDialog({
  board,
  onClose,
  onDone,
}: {
  board: Board;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [classId, setClassId] = useState(board.classes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = board.classes.find((c) => c.id === classId);
  const free = target ? seatsLeft(target.enrolledCount, target.maxStrength) : 0;
  // `max_strength` (§6.3) is a real cap: refuse before the request rather
  // than letting the API half-write the batch.
  const overCapacity = target !== undefined && selected.length > free;

  function toggle(id: string) {
    setError(null);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    if (selected.length === 0) {
      setError("Choose at least one student to enrol.");
      return;
    }
    if (!target) {
      setError("Choose a destination class.");
      return;
    }
    if (overCapacity) {
      setError(
        `${target.name} has ${free} ${free === 1 ? "seat" : "seats"} left — you have selected ${selected.length}.`,
      );
      return;
    }

    setError(null);
    setBusy(true);
    // TODO(Dev-A): POST /api/v1/enrollments (bulk) — writes one
    // `student_enrollments` row per student (§6.6), all against
    // `academic_year_id`. The UNIQUE (student_id, class_id, academic_year_id)
    // makes the operation idempotent per student.
    await new Promise((r) => setTimeout(r, 800));
    setBusy(false);
    onDone(
      `POST /enrollments { class_id: "${classId}", academic_year_id: "${board.currentYearId}", students: [${selected.length}] } — API not connected yet (Dev-A, C-IA-11).`,
    );
  }

  return (
    <StructureDialog
      titleId="bulk-enrol-title"
      title="Bulk enrol students"
      description={`Into ${board.currentYearName}. Only students without an active enrolment this year are listed.`}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset className="min-w-0">
          <legend className="text-[13px] font-medium text-[#334155]">
            Students
            <span className="ml-2 font-normal text-muted-foreground">
              {selected.length} of {board.unassigned.length} selected
            </span>
          </legend>

          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelected(board.unassigned.map((u) => u.studentId))}
              className="rounded-field border border-border px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-field border border-border px-2.5 py-1 text-[11px] font-medium text-[#475569] transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Clear
            </button>
          </div>

          <ul className="mt-2 min-w-0 divide-y divide-border rounded-field border border-border">
            {board.unassigned.map((u) => (
              <li key={u.studentId} className="min-w-0">
                {/* Explicit id + `for` rather than a wrapping label alone */}
                <label
                  htmlFor={`enrol-${u.studentId}`}
                  className="flex min-w-0 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-background"
                >
                  <input
                    id={`enrol-${u.studentId}`}
                    type="checkbox"
                    checked={selected.includes(u.studentId)}
                    onChange={() => toggle(u.studentId)}
                    className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-3 focus:ring-accent/15"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {u.studentName}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {u.rollNo}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <Field
          id="bulk-class"
          label="Destination class"
          hint={
            target
              ? `${target.enrolledCount} of ${target.maxStrength} seats used · ${free} free`
              : undefined
          }
        >
          <select
            id="bulk-class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setError(null);
            }}
            className={structureInput(overCapacity)}
          >
            {board.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.departmentCode} · {c.enrolledCount}/{c.maxStrength}
              </option>
            ))}
          </select>
        </Field>

        {/* Live, not on submit: the exec sees the problem while selecting */}
        {overCapacity && target && (
          <FormAlert variant="error">
            {target.name} has {free} {free === 1 ? "seat" : "seats"} left, but{" "}
            {selected.length} students are selected. Raise the class strength
            or split the batch.
          </FormAlert>
        )}

        {error && !overCapacity && <FormAlert variant="error">{error}</FormAlert>}

        <div className="rounded-field bg-background px-3.5 py-3">
          <p className="text-[12px] leading-6 text-muted-foreground">
            Each student gets one{" "}
            <span className="font-mono text-[11px]">student_enrollments</span>{" "}
            row against {board.currentYearName}, with status Active. Roll
            numbers are assigned by the class, not carried over.
          </p>
        </div>

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
            loadingText="Enrolling…"
            disabled={selected.length === 0 || overCapacity}
            className="w-auto px-5"
          >
            Enrol {selected.length > 0 ? selected.length : ""}{" "}
            {selected.length === 1 ? "student" : "students"}
          </Button>
        </div>
      </form>
    </StructureDialog>
  );
}
