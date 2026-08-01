import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { CourseworkForm } from "@/components/shared/coursework-form";
import { examPermissions } from "@/lib/examination";
import { getClassOptions } from "@/lib/timetable-data";
import { getAllExams } from "@/lib/examination-data";

export const metadata: Metadata = { title: "Create Exam" };

/**
 * Create Exam — C-TC-08, `exams` (DB §7.2).
 *
 * The Examination page has always shown a "Create Exam" CTA to authors and
 * the Exam Controller; it 404'd until now. Gated on the same `canCreate`.
 */
export default async function NewExamPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = examPermissions(session.roles);

        if (!perms.canAuthor) {
          return (
            <PermissionDenied
              message="Only teaching staff and the Exam Controller can create exams."
              backHref="/examination"
              backLabel="Back to Examination"
            />
          );
        }

        const subjects = [
          ...new Map(
            getAllExams().map((e) => [
              e.subjectCode,
              { id: e.subjectCode, label: `${e.subjectCode} · ${e.subjectName}` },
            ]),
          ).values(),
        ];

        return (
          <CourseworkForm
            kind="EXAM"
            subjects={subjects}
            classes={getClassOptions("ALL").map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            backHref="/examination"
            backLabel="Back to Examination"
          />
        );
      }}
    </InstitutionShell>
  );
}
