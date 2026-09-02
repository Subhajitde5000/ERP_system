"use client";

import { PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchStudentTimetable } from "@/lib/student";
import { AsyncState } from "@/components/principal/principal-ui";
import { WeeklySlotGrid, toWeeklyGridSlots } from "@/components/institution-console/weekly-grid";

/** C-ST-06 — weekly timetable of the student's class with teachers and rooms. */
export function StudentTimetablePage() {
  const resource = useResource(fetchStudentTimetable, []);
  const today = new Date().getDay(); // 0 = Sunday

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="My timetable"
        subtitle={
          resource.data
            ? `${resource.data.class_info.class_name ?? "Your class"}${
                resource.data.class_info.academic_year ? ` · ${resource.data.class_info.academic_year}` : ""
              }`
            : "Your weekly class schedule"
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your timetable…">
        {resource.data ? (
          <WeeklySlotGrid
            highlightDay={today >= 1 && today <= 6 ? today : undefined}
            emptyText="No timetable has been published for your class yet."
            slots={toWeeklyGridSlots(resource.data.slots)}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}
