/**
 * C-ST-06 timetable — port of fontend/components/student/student-timetable.tsx:
 * weekly timetable of the student's class with teachers and rooms.
 */

import { Screen } from "@/components/screen";
import { PageHeader } from "@/components/ui";
import { AsyncState } from "@/components/principal-ui";
import { WeeklySlotGrid } from "@/components/weekly-grid";
import { fetchStudentTimetable } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";

export default function StudentTimetablePage() {
  const resource = useResource(fetchStudentTimetable, []);
  const today = new Date().getDay(); // 0 = Sunday

  return (
    <Screen>
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
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your timetable…"
      >
        {resource.data ? (
          <WeeklySlotGrid
            highlightDay={today >= 1 && today <= 6 ? today : undefined}
            emptyText="No timetable has been published for your class yet."
            slots={resource.data.slots.map((slot) => ({
              id: slot.id,
              day_of_week: slot.day_of_week,
              period_number: slot.period_number,
              start_time: slot.start_time,
              end_time: slot.end_time,
              heading: slot.subject_name ?? slot.slot_type,
              subheading: slot.teacher_name ?? slot.subject_code,
              meta: slot.room_no ? `Room ${slot.room_no}` : null,
              slot_type: slot.slot_type,
            }))}
          />
        ) : null}
      </AsyncState>
    </Screen>
  );
}
