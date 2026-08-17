/**
 * C-ST-03 attendance — port of fontend/components/student/student-attendance.tsx
 * (StudentAttendancePage): overall + per-subject attendance, own leave requests.
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { Plus, X } from "lucide-react-native";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, dateTime, percent, statusLabel } from "@/lib/format";
import {
  cancelStudentLeave,
  fetchStudentAttendance,
  fetchStudentLeaves,
  type StudentLeaveRow,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentAttendancePage() {
  const summary = useResource(fetchStudentAttendance, []);
  const leaves = useResource(() => fetchStudentLeaves({ limit: 100 }), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel(leaveId: string) {
    setBusyId(leaveId);
    setActionError(null);
    try {
      const updated = await cancelStudentLeave(leaveId);
      if (leaves.data) {
        leaves.setData({ ...leaves.data, items: leaves.data.items.map((leave) => (leave.id === leaveId ? updated : leave)) });
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not cancel this leave request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="My attendance"
        subtitle="Your presence across subjects, and your leave applications."
        action={
          <View style={styles.headerActions}>
            <Link href="/(student)/attendance/calendar" style={styles.secondaryAction}>
              Calendar view
            </Link>
            <Link href="/(student)/attendance/leaves/new" asChild>
              <TouchableOpacity style={styles.primaryAction}>
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionLabel}>Apply for leave</Text>
              </TouchableOpacity>
            </Link>
          </View>
        }
      />
      <AsyncState
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.reload}
        loadingLabel="Loading your attendance…"
      >
        {summary.data ? (
          <View style={styles.stack}>
            <View style={styles.metrics}>
              <MetricCard
                label="Overall attendance"
                value={summary.data.attendance_percentage !== null ? percent(summary.data.attendance_percentage) : "—"}
                hint={`${summary.data.total_marks} sessions marked`}
                tone={
                  summary.data.attendance_percentage === null
                    ? "default"
                    : summary.data.attendance_percentage < 75
                      ? "warning"
                      : "success"
                }
              />
              <MetricCard label="Present" value={summary.data.present_count} tone="success" hint="Sessions attended" />
              <MetricCard label="Absent" value={summary.data.absent_count} hint="Sessions missed" tone={summary.data.absent_count ? "warning" : "default"} />
              <MetricCard label="Late / excused" value={summary.data.late_count + summary.data.excused_count} hint="Counted as attended" />
            </View>
            <Card padded={false}>
              {summary.data.subjects.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={styles.tableHead}>
                      <Text style={[styles.th, styles.colSubject]}>Subject</Text>
                      <Text style={styles.th}>Present</Text>
                      <Text style={styles.th}>Absent</Text>
                      <Text style={styles.th}>Late</Text>
                      <Text style={styles.th}>Excused</Text>
                      <Text style={styles.th}>Attendance</Text>
                    </View>
                    {summary.data.subjects.map((subject) => (
                      <View key={subject.subject_id} style={styles.tableRow}>
                        <View style={styles.colSubject}>
                          <Text style={styles.subjectName}>{subject.subject_name}</Text>
                          <Text style={styles.subjectCode}>{subject.subject_code}</Text>
                        </View>
                        <Text style={[styles.td, styles.presentCell]}>{subject.present_count}</Text>
                        <Text style={[styles.td, styles.absentCell]}>{subject.absent_count}</Text>
                        <Text style={[styles.td, styles.lateCell]}>{subject.late_count}</Text>
                        <Text style={[styles.td, styles.excusedCell]}>{subject.excused_count}</Text>
                        <Text style={[styles.td, styles.percentCell]}>
                          {subject.attendance_percentage !== null ? percent(subject.attendance_percentage) : "—"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.tableEmpty}>
                  <EmptyState text="No attendance has been marked for you yet." />
                </View>
              )}
            </Card>
          </View>
        ) : null}
      </AsyncState>

      <View style={styles.leavesSection}>
        <Text style={styles.leavesTitle}>My leave requests</Text>
        {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
        <AsyncState
          loading={leaves.loading}
          error={leaves.error}
          onRetry={leaves.reload}
          loadingLabel="Loading leave requests…"
        >
          {leaves.data ? (
            leaves.data.items.length ? (
              <View style={styles.leaveList}>
                {leaves.data.items.map((leave) => (
                  <LeaveCard key={leave.id} leave={leave} busy={busyId === leave.id} onCancel={() => cancel(leave.id)} />
                ))}
              </View>
            ) : (
              <Card>
                <EmptyState text="You have not applied for leave yet." />
              </Card>
            )
          ) : null}
        </AsyncState>
      </View>
    </Screen>
  );
}

function LeaveCard({ leave, busy, onCancel }: { leave: StudentLeaveRow; busy: boolean; onCancel: () => void }) {
  return (
    <Card>
      <View style={styles.leaveRow}>
        <View style={styles.leaveText}>
          <View style={styles.leaveHeading}>
            <Text style={styles.leaveDates}>
              {dateOnly(leave.from_date)} → {dateOnly(leave.to_date)}
            </Text>
            <LeaveBadge status={leave.status} />
          </View>
          <Text style={styles.leaveReason}>{leave.reason}</Text>
          <Text style={styles.leaveMeta}>
            Applied {dateTime(leave.created_at)}
            {leave.reviewed_at ? ` · Reviewed ${dateTime(leave.reviewed_at)}` : ""}
          </Text>
        </View>
        {leave.status === "PENDING" ? (
          <TouchableOpacity disabled={busy} onPress={onCancel} style={styles.leaveCancel}>
            <X size={14} color={Colors.destructiveText} />
            <Text style={styles.leaveCancelLabel}>{busy ? "Cancelling…" : "Cancel"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

function LeaveBadge({ status }: { status: string }) {
  const style =
    status === "PENDING"
      ? { backgroundColor: Colors.warningLight, color: Colors.warningText }
      : status === "APPROVED"
        ? { backgroundColor: Colors.successLight, color: Colors.successText }
        : status === "REJECTED"
          ? { backgroundColor: Colors.destructiveLight, color: Colors.destructiveText }
          : { backgroundColor: Colors.muted, color: Colors.mutedForeground };
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: style.color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  secondaryAction: {
    height: 40,
    lineHeight: 38,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    overflow: "hidden",
    backgroundColor: Colors.background,
    textAlign: "center",
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  primaryActionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  stack: {
    gap: 24,
  },
  metrics: {
    gap: 16,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colSubject: {
    width: 180,
  },
  subjectName: {
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  subjectCode: {
    paddingHorizontal: 20,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  td: {
    width: 80,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
  },
  presentCell: { color: Colors.successText },
  absentCell: { color: Colors.destructiveText },
  lateCell: { color: Colors.warningText },
  excusedCell: { color: Colors.mutedForeground },
  percentCell: { color: Colors.primary, fontWeight: "600" },
  tableEmpty: {
    padding: 24,
  },
  leavesSection: {
    marginTop: 32,
  },
  leavesTitle: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  actionError: {
    marginBottom: 12,
    fontSize: 14,
    color: Colors.destructiveText,
  },
  leaveList: {
    gap: 12,
  },
  leaveRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  leaveText: {
    flex: 1,
  },
  leaveHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  leaveDates: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  leaveReason: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  leaveMeta: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  leaveCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    paddingHorizontal: 12,
  },
  leaveCancelLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.destructiveText,
  },
});
