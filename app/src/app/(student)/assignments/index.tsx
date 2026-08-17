/**
 * C-ST-10 assignments — port of StudentAssignmentsPage in
 * fontend/components/student/student-assignments.tsx: assignment list with
 * the student's own status on each row.
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchStudentAssignments, type StudentAssignmentRow } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const STATUS_FILTERS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["SUBMITTED", "Submitted"],
  ["UNDER_REVIEW", "Under review"],
  ["APPROVED", "Approved"],
  ["RESUBMIT_REQUESTED", "Changes requested"],
] as const;

export function myStatusClass(status: string): { backgroundColor: string; color: string } {
  if (status === "APPROVED") return { backgroundColor: Colors.successLight, color: Colors.successText };
  if (status === "REJECTED") return { backgroundColor: Colors.destructiveLight, color: Colors.destructiveText };
  if (status === "RESUBMIT_REQUESTED") return { backgroundColor: Colors.warningLight, color: Colors.warningText };
  if (status === "UNDER_REVIEW" || status === "SUBMITTED") return { backgroundColor: Colors.accentLight, color: Colors.accent };
  return { backgroundColor: Colors.muted, color: Colors.mutedForeground };
}

export default function StudentAssignmentsPage() {
  const [status, setStatus] = useState<string>("");
  const resource = useResource(
    () => fetchStudentAssignments({ status: status || undefined, limit: 100 }),
    [status],
  );

  return (
    <Screen>
      <PageHeader title="Assignments" subtitle="Everything your teachers published for your class, due soonest first." />
      <View style={styles.filters}>
        {STATUS_FILTERS.map(([value, label]) => (
          <TouchableOpacity
            key={value || "ALL"}
            accessibilityState={{ selected: status === value }}
            onPress={() => setStatus(value)}
            style={[styles.filter, status === value && styles.filterActive]}
          >
            <Text style={[styles.filterLabel, status === value && styles.filterLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your assignments…"
      >
        {resource.data ? (
          <Card padded={false}>
            {resource.data.items.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, styles.colTitle]}>Assignment</Text>
                    <Text style={[styles.th, styles.colSubject]}>Subject</Text>
                    <Text style={[styles.th, styles.colDue]}>Due</Text>
                    <Text style={[styles.th, styles.colStatus]}>My status</Text>
                    <Text style={[styles.th, styles.colScore]}>Score</Text>
                    <Text style={[styles.th, styles.colAction]}> </Text>
                  </View>
                  {resource.data.items.map((assignment) => (
                    <AssignmentRow key={assignment.id} assignment={assignment} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <EmptyTable text="No assignments match this filter." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function AssignmentRow({ assignment }: { assignment: StudentAssignmentRow }) {
  const badge = myStatusClass(assignment.my_status);
  return (
    <View style={styles.tableRow}>
      <View style={styles.colTitle}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.sub}>
          {statusLabel(assignment.assignment_type)} · {assignment.total_marks} marks ·{" "}
          {assignment.teacher_name ?? "Teacher"}
        </Text>
      </View>
      <Text style={[styles.td, styles.colSubject]}>{assignment.subject_code}</Text>
      <View style={styles.colDue}>
        <Text style={styles.tdInner}>{dateTime(assignment.due_date)}</Text>
        {assignment.is_late ? <Text style={styles.lateText}>Submitted late</Text> : null}
      </View>
      <View style={styles.colStatus}>
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{statusLabel(assignment.my_status)}</Text>
        </View>
      </View>
      <Text style={[styles.td, styles.colScore, { fontWeight: "600", color: Colors.primary }]}>
        {assignment.my_score !== null ? assignment.my_score : "—"}
      </Text>
      <View style={styles.colAction}>
        <Link
          href={{ pathname: "/(student)/assignments/[id]/index", params: { id: assignment.id } }}
          style={styles.openLink}
        >
          {assignment.my_status === "PENDING" || assignment.my_status === "RESUBMIT_REQUESTED" ? "Submit" : "Open"}
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  filter: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  filterLabelActive: {
    color: Colors.accent,
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
    paddingVertical: 12,
  },
  colTitle: { width: 240, paddingHorizontal: 20 },
  colSubject: { width: 90, paddingHorizontal: 20, fontSize: 14, color: Colors.mutedForeground },
  colDue: { width: 160, paddingHorizontal: 20 },
  colStatus: { width: 150, paddingHorizontal: 20 },
  colScore: { width: 70, paddingHorizontal: 20, fontSize: 14 },
  colAction: { width: 80, paddingHorizontal: 20, alignItems: "flex-end" },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  sub: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  td: {
    fontSize: 14,
  },
  tdInner: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  lateText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.warningText,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  openLink: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
});
