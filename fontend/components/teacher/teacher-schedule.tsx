"use client";

import { PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchTeacherSchedule } from "@/lib/teacher";
import { AsyncState, WeeklyGrid } from "@/components/teacher/teacher-ui";

/** C-TC-02 — the weekly grid for this teacher's own periods. */
export function TeacherSchedulePage() {
  const resource = useResource(fetchTeacherSchedule, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="My schedule"
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · periods timetabled to you`
            : "Periods timetabled to you"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your timetable…"
      >
        {resource.data ? (
          <WeeklyGrid
            slots={resource.data.slots.map((slot) => ({
              id: slot.id,
              day_of_week: slot.day_of_week,
              period_number: slot.period_number,
              start_time: slot.start_time,
              end_time: slot.end_time,
              subject_code: slot.subject_code,
              subject_name: slot.subject_name,
              room_no: slot.room_no,
              slot_type: slot.slot_type,
              // A teacher needs to know *which room of students* they face.
              secondary: slot.class_name,
            }))}
          />
        ) : null}
      </AsyncState>
    </div>
  );
}
