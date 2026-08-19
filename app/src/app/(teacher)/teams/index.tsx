/**
 * Teacher teams list — port of TeacherTeamsList.
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { FileText, Users } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { TeacherGroupsSection } from "@/components/teacher-groups";
import { Card, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { fetchTeacherAssignment, fetchTeacherAssignments } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function TeacherTeamsList() {
  const resource = useResource(() => fetchTeacherAssignments({ limit: 100 }), []);
  const assignments = (resource.data?.items ?? []).filter((a) => a.assignment_type === "GROUP");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const activeAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId)
    : assignments[0];
  const detail = useResource(
    () => (activeAssignment ? fetchTeacherAssignment(activeAssignment.id) : Promise.resolve(null)),
    [activeAssignment?.id],
  );

  return (
    <Screen>
      <PageHeader
        title="Project Teams & Group Workspaces"
        subtitle="Monitor student project teams, collaborate on group tasks, review team discussions, and manage rosters."
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading group assignments…"
      >
        {assignments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Users size={24} color={Colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No Group Projects Found</Text>
            <Text style={styles.emptyText}>
              You haven't created any group assignments yet. Create an assignment with type "Group Project" to form
              teams!
            </Text>
            <Link href="/(teacher)/assignments/new" style={styles.create}>
              Create Group Assignment
            </Link>
          </Card>
        ) : (
          <View style={styles.stack}>
            <View style={styles.tabs}>
              {assignments.map((a) => {
                const isSelected = activeAssignment?.id === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setSelectedAssignmentId(a.id)}
                    style={[styles.tab, isSelected && styles.tabOn]}
                  >
                    <Text style={[styles.tabLabel, isSelected && styles.tabLabelOn]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={[styles.tabClass, isSelected && styles.tabClassOn]}>{a.class_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {activeAssignment ? (
              <View style={styles.stack}>
                <Card>
                  <Text style={styles.projectTitle}>{activeAssignment.title}</Text>
                  <Text style={styles.projectMeta}>
                    {activeAssignment.subject_code} · {activeAssignment.subject_name} · Class:{" "}
                    {activeAssignment.class_name} · Due: {dateTime(activeAssignment.due_date)} ·{" "}
                    {activeAssignment.group_count} Teams Formed
                  </Text>
                  <Link
                    href={{ pathname: "/(teacher)/assignments/[id]", params: { id: activeAssignment.id } }}
                    style={styles.detailLink}
                  >
                    <FileText size={14} color={Colors.primary} /> Assignment Details
                  </Link>
                </Card>
                <TeacherGroupsSection
                  assignmentId={activeAssignment.id}
                  minGroupSize={detail.data?.min_group_size ?? 2}
                  maxGroupSize={detail.data?.max_group_size ?? 6}
                />
              </View>
            ) : null}
          </View>
        )}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 320,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: Colors.mutedForeground,
  },
  create: {
    marginTop: 16,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    ...Shadow.accent,
  },
  stack: {
    gap: 16,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  tabLabelOn: {
    color: "#FFFFFF",
  },
  tabClass: {
    marginTop: 2,
    fontSize: 10,
    color: Colors.primary,
  },
  tabClassOn: {
    color: "rgba(255,255,255,0.85)",
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  projectMeta: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  detailLink: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
});
