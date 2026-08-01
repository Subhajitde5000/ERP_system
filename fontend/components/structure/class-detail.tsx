import Link from "next/link";
import { ArrowLeft, CalendarDays, DoorOpen } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_TONE,
  seatsLeft,
  SUBJECT_TYPE_LABELS,
  SUBJECT_TYPE_TONE,
  subjectRoleLabel,
} from "@/lib/structure";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  CapacityMeter,
  InfoRow,
  StructureCard,
  StructureChip,
  VacantLabel,
} from "./structure-bits";
import type { ClassDetail as Detail } from "@/types/structure";

/**
 * C-IA-06 — Class Detail.
 * "Students enrolled, subjects, class teacher, timetable"
 *
 * Four things named, four sections. The class teacher is folded into the
 * summary card rather than given a section of its own — it is one name, and
 * a card containing one name is worse than a row in a definition list.
 *
 * A server component: every write for this entity lives on C-IA-05 (the
 * class), C-IA-07 (subjects) or C-IA-11 (enrolment), so nothing here mutates.
 */
export function ClassDetailView({ detail }: { detail: Detail }) {
  const { klass: c, students, subjects, timetable } = detail;
  const active = students.filter((s) => s.status === "ACTIVE");
  const free = seatsLeft(c.enrolledCount, c.maxStrength);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/classes"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All classes
      </Link>

      <div className="mb-1 flex min-w-0 flex-wrap items-start gap-2">
        <h1 className="min-w-0 font-display text-[22px] font-bold text-foreground">
          {c.name}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
          <StructureChip tone="accent">{c.departmentCode}</StructureChip>
          <StructureChip tone={c.isActive ? "success" : "muted"}>
            {c.isActive ? "Active" : "Inactive"}
          </StructureChip>
        </div>
      </div>
      <p className="mb-4 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span className="font-mono">{c.code}</span>
        <span>· {c.academicYearName}</span>
        {c.roomNo && <span>· room {c.roomNo}</span>}
      </p>

      <div className="grid min-w-0 gap-4">
        {/* Summary, including the class teacher */}
        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Class
          </h2>
          <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
            <InfoRow label="Class teacher">
              {c.classTeacherName ? (
                <Link
                  href={`/staff/${c.classTeacherId}`}
                  className="rounded font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  {c.classTeacherName}
                </Link>
              ) : (
                <VacantLabel>Unassigned</VacantLabel>
              )}
            </InfoRow>
            <InfoRow label="Department">
              <Link
                href={`/departments/${c.departmentId}`}
                className="rounded text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
              >
                {c.departmentCode}
              </Link>
            </InfoRow>
            <InfoRow label="Academic year">{c.academicYearName}</InfoRow>
            <InfoRow label="Default room">{c.roomNo ?? "—"}</InfoRow>
            <InfoRow label="Subjects">{subjects.length}</InfoRow>
            <InfoRow label="Seats">
              <span className="tabular-nums">
                {c.enrolledCount} of {c.maxStrength}
              </span>
              <span className="ml-1 text-[12px] text-muted-foreground">
                ({free} free)
              </span>
            </InfoRow>
          </dl>

          <div className="mt-4 max-w-xs border-t border-border pt-4">
            <CapacityMeter
              enrolled={c.enrolledCount}
              maxStrength={c.maxStrength}
            />
          </div>
        </StructureCard>

        {/* 1 — Students enrolled */}
        <StructureCard>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Students
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {active.length} active
                {students.length !== active.length &&
                  ` · ${students.length - active.length} inactive`}
              </span>
            </h2>
            <Link
              href={`/enrollments?class=${c.id}`}
              className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Manage enrolment
            </Link>
          </div>

          {students.length === 0 ? (
            <EmptyState message="Nobody is enrolled in this class yet." />
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[480px] border-collapse">
                <caption className="sr-only">
                  Students in {c.name} — {students.length} rows
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    {["Roll", "Student", "Enrolled", "Status"].map((h, i) => (
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
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 align-top font-mono text-[12px] text-muted-foreground">
                        {s.rollNumber ?? "—"}
                      </td>
                      <th scope="row" className="py-2.5 pr-3 text-left align-top">
                        <Link
                          href={`/students/${s.studentId}`}
                          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          {s.studentName}
                        </Link>
                      </th>
                      <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                        {formatDate(s.enrollmentDate)}
                      </td>
                      <td className="py-2.5 align-top">
                        <StructureChip tone={ENROLLMENT_STATUS_TONE[s.status]}>
                          {ENROLLMENT_STATUS_LABELS[s.status]}
                        </StructureChip>
                        {s.transferredToName && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            → {s.transferredToName}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StructureCard>

        {/* 2 — Subjects */}
        <StructureCard>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Subjects
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {subjects.length}
              </span>
            </h2>
            <Link
              href={`/subjects?class=${c.id}`}
              className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Manage subjects
            </Link>
          </div>

          {subjects.length === 0 ? (
            <EmptyState message="No subjects attached to this class yet." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {subjects.map((s) => (
                <li key={s.id} className="min-w-0 py-2.5">
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
                    {s.maxMarks} marks, pass at {s.passingMarks} ·{" "}
                    {s.teachers.length === 0 ? (
                      <VacantLabel>No teacher assigned</VacantLabel>
                    ) : (
                      s.teachers
                        .map(
                          (t) =>
                            `${t.teacherName} (${subjectRoleLabel(t.roleInSubject).toLowerCase()})`,
                        )
                        .join(", ")
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </StructureCard>

        {/* 3 — Timetable */}
        <StructureCard>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Timetable
            </h2>
            <Link
              href={`/timetable?class=${c.id}`}
              className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Open full timetable
            </Link>
          </div>

          {timetable.length === 0 ? (
            <EmptyState message="No periods scheduled for this class yet." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {timetable.map((day) => (
                <li key={day.day} className="min-w-0 py-2.5">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-20 shrink-0 text-[12px] font-semibold text-foreground">
                      {day.day}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">
                      {day.periods
                        .map((p) => `${p.period}. ${p.label}`)
                        .join("  ·  ")}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {day.periods.length}{" "}
                      {day.periods.length === 1 ? "period" : "periods"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StructureCard>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {free} of {c.maxStrength} seats free
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {timetable.reduce((a, d) => a + d.periods.length, 0)} periods a week
        </span>
      </div>
    </div>
  );
}
