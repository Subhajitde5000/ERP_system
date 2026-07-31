import type { Metadata } from "next";
import { Download } from "lucide-react";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { MarkView } from "@/components/attendance/mark-view";
import { ExamHallView } from "@/components/attendance/exam-hall-view";
import { ParentAttendanceView } from "@/components/attendance/parent-view";
import { SelfAttendanceView } from "@/components/attendance/self-view";
import {
  DepartmentHeatmapView,
  InstitutionSummaryView,
  SchedulingView,
} from "@/components/attendance/report-views";
import { attendancePermissions } from "@/lib/attendance";
import {
  getChildren,
  getClassSchedule,
  getDepartmentHeatmap,
  getExamHalls,
  getInstitutionSummary,
  getSelfAttendance,
  getTeacherSessions,
} from "@/lib/attendance-data";
import type { SelfAttendance } from "@/types/attendance";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Mark, review and report on attendance.",
};

/**
 * Attendance — role_based_shared_pages.md PAGE 5 (C-RB-05).
 *
 * One URL, but genuinely different layouts per role (unlike notices, which is
 * one layout with scoped data). `attendancePermissions()` resolves the view
 * kind once, server-side, and this page dispatches on it.
 */
export default async function AttendancePage({
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
        const perms = attendancePermissions(session.roles);

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
                  Attendance
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {perms.note}
                </p>
              </div>

              {perms.canExport && (
                // TODO(Dev-B): GET /attendance/reports/... ?format=csv
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export report
                </button>
              )}
            </div>

            {renderView(perms.view, perms, session.user.name)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(
  view: ReturnType<typeof attendancePermissions>["view"],
  perms: ReturnType<typeof attendancePermissions>,
  userName: string,
) {
  switch (view) {
    case "MARK":
      return <MarkView sessions={getTeacherSessions()} canLock={perms.canLock} />;

    case "DEPARTMENT":
      return <DepartmentHeatmapView data={getDepartmentHeatmap()} />;

    case "INSTITUTION":
      return <InstitutionSummaryView data={getInstitutionSummary()} />;

    case "EXAM_HALL":
      return <ExamHallView halls={getExamHalls()} canLock={perms.canLock} />;

    case "SCHEDULING":
      return <SchedulingView rows={getClassSchedule()} />;

    case "SELF":
      return (
        <SelfAttendanceView
          data={getSelfAttendance(userName, "FY-BSc-A")}
          canApplyLeave={perms.canApplyLeave}
        />
      );

    case "CHILD": {
      const children = getChildren();
      const records: Record<string, SelfAttendance> = {};
      for (const child of children) {
        records[child.id] = getSelfAttendance(child.name, child.className);
      }
      return <ParentAttendanceView childOptions={children} records={records} />;
    }

    default:
      return null;
  }
}
