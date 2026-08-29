/**
 * C-PA-05 — attendance for one child (mobile port of ParentChildAttendancePage).
 *
 * The month grid is the reason this screen exists: a guardian does not read
 * "94.2%", they read "which day did they not come?". Tapping a day opens the
 * per-period marks, because a child marked absent for third period and present for
 * the rest is a different conversation from a full-day absence — and the office
 * needs to hear which one it is.
 */

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { ChildGate, DataRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateOnly, percent, statusLabel } from "@/lib/format";
import { fetchChildAttendance, fetchChildAttendanceCalendar } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const DAY_COLORS: Record<string, string> = {
  PRESENT: Colors.success,
  LATE: Colors.warning,
  ABSENT: Colors.destructive,
  EXCUSED: Colors.accentSoft,
};

export default function ParentAttendancePage() {
  const childId = useChildId();
  const summary = useResource(() => fetchChildAttendance(childId), [childId]);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const calendar = useResource(() => fetchChildAttendanceCalendar(childId, month), [childId, month]);

  const days = useMemo(() => calendar.data?.days ?? [], [calendar.data]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const detail = days.find((day) => day.date === openDay);

  return (
    <Screen>
      <ChildGate module="attendance" title="{child} — attendance" subtitle="Marked by the subject teacher, period by period">
        <AsyncState loading={summary.loading} error={summary.error} onRetry={summary.reload} loadingLabel="Loading attendance…">
          {summary.data ? (
            <View style={styles.stack}>
              <View style={styles.metrics}>
                <MetricCard
                  label="Overall"
                  value={summary.data.attendance_percentage === null ? "—" : percent(summary.data.attendance_percentage)}
                  hint={`${summary.data.total_marks} periods marked`}
                />
                <MetricCard label="Present" value={summary.data.present_count} tone="success" />
                <MetricCard label="Absent" value={summary.data.absent_count} tone={summary.data.absent_count ? "danger" : "default"} />
                <MetricCard label="Late" value={summary.data.late_count} tone={summary.data.late_count ? "warning" : "default"} hint={`${summary.data.excused_count} excused`} />
              </View>

              <Card>
                <Text style={styles.cardTitle}>The month</Text>
                <View style={styles.monthBar}>
                  <Pressable accessibilityRole="button" onPress={() => setMonth(shift(month, -1))} style={styles.monthButton}>
                    <Text style={styles.monthButtonLabel}>‹</Text>
                  </Pressable>
                  <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => (month < monthKey(new Date()) ? setMonth(shift(month, 1)) : undefined)}
                    disabled={month >= monthKey(new Date())}
                    style={[styles.monthButton, month >= monthKey(new Date()) && styles.monthButtonOff]}
                  >
                    <Text style={styles.monthButtonLabel}>›</Text>
                  </Pressable>
                </View>

                <AsyncState loading={calendar.loading} error={calendar.error} onRetry={calendar.reload} loadingLabel="Loading the month…">
                  {days.length ? (
                    <>
                      <View style={styles.grid}>
                        {days.map((day) => {
                          // A day can hold several periods; the worst status wins the
                          // colour, because "absent for one period" is the thing to notice.
                          const worst = ["ABSENT", "LATE", "EXCUSED", "PRESENT"].find((status) =>
                            day.entries.some((entry) => entry.status === status),
                          );
                          return (
                            <Pressable
                              key={day.date}
                              accessibilityRole="button"
                              accessibilityLabel={`${dateOnly(day.date)} — ${worst ? statusLabel(worst) : "no record"}`}
                              onPress={() => setOpenDay(day.date === openDay ? null : day.date)}
                              style={[
                                styles.day,
                                worst ? { backgroundColor: DAY_COLORS[worst], borderColor: DAY_COLORS[worst] } : null,
                                day.date === openDay ? styles.dayOpen : null,
                              ]}
                            >
                              <Text style={[styles.dayLabel, worst ? styles.dayLabelOnColor : null]}>
                                {Number(day.date.slice(-2))}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {detail ? (
                        <View style={styles.detail}>
                          <Text style={styles.detailTitle}>{dateOnly(detail.date)}</Text>
                          {detail.entries.map((entry, index) => (
                            <DataRow
                              key={`${entry.subject_code}-${index}`}
                              title={`${entry.period_label} · ${entry.subject_name}`}
                              meta={statusLabel(entry.status)}
                            />
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.hint}>Tap a day to see how each period was marked.</Text>
                      )}
                      <View style={styles.legend}>
                        {Object.entries(DAY_COLORS).map(([status, color]) => (
                          <View key={status} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: color }]} />
                            <Text style={styles.legendLabel}>{statusLabel(status)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <EmptyState text="No attendance has been marked in this month yet." />
                  )}
                </AsyncState>
              </Card>

              {summary.data.subjects.length ? (
                <Card padded={false}>
                  <Text style={styles.cardTitleFlat}>By subject</Text>
                  {summary.data.subjects.map((subject) => (
                    <DataRow
                      key={subject.subject_id}
                      title={subject.subject_name}
                      meta={`${subject.subject_code} · ${subject.present_count}/${subject.total_marks} present${
                        subject.absent_count ? ` · ${subject.absent_count} absent` : ""
                      }${subject.late_count ? ` · ${subject.late_count} late` : ""}`}
                      right={
                        <Text style={subject.attendance_percentage !== null && subject.attendance_percentage < 75 ? styles.lowPct : styles.pct}>
                          {subject.attendance_percentage === null ? "—" : percent(subject.attendance_percentage)}
                        </Text>
                      }
                    />
                  ))}
                </Card>
              ) : null}

              <Text style={styles.footnote}>
                Below 75% in a subject is usually where a shortage of attendance letter starts. If a day here is
                wrong, the class teacher corrects it — this screen cannot.
              </Text>
            </View>
          ) : null}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

/** `YYYY-MM` in the school's own timezone-free calendar terms (the backend accepts and returns this). */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shift(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  return monthKey(new Date(year!, (month ?? 1) - 1 + delta, 1));
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  cardTitleFlat: { fontSize: 15, fontWeight: "800", color: Colors.primary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  monthButton: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  monthButtonOff: { opacity: 0.4 },
  monthButtonLabel: { fontSize: 16, color: Colors.primary },
  monthLabel: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  dayOpen: { borderColor: Colors.ring, borderWidth: 2 },
  dayLabel: { fontSize: 13, fontWeight: "600", color: Colors.mutedForeground },
  dayLabelOnColor: { color: "#FFFFFF" },
  detail: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  detailTitle: { fontSize: 12, fontWeight: "700", color: Colors.primary, paddingTop: 10 },
  hint: { fontSize: 12, color: Colors.mutedForeground, marginTop: 10 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: Colors.mutedForeground },
  pct: { fontSize: 13, fontWeight: "700", color: Colors.foreground },
  lowPct: { fontSize: 13, fontWeight: "700", color: Colors.destructiveText },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
});
