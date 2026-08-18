/**
 * Teacher groups section — mobile port of TeacherGroupsSection in
 * fontend/components/assignment/group-management.tsx.
 */

import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { CheckCircle2, Crown, ShieldAlert, UserMinus, Users } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { OutlineButton, StatusPill } from "@/components/teacher-ui";
import { Card } from "@/components/ui";
import { fetchTeacherAssignmentGroups, removeStudentFromGroup } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export function TeacherGroupsSection({
  assignmentId,
  minGroupSize,
  maxGroupSize,
}: {
  assignmentId: string;
  minGroupSize: number;
  maxGroupSize: number;
}) {
  const resource = useResource(() => fetchTeacherAssignmentGroups(assignmentId), [assignmentId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = resource.data?.items ?? [];

  function handleRemoveMember(groupId: string, studentId: string, studentName: string) {
    Alert.alert("Remove student", `Remove ${studentName} from this group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(`rm-${studentId}`);
          setError(null);
          try {
            await removeStudentFromGroup(assignmentId, groupId, studentId);
            await resource.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to remove student");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={20} color={Colors.accent} />
          <Text style={styles.title}>Student Project Groups</Text>
        </View>
        <StatusPill label={`${minGroupSize}–${maxGroupSize} students/group`} tone="muted" />
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <ShieldAlert size={16} color={Colors.destructiveText} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading groups…">
        {groups.length ? (
          <View style={styles.list}>
            {groups.map((group) => (
              <View key={group.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <View style={styles.groupHeadText}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMeta}>
                      Created by {group.creator_name ?? "Student"} · {group.member_count}/{maxGroupSize} members
                    </Text>
                  </View>
                  {group.is_submitted ? (
                    <View style={styles.submitted}>
                      <CheckCircle2 size={12} color={Colors.successText} />
                      <Text style={styles.submittedText}>Submitted</Text>
                    </View>
                  ) : (
                    <StatusPill label="Forming" tone="muted" />
                  )}
                </View>
                <Text style={styles.membersLabel}>Members</Text>
                {group.members.map((m) => (
                  <View key={m.student_id} style={styles.member}>
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{m.student_name}</Text>
                      {m.roll_number ? <Text style={styles.memberRoll}>({m.roll_number})</Text> : null}
                      {group.created_by === m.student_id ? <Crown size={12} color={Colors.amber600} /> : null}
                    </View>
                    <OutlineButton
                      label=""
                      icon={UserMinus}
                      danger
                      disabled={busy === `rm-${m.student_id}`}
                      onPress={() => handleRemoveMember(group.id, m.student_id, m.student_name)}
                    />
                  </View>
                ))}
                <Link href={{ pathname: "/(teacher)/teams/[id]", params: { id: group.id } }} style={styles.workspace}>
                  Open workspace
                </Link>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Users size={32} color={Colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No student groups created yet</Text>
            <Text style={styles.emptyText}>Students enrolled in this class will form their groups here.</Text>
          </View>
        )}
      </AsyncState>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: Colors.destructiveLight,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.destructiveText,
  },
  list: {
    gap: 12,
  },
  group: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  groupHeadText: {
    flex: 1,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  groupMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  submitted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  submittedText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.successText,
  },
  membersLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "rgba(241,245,249,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  memberText: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  memberRoll: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  workspace: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
});
