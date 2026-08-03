"use client";

import { PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchTeacherSchedule } from "@/lib/teacher";
import { AsyncState } from "@/components/principal/principal-ui";
import { WeeklySlotGrid } from "@/components/institution-console/weekly-grid";

/** C-TC-02 — weekly timetable for the teacher's own subjects. */
export function TeacherSchedulePage() {
  const resource = useResource(fetchTeacherSchedule, []);
  const today = new Date().getDay(); // 0 = Sunday

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="My schedule"
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · your weekly teaching timetable`
            : "Your weekly teaching timetable"
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your schedule…">
        {resource.data ? (
          <div className="space-y-6">
            {resource.data.assignments.length ? (
              <p className="rounded-field border border-accent-border bg-accent-light px-4 py-2.5 text-sm text-accent">
                Teaching scope:{" "}
                {resource.data.assignments
                  .map((assignment) => `${assignment.subject_code} · ${assignment.class_name}`)
                  .join("  |  ")}
              </p>
            ) : null}
            <WeeklySlotGrid
              highlightDay={today >= 1 && today <= 6 ? today : undefined}
              emptyText="No timetable is published for your subjects yet."
              slots={resource.data.slots.map((slot) => ({
                id: slot.id,
                day_of_week: slot.day_of_week,
                period_number: slot.period_number,
                start_time: slot.start_time,
                end_time: slot.end_time,
                heading: slot.subject_name ?? slot.slot_type,
                subheading: slot.class_name,
                meta: slot.room_no ? `Room ${slot.room_no}` : null,
                slot_type: slot.slot_type,
              }))}
            />
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
