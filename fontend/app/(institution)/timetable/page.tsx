import type { Metadata } from "next";
import { Download } from "lucide-react";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { TimetableView } from "@/components/timetable/timetable-view";
import { timetablePermissions } from "@/lib/timetable";
import {
  DEFAULT_CLASS_ID,
  PERIODS,
  getClassOptions,
  getConflicts,
  getTeacherSlots,
} from "@/lib/timetable-data";
import { getChildren } from "@/lib/attendance-data";
import type { TimetablePermissions } from "@/types/timetable";

export const metadata: Metadata = {
  title: "Timetable",
  description: "Weekly class and teaching schedules.",
};

/**
 * Timetable — role_based_shared_pages.md PAGE 10 (C-RB-10).
 *
 * One URL: build vs. view, class schedule vs. personal schedule.
 * `timetablePermissions()` resolves the view kind server-side; the weekly grid
 * itself is shared by every role.
 */
export default async function TimetablePage({
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
        const perms = timetablePermissions(session.roles);

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
                  Timetable
                </h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {perms.note}
                </p>
              </div>

              {perms.canExport && (
                // TODO(Dev-B): GET /timetable/slots?format=csv
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </button>
              )}
            </div>

            {renderView(perms)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(perms: TimetablePermissions) {
  switch (perms.view) {
    case "BUILDER":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          classOptions={getClassOptions("ALL")}
          defaultClassId={DEFAULT_CLASS_ID}
          conflicts={getConflicts()}
        />
      );

    case "PERSONAL":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          personalSlots={getTeacherSlots()}
        />
      );

    case "DEPARTMENT":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          classOptions={getClassOptions("DEPARTMENT")}
          defaultClassId={DEFAULT_CLASS_ID}
        />
      );

    case "INSTITUTION":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          classOptions={getClassOptions("ALL")}
          defaultClassId={DEFAULT_CLASS_ID}
        />
      );

    case "CLASS":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          defaultClassId={DEFAULT_CLASS_ID}
        />
      );

    case "CHILD":
      return (
        <TimetableView
          perms={perms}
          periods={PERIODS}
          defaultClassId={DEFAULT_CLASS_ID}
          childOptions={getChildren()}
        />
      );

    default:
      return null;
  }
}
