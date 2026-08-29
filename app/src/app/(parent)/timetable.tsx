/**
 * C-PA-07 — timetable for one child (mobile port of ParentChildTimetablePage).
 *
 * Rendered with the student console's week grid rather than a copy of it: a routine
 * is the same picture whoever is looking at it, and two implementations would drift
 * on exactly the day a room is moved. Today's column is highlighted because "is
 * there sport tomorrow?" is the question.
 */

import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { ChildGate } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui";
import { WeeklySlotGrid, timetableSlots } from "@/components/weekly-grid";
import { fetchChildTimetable } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function ParentTimetablePage() {
  const today = new Date().getDay();
  const childId = useChildId();
  const timetable = useResource(() => fetchChildTimetable(childId), [childId]);

  return (
    <Screen>
      <ChildGate module="timetable" title="{child} — timetable" subtitle="The class routine, as published by the school">
        <AsyncState loading={timetable.loading} error={timetable.error} onRetry={timetable.reload} loadingLabel="Loading the timetable…">
          {timetable.data ? (
            <View style={styles.stack}>
              <Card style={styles.classCard}>
                <Text style={styles.className}>
                  {[
                    timetable.data.class_info.class_name,
                    timetable.data.class_info.department_name,
                    timetable.data.class_info.academic_year,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No class is assigned yet"}
                </Text>
                <Text style={styles.classHint}>
                  A room or period change appears here the moment the school publishes it — there is nothing to
                  refresh in a separate notice.
                </Text>
              </Card>
              <WeeklySlotGrid slots={timetableSlots(timetable.data.slots)} highlightDay={today >= 1 && today <= 6 ? today : undefined} />
            </View>
          ) : null}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  classCard: { gap: 4 },
  className: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  classHint: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
});
