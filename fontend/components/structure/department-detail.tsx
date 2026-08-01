import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, Users } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import {
  SUBJECT_TYPE_LABELS,
  SUBJECT_TYPE_TONE,
} from "@/lib/structure";
import { roleChip } from "@/lib/roles";
import { EmptyState } from "@/components/dashboard/primitives";
import {
  CapacityMeter,
  InfoRow,
  RosterScopeNote,
  StructureCard,
  StructureChip,
  VacantLabel,
} from "./structure-bits";
import type { DepartmentDetail as Detail } from "@/types/structure";

/**
 * C-IA-03 — Department Detail.
 * "Dept info, HOD, class list, subject list"
 *
 * The doc names four things and they are the four sections, in that order.
 * Staff is added as a fifth because the HOD has to be chosen from somewhere
 * and §6.2's `hod_id` points at `users` — showing who is actually in the
 * department is what makes the vacancy on the list page actionable.
 *
 * A server component: everything is output. Editing happens on the list page
 * (C-IA-02), which owns the write endpoints.
 */
export function DepartmentDetailView({ detail }: { detail: Detail }) {
  const { department: d, classes, subjects, staff } = detail;
  const activeStaff = staff.filter((s) => s.isActive);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/departments"
        className="mb-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All departments
      </Link>

      <div className="mb-1 flex min-w-0 flex-wrap items-start gap-2">
        <h1 className="min-w-0 font-display text-[22px] font-bold text-foreground">
          {d.name}
        </h1>
        <div className="pt-1.5">
          <StructureChip tone={d.isActive ? "success" : "muted"}>
            {d.isActive ? "Active" : "Inactive"}
          </StructureChip>
        </div>
      </div>
      <p className="mb-4 flex min-w-0 flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        <span className="font-mono">{d.code}</span>
        <span>· since {formatDate(d.createdAt)}</span>
      </p>

      <div className="grid min-w-0 gap-4">
        {/* 1 — Dept info + HOD */}
        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Department
          </h2>

          {d.description && (
            <p className="mb-4 text-[13px] leading-6 text-[#334155]">
              {d.description}
            </p>
          )}

          <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
            <InfoRow label="Head of department">
              {d.hodName ? (
                <Link
                  href={`/staff/${d.hodId}`}
                  className="rounded font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                >
                  {d.hodName}
                </Link>
              ) : (
                <VacantLabel />
              )}
            </InfoRow>
            <InfoRow label="Code">
              <span className="font-mono">{d.code}</span>
            </InfoRow>
            <InfoRow label="Classes">{d.classCount}</InfoRow>
            <InfoRow label="Subjects">{d.subjectCount}</InfoRow>
            <InfoRow label="Teaching staff">{d.teacherCount}</InfoRow>
            <InfoRow label="Students">
              {d.studentCount.toLocaleString("en-IN")}
            </InfoRow>
          </dl>
        </StructureCard>

        {/* 2 — Class list */}
        <StructureCard>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Classes
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {classes.length}
              </span>
            </h2>
            <Link
              href={`/classes?department=${d.id}`}
              className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Manage classes
            </Link>
          </div>

          {classes.length === 0 ? (
            <EmptyState message="No classes in this department yet." />
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[520px] border-collapse">
                <caption className="sr-only">
                  Classes in {d.name} — {classes.length} rows
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    {[
                      ["Class", false],
                      ["Year", false],
                      ["Class teacher", false],
                      ["Enrolled", true],
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
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left align-top">
                        <Link
                          href={`/classes/${c.id}`}
                          className="block truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                        >
                          {c.name}
                        </Link>
                        <span className="font-mono text-[11px] font-normal text-muted-foreground">
                          {c.code}
                          {c.roomNo && ` · ${c.roomNo}`}
                        </span>
                      </th>
                      <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.academicYearName}
                      </td>
                      <td className="py-2.5 pr-3 align-top text-[12px] text-muted-foreground">
                        {c.classTeacherName ?? <VacantLabel>Unassigned</VacantLabel>}
                      </td>
                      <td className="w-28 py-2.5 align-top">
                        <CapacityMeter
                          enrolled={c.enrolledCount}
                          maxStrength={c.maxStrength}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StructureCard>

        {/* 3 — Subject list */}
        <StructureCard>
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Subjects
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {subjects.length}
              </span>
            </h2>
            <Link
              href={`/subjects?department=${d.id}`}
              className="shrink-0 rounded text-[12px] font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
            >
              Manage subjects
            </Link>
          </div>

          {subjects.length === 0 ? (
            <EmptyState message="No subjects defined for this department yet." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {subjects.map((s) => (
                <li key={s.id} className="min-w-0 py-2.5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
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
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {s.className}
                        {s.credits !== null && ` · ${s.credits} credits`} ·{" "}
                        {s.teachers.length === 0 ? (
                          <VacantLabel>No teacher assigned</VacantLabel>
                        ) : (
                          s.teachers.map((t) => t.teacherName).join(", ")
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StructureCard>

        {/* 4 — Staff, so the HOD vacancy on the list page is actionable */}
        <StructureCard>
          <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
            Staff
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              {activeStaff.length} active
            </span>
          </h2>

          {staff.length === 0 ? (
            <EmptyState message="Nobody is recorded against this department." />
          ) : (
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {staff.map((s) => (
                <li key={s.id} className="flex min-w-0 items-start gap-3 py-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-light text-[12px] font-semibold text-accent"
                    aria-hidden="true"
                  >
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/staff/${s.id}`}
                        className="min-w-0 truncate rounded text-[13px] font-medium text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        {s.name}
                      </Link>
                      {!s.isActive && (
                        <StructureChip tone="muted">Deactivated</StructureChip>
                      )}
                      {s.id === d.hodId && (
                        <StructureChip tone="accent">HOD</StructureChip>
                      )}
                    </p>
                    <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {s.designation} · {s.roles.map(roleChip).join(", ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StructureCard>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {d.classCount} classes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {d.subjectCount} subjects
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {d.teacherCount} teaching staff
        </span>
      </div>
      <RosterScopeNote className="mt-2" />
    </div>
  );
}
