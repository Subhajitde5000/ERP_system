/**
 * C-PA-02 — today for one child (mobile port of ParentChildTodayPage).
 *
 * The screen a guardian actually opens at 4pm: is the child in school, what is due,
 * what did the class board say, and who to ring. It reads the same
 * `/children/{id}/dashboard` the web console reads — one payload, no second
 * aggregation endpoint for the app to invent.
 *
 * Tiles are dropped per module the school has not granted, rather than shown as
 * zeros: an empty attendance tile would read as "0% present" to a worried parent.
 */

import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Link } from "expo-router";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { ChildGate, Chip, DataRow, FactRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { clockTime, dateOnly, inr, statusLabel } from "@/lib/format";
import { fetchChildDashboard, fetchChildProfile, fetchLastAttendance } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function ParentTodayPage() {
  const childId = useChildId();
  const dashboard = useResource(() => fetchChildDashboard(childId), [childId]);
  const last = useResource(() => fetchLastAttendance(childId), [childId]);
  const profile = useResource(() => fetchChildProfile(childId), [childId]);
  const router = useRouter();

  const student = dashboard.data?.student;
  const scope = new Set(dashboard.data?.child.access_scope ?? []);

  return (
    <Screen>
      <ChildGate title="{child} — today" subtitle="The day as the school has recorded it">
        <AsyncState
          loading={dashboard.loading}
          error={dashboard.error}
          onRetry={dashboard.reload}
          loadingLabel="Loading today…"
        >
          {student ? (
            <View style={styles.stack}>
              <View style={styles.metrics}>
                {scope.has("attendance") ? (
                  <MetricCard
                    label="Attendance"
                    value={student.attendance_percentage === null ? "—" : `${Math.round(student.attendance_percentage)}%`}
                    hint={`Today: ${last.data?.status ? statusLabel(last.data.status) : "not marked yet"}`}
                    tone={last.data?.status === "ABSENT" ? "danger" : "default"}
                  />
                ) : null}
                {scope.has("assignment") ? (
                  <MetricCard label="Work due" value={student.pending_assignment_count} hint="Not submitted yet" tone={student.pending_assignment_count ? "warning" : "success"} />
                ) : null}
                {scope.has("examination") ? (
                  <MetricCard
                    label="Next exam"
                    value={student.next_exam ? dateOnly(student.next_exam.scheduled_at) : "—"}
                    hint={student.next_exam ? student.next_exam.subject_name : "Nothing scheduled"}
                  />
                ) : null}
                {scope.has("finance") ? (
                  <MetricCard
                    label="Balance due"
                    value={student.fee_balance_due === null ? "—" : inr(student.fee_balance_due)}
                    tone={student.fee_balance_due && student.fee_balance_due > 0 ? "warning" : "success"}
                    hint="The office figure"
                  />
                ) : null}
              </View>

              {scope.has("timetable") ? (
                <Card padded={false}>
                  <Headline title="Today's periods" onPress={() => router.push("/timetable" as never)} />
                  {student.today_periods.length ? (
                    student.today_periods.map((slot) => (
                      <DataRow
                        key={slot.id}
                        title={`${clockTime(slot.start_time)} · ${slot.subject_name ?? statusLabel(slot.slot_type)}`}
                        meta={[slot.teacher_name, slot.room_no && `Room ${slot.room_no}`].filter(Boolean).join(" · ")}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyPad}>
                      <EmptyState text="No periods are on the timetable for today." />
                    </View>
                  )}
                </Card>
              ) : null}

              {scope.has("assignment") ? (
                <Card padded={false}>
                  <Headline title="Work due" onPress={() => router.push("/assignments" as never)} />
                  {student.pending_assignments.length ? (
                    student.pending_assignments.map((item) => (
                      <DataRow
                        key={item.id}
                        title={item.title}
                        meta={`${item.subject_name} · due ${dateOnly(item.due_date)} · ${item.total_marks} marks`}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyPad}>
                      <EmptyState text="Nothing is outstanding. The child has submitted everything on the list." />
                    </View>
                  )}
                </Card>
              ) : null}

              {scope.has("notice") ? (
                <Card padded={false}>
                  <Headline title="Notices for the class" onPress={() => router.push("/notices" as never)} />
                  {student.recent_notices.length ? (
                    student.recent_notices.map((notice) => (
                      <DataRow
                        key={notice.id}
                        title={notice.title}
                        meta={`${dateOnly(notice.published_at)}${notice.is_read ? "" : " · new"}`}
                        right={notice.priority !== "NORMAL" ? <Chip label={statusLabel(notice.priority)} tone={notice.priority === "URGENT" ? "danger" : "warning"} /> : undefined}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyPad}>
                      <EmptyState text="Nothing has been posted to this board yet." />
                    </View>
                  )}
                </Card>
              ) : null}

              {profile.data ? (
                <Card>
                  <Text style={styles.cardTitle}>Who to contact</Text>
                  <FactRow label="Class teacher" value={profile.data.class_teacher_name ?? "Not assigned yet"} />
                  <FactRow label="Class teacher email" value={profile.data.class_teacher_email ?? "Not on record"} />
                  <FactRow label="Mentor" value={profile.data.mentor_name ?? "None assigned"} />
                  <FactRow label="Hostel room" value={profile.data.hostel_room ?? "Not a resident"} />
                  <FactRow label="Transport" value={profile.data.transport_route ?? "Not on a route"} />
                  <Text style={styles.footnote}>
                    Absence, marks and fees are corrected by the office — this portal is read-only on purpose, so
                    a fix made here could not be audited.
                  </Text>
                </Card>
              ) : null}

              <Link href="/attendance" style={styles.textLink}>
                Attendance and leave
              </Link>
            </View>
          ) : null}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

function Headline({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View style={styles.headline}>
      <Text style={styles.headlineText}>{title}</Text>
      <Text onPress={onPress} accessibilityRole="button" style={styles.headlineAction}>
        Open
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  headline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headlineText: { fontSize: 15, fontWeight: "800", color: Colors.primary, flex: 1 },
  headlineAction: { fontSize: 12, fontWeight: "700", color: Colors.accent, padding: 4 },
  emptyPad: { paddingHorizontal: 12, paddingBottom: 12 },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground, marginTop: 8 },
  textLink: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "700",
    color: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
});
