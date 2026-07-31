import type { Metadata } from "next";
import { Download, Plus } from "lucide-react";
import Link from "next/link";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ExamList } from "@/components/examination/exam-list";
import { ExamTimetable } from "@/components/examination/exam-timetable";
import { ParentExams } from "@/components/examination/parent-exams";
import { StudentExams } from "@/components/examination/student-exams";
import { examPermissions } from "@/lib/examination";
import {
  getAllExams,
  getDepartmentExams,
  getOwnExams,
  getStudentExams,
  getTimetable,
} from "@/lib/examination-data";
import { getChildren } from "@/lib/attendance-data";
import type { ExamPermissions } from "@/types/examination";
import type { StudentExam } from "@/types/examination";

export const metadata: Metadata = {
  title: "Examination",
  description: "Create, schedule, monitor and attempt examinations.",
};

/**
 * Examination — role_based_shared_pages.md PAGE 6 (C-RB-06).
 *
 * One URL; the role decides whether you author, control, monitor or attempt.
 * `examPermissions()` resolves the view kind server-side and this page
 * dispatches on it.
 */
export default async function ExaminationPage({
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

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-[22px] font-bold text-foreground">
                  Examination
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {perms.note}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {perms.canExport && (
                  // TODO(Dev-B): GET /examination/exams?format=csv
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Export
                  </button>
                )}
                {perms.canAuthor && (
                  <Link
                    href="/examination/new"
                    className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create Exam
                  </Link>
                )}
              </div>
            </div>

            {renderView(perms)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(perms: ExamPermissions) {
  switch (perms.view) {
    case "AUTHOR":
      return (
        <ExamList
          exams={getOwnExams()}
          perms={perms}
          emptyHint="Create your first exam to get started."
        />
      );

    case "CONTROL":
      return (
        <ExamList
          exams={getAllExams()}
          perms={perms}
          showOwner
          emptyHint="No exams have been created yet."
        />
      );

    case "DEPARTMENT":
      return (
        <ExamList
          exams={getDepartmentExams()}
          perms={perms}
          showOwner
          emptyHint="No exams in your department yet."
        />
      );

    case "INSTITUTION":
      return (
        <ExamList
          exams={getAllExams()}
          perms={perms}
          showOwner
          emptyHint="No exams across the institution yet."
        />
      );

    case "TIMETABLE":
      return <ExamTimetable entries={getTimetable()} />;

    case "TAKE":
      return (
        <StudentExams exams={getStudentExams()} canAttempt={perms.canAttempt} />
      );

    case "CHILD": {
      const children = getChildren();
      const records: Record<string, StudentExam[]> = {};
      for (const child of children) records[child.id] = getStudentExams();
      return <ParentExams childOptions={children} records={records} />;
    }

    default:
      return null;
  }
}
