/**
 * C-TC-02 — weekly timetable for the teacher's own subjects.
 * Port of fontend/components/teacher/teacher-schedule.tsx.
 */

import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { PageHeader } from "@/components/ui";
import { WeeklySlotGrid } from "@/components/weekly-grid";
import { fetchTeacherSchedule } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function TeacherSchedulePage() {
  const resource = useResource(fetchTeacherSchedule, []);
  const today = new Date().getDay();

  return (
    <Screen>
      <PageHeader
        title="My schedule"
        subtitle={
          resource.data?.academic_year
            ? `Academic year ${resource.data.academic_year} · your weekly teaching timetable`
            : "Your weekly teaching timetable"
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your schedule…"
      >
        {resource.data ? (
          <View style={styles.stack}>
            {resource.data.assignments.length ? (
              <View style={styles.scope}>
                <Text style={styles.scopeText}>
                  Teaching scope:{" "}
                  {resource.data.assignments
                    .map((assignment) => `${assignment.subject_code} · ${assignment.class_name}`)
                    .join("  |  ")}
                </Text>
              </View>
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
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  scope: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  scopeText: {
    fontSize: 14,
    color: Colors.accent,
  },
});
