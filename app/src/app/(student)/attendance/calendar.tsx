/**
 * C-ST-04 attendance calendar — port of StudentAttendanceCalendarPage in
 * fontend/components/student/student-attendance.tsx: one colour per day and
 * status, Monday-first month grid with a legend.
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { statusLabel } from "@/lib/format";
import { fetchStudentAttendanceCalendar } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

function monthKey(offset = 0): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

/** The website uses `bg-info` for EXCUSED; that token resolves to the brand
 * cyan on the app so the dot stays visible. */
const STATUS_DOT: Record<string, string> = {
  PRESENT: Colors.success,
  ABSENT: Colors.destructive,
  LATE: Colors.warning,
  EXCUSED: Colors.secondary,
};

export default function StudentAttendanceCalendarPage() {
  const [month, setMonth] = useState(monthKey());
  const resource = useResource(() => fetchStudentAttendanceCalendar(month), [month]);

  function shift(months: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(year ?? 2026, (monthNumber ?? 1) - 1 + months, 1);
    setMonth(`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`);
  }

  const byDate = new Map((resource.data?.days ?? []).map((day) => [day.date, day.entries]));
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = new Date(year ?? 2026, (monthNumber ?? 1) - 1, 1);
  const daysInMonth = new Date(year ?? 2026, monthNumber ?? 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7; // Monday-first offset
  const monthName = firstDay.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <Screen>
      <PageHeader title="Attendance calendar" subtitle="One colour per day and status." />
      <Card>
        <View style={styles.monthNav}>
          <TouchableOpacity accessibilityLabel="Previous month" onPress={() => shift(-1)} style={styles.monthButton}>
            <ChevronLeft size={16} color={Colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={styles.monthName}>{monthName}</Text>
          <TouchableOpacity accessibilityLabel="Next month" onPress={() => shift(1)} style={styles.monthButton}>
            <ChevronRight size={16} color={Colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.weekdayRow}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <Text key={day} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
        <AsyncState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          loadingLabel="Loading the calendar…"
        >
          <View style={styles.grid}>
            {Array.from({ length: leading }, (_, index) => (
              <View key={`blank-${index}`} style={styles.cell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const dayNumber = index + 1;
              const key = `${month}-${`${dayNumber}`.padStart(2, "0")}`;
              const entries = byDate.get(key) ?? [];
              return (
                <View
                  key={key}
                  accessibilityLabel={
                    entries.length
                      ? entries.map((entry) => `${entry.subject_code}: ${statusLabel(entry.status)}`).join(", ")
                      : `${dayNumber}: no sessions`
                  }
                  style={[styles.cell, styles.dayCell, entries.length ? styles.dayCellActive : styles.dayCellIdle]}
                >
                  <Text style={styles.dayNumber}>{dayNumber}</Text>
                  <View style={styles.dots}>
                    {entries.slice(0, 6).map((entry, entryIndex) => (
                      <View
                        key={`${key}-${entryIndex}`}
                        style={[styles.dot, { backgroundColor: STATUS_DOT[entry.status] ?? Colors.border }]}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </AsyncState>
        <View style={styles.legend}>
          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.dot, styles.legendDot, { backgroundColor: STATUS_DOT[status] }]} />
              <Text style={styles.legendLabel}>{statusLabel(status)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  weekdayRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  cell: {
    width: `${(100 - 3 * 1.5) / 7}%`,
    flexGrow: 1,
  },
  dayCell: {
    minHeight: 48,
    borderRadius: 6,
    borderWidth: 1,
    padding: 6,
  },
  dayCellActive: {
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
  },
  dayCellIdle: {
    borderColor: "transparent",
    backgroundColor: "rgba(241,245,249,0.4)",
  },
  dayNumber: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.primary,
  },
  dots: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legend: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
});
