/**
 * C-TC-12 — every assignment this teacher created.
 */

import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Plus, Send } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import {
  FilterChips,
  PrimaryButton,
  StatusPill,
  assignmentStatusTone,
} from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchTeacherAssignments, publishTeacherAssignment } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
];

export default function TeacherAssignmentsPage() {
  const [status, setStatus] = useState("");
  const [busyPublishId, setBusyPublishId] = useState<string | null>(null);
  const resource = useResource(
    () => fetchTeacherAssignments({ status: status || undefined, limit: 100 }),
    [status],
  );

  return (
    <Screen>
      <PageHeader
        title="Assignments"
        subtitle="Assignments you created for your classes, with submission progress."
        action={
          <Link href="/(teacher)/assignments/new" style={styles.create}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createLabel}>Create assignment</Text>
          </Link>
        }
      />
      <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your assignments…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((assignment) => (
                <Card key={assignment.id}>
                  <View style={styles.top}>
                    <Text style={styles.title}>{assignment.title}</Text>
                    <StatusPill label={statusLabel(assignment.status)} tone={assignmentStatusTone(assignment.status)} />
                  </View>
                  <Text style={styles.sub}>
                    {statusLabel(assignment.assignment_type)} · {assignment.total_marks} marks
                    {assignment.milestone_count ? ` · ${assignment.milestone_count} milestones` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {assignment.class_name} · {assignment.subject_code} · due {dateTime(assignment.due_date)}
                  </Text>
                  <Text style={styles.meta}>
                    {assignment.submission_count}/{assignment.student_count} submitted
                    {assignment.pending_review_count
                      ? ` · ${assignment.pending_review_count} to review`
                      : ""}
                  </Text>
                  <View style={styles.actions}>
                    {assignment.status === "DRAFT" ? (
                      <PrimaryButton
                        label={busyPublishId === assignment.id ? "Publishing…" : "Publish"}
                        icon={Send}
                        loading={busyPublishId === assignment.id}
                        onPress={async () => {
                          setBusyPublishId(assignment.id);
                          try {
                            await publishTeacherAssignment(assignment.id);
                            await resource.reload();
                          } catch (err) {
                            Alert.alert(
                              "Could not publish",
                              err instanceof Error ? err.message : "Could not publish assignment",
                            );
                          } finally {
                            setBusyPublishId(null);
                          }
                        }}
                      />
                    ) : null}
                    <Link
                      href={{ pathname: "/(teacher)/assignments/[id]", params: { id: assignment.id } }}
                      style={styles.open}
                    >
                      {assignment.status === "DRAFT" ? "Edit" : "Open"}
                    </Link>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Card padded={false}>
              <EmptyTable text="No assignments here yet. Create your first assignment." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  create: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  createLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  list: {
    gap: 12,
  },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  open: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
});
