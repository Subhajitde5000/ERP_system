/**
 * Weekly day-column grid — mobile port of
 * fontend/components/institution-console/weekly-grid.tsx. The website renders
 * one column per day (Mon–Sat); on the phone the columns stack vertically in
 * the same order with the same slot cards.
 */

import { StyleSheet, Text, View } from "react-native";

import { Card, EmptyState } from "./ui";
import { clockTime } from "@/lib/format";
import { Colors, Radius } from "@/theme";

export interface WeeklyGridEntry {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  heading: string;
  subheading: string | null;
  meta: string | null;
  slot_type: string;
}

/**
 * A timetable slot from either console becomes a grid entry here and nowhere else:
 * the student's routine and the guardian's view of it are the same picture, and two
 * mappings would drift on exactly the day a room is moved.
 */
export function timetableSlots(slots: TimetableSlotLike[]): WeeklyGridEntry[] {
  return slots.map((slot) => ({
    id: slot.id,
    day_of_week: slot.day_of_week,
    period_number: slot.period_number,
    start_time: slot.start_time,
    end_time: slot.end_time,
    heading: slot.subject_name ?? slot.slot_type,
    subheading: slot.teacher_name ?? slot.subject_code,
    meta: slot.room_no ? `Room ${slot.room_no}` : null,
    slot_type: slot.slot_type,
  }));
}

interface TimetableSlotLike {
  id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_name: string | null;
  subject_code: string | null;
  teacher_name: string | null;
  room_no: string | null;
  slot_type: string;
}

export const WEEK_DAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
];

const SLOT_TYPE_STYLE: Record<string, { borderColor: string; backgroundColor: string }> = {
  CLASS: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentLight },
  BREAK: { borderColor: Colors.border, backgroundColor: Colors.muted },
  LAB: { borderColor: Colors.successBorder, backgroundColor: Colors.successLight },
  SPORTS: { borderColor: Colors.successBorder, backgroundColor: Colors.successLight },
  LIBRARY: { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight },
  ASSEMBLY: { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight },
};

export function WeeklySlotGrid({
  slots,
  highlightDay,
  emptyText = "No periods are scheduled.",
}: {
  slots: WeeklyGridEntry[];
  /** Today (1-6) gets a header highlight when rendered inside the week. */
  highlightDay?: number;
  emptyText?: string;
}) {
  if (!slots.length) {
    return (
      <Card>
        <EmptyState text={emptyText} />
      </Card>
    );
  }
  return (
    <View style={styles.week}>
      {WEEK_DAYS.map(({ day, label }) => {
        const daySlots = slots
          .filter((slot) => slot.day_of_week === day)
          .sort((a, b) => a.period_number - b.period_number);
        return (
          <View key={day} accessibilityLabel={label} style={styles.day}>
            <Text
              style={[
                styles.dayHeader,
                highlightDay === day ? styles.dayHeaderActive : styles.dayHeaderIdle,
              ]}
            >
              {label}
            </Text>
            {daySlots.length ? (
              daySlots.map((slot) => (
                <View
                  key={slot.id}
                  style={[
                    styles.slot,
                    SLOT_TYPE_STYLE[slot.slot_type] ?? {
                      borderColor: Colors.border,
                      backgroundColor: Colors.card,
                    },
                  ]}
                >
                  <Text style={styles.slotTime}>
                    P{slot.period_number} · {clockTime(slot.start_time)}–{clockTime(slot.end_time)}
                  </Text>
                  <Text style={styles.slotHeading} numberOfLines={1}>
                    {slot.heading}
                  </Text>
                  {slot.subheading ? (
                    <Text style={styles.slotSubheading} numberOfLines={1}>
                      {slot.subheading}
                    </Text>
                  ) : null}
                  {slot.meta ? <Text style={styles.slotMeta}>{slot.meta}</Text> : null}
                </View>
              ))
            ) : (
              <Text style={styles.free}>Free</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    gap: 12,
  },
  day: {
    gap: 8,
  },
  dayHeader: {
    borderRadius: Radius.field,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    overflow: "hidden",
  },
  dayHeaderActive: {
    backgroundColor: Colors.accent,
    color: "#FFFFFF",
  },
  dayHeaderIdle: {
    backgroundColor: Colors.muted,
    color: Colors.mutedForeground,
  },
  slot: {
    borderRadius: Radius.field,
    borderWidth: 1,
    padding: 12,
  },
  slotTime: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  slotHeading: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  slotSubheading: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  slotMeta: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  free: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    padding: 12,
    textAlign: "center",
    fontSize: 11,
    color: Colors.mutedForeground,
  },
});
