/**
 * Teacher single team workspace — port of TeacherTeamWorkspaceView.
 */

import { useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  FileText,
  FolderGit2,
  Link2,
  ListTodo,
  MessageSquare,
  Users,
} from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { StatusPill } from "@/components/teacher-ui";
import { Card } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { fetchTeacherTeamWorkspace } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

type Tab = "tasks" | "messages" | "resources" | "members";

export default function TeacherTeamWorkspacePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? "";
  const resource = useResource(
    () => (groupId ? fetchTeacherTeamWorkspace(groupId) : Promise.reject(new Error("No team ID provided"))),
    [groupId],
  );
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const data = resource.data;

  return (
    <Screen>
      <Link href="/(teacher)/teams" style={styles.back}>
        <ArrowLeft size={14} color={Colors.mutedForeground} /> Back to Project Teams
      </Link>
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading team workspace…"
      >
        {data ? (
          <View style={styles.stack}>
            <Card>
              <View style={styles.head}>
                <Text style={styles.title}>{data.group.name}</Text>
                <StatusPill label={`${data.group.member_count} Students`} tone="accent" />
                {data.group.is_submitted ? (
                  <View style={styles.submitted}>
                    <CheckCircle2 size={14} color={Colors.successText} />
                    <Text style={styles.submittedText}>Submitted</Text>
                  </View>
                ) : (
                  <View style={styles.inProgress}>
                    <Clock size={14} color={Colors.mutedForeground} />
                    <Text style={styles.inProgressText}>In Progress</Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>
                Project: {data.assignment_title} · {data.class_name} ({data.subject_name})
              </Text>
              {data.submission ? (
                <Link
                  href={{ pathname: "/(teacher)/submissions/[id]", params: { id: data.submission.id } }}
                  style={styles.review}
                >
                  <FileText size={14} color="#FFFFFF" /> Review Group Submission
                </Link>
              ) : null}
              <View style={styles.tabs}>
                {(
                  [
                    ["tasks", "Team Tasks", ListTodo, data.tasks.length],
                    ["messages", "Team Chat", MessageSquare, data.messages.length],
                    ["resources", "Shared Links", FolderGit2, data.resources.length],
                    ["members", "Members", Users, data.group.members.length],
                  ] as const
                ).map(([key, label, Icon, count]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActiveTab(key)}
                    style={[styles.tab, activeTab === key && styles.tabOn]}
                  >
                    <Icon size={14} color={activeTab === key ? "#FFFFFF" : Colors.mutedForeground} />
                    <Text style={[styles.tabLabel, activeTab === key && styles.tabLabelOn]}>
                      {label} ({count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {activeTab === "tasks" ? (
              <View style={styles.stack}>
                <Text style={styles.section}>Student Task Breakdown</Text>
                {data.tasks.length === 0 ? (
                  <Card>
                    <Text style={styles.empty}>The team has not created any subtasks yet.</Text>
                  </Card>
                ) : (
                  (["TODO", "IN_PROGRESS", "DONE"] as const).map((statusKey) => {
                    const colTasks = data.tasks.filter((t) => t.status === statusKey);
                    return (
                      <Card key={statusKey} padded={false} style={styles.col}>
                        <View style={styles.colHead}>
                          <Text style={styles.colTitle}>
                            {statusKey === "TODO" ? "To Do" : statusKey === "IN_PROGRESS" ? "In Progress" : "Completed"}
                          </Text>
                          <Text style={styles.colCount}>{colTasks.length}</Text>
                        </View>
                        <View style={styles.colBody}>
                          {colTasks.map((t) => (
                            <View key={t.id} style={styles.task}>
                              <Text style={styles.taskTitle}>{t.title}</Text>
                              {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                              <Text style={styles.taskMeta}>
                                {t.assignee_name ? `Assigned: ${t.assignee_name}` : "Unassigned"}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </Card>
                    );
                  })
                )}
              </View>
            ) : null}

            {activeTab === "messages" ? (
              <View style={styles.stack}>
                <Text style={styles.section}>Team Discussion Log</Text>
                <Card>
                  {data.messages.length === 0 ? (
                    <Text style={styles.empty}>No discussion messages logged by the team.</Text>
                  ) : (
                    data.messages.map((m) => (
                      <View key={m.id} style={styles.message}>
                        <View style={styles.messageHead}>
                          <Text style={styles.sender}>{m.sender_name}</Text>
                          <Text style={styles.when}>{dateTime(m.created_at)}</Text>
                        </View>
                        <Text style={styles.messageBody}>{m.message}</Text>
                      </View>
                    ))
                  )}
                </Card>
              </View>
            ) : null}

            {activeTab === "resources" ? (
              <View style={styles.stack}>
                <Text style={styles.section}>Team Links & Repositories</Text>
                {data.resources.length === 0 ? (
                  <Card>
                    <Text style={styles.empty}>No resources shared by this team.</Text>
                  </Card>
                ) : (
                  data.resources.map((r) => (
                    <Card key={r.id}>
                      <View style={styles.resource}>
                        <View style={styles.resourceIcon}>
                          {r.resource_type === "REPO" ? (
                            <FolderGit2 size={16} color={Colors.primary} />
                          ) : (
                            <Link2 size={16} color={Colors.primary} />
                          )}
                        </View>
                        <View style={styles.resourceText}>
                          <Text style={styles.resourceTitle} onPress={() => Linking.openURL(r.url)}>
                            {r.title} <ExternalLink size={12} color={Colors.accent} />
                          </Text>
                          <Text style={styles.resourceMeta}>Added by {r.creator_name || "Student"}</Text>
                        </View>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            ) : null}

            {activeTab === "members" ? (
              <View style={styles.stack}>
                <Text style={styles.section}>Team Members</Text>
                {data.group.members.map((m) => (
                  <Card key={m.student_id}>
                    <View style={styles.member}>
                      <View>
                        <Text style={styles.memberName}>{m.student_name}</Text>
                        {m.roll_number ? <Text style={styles.memberRoll}>Roll No: {m.roll_number}</Text> : null}
                      </View>
                      {data.group.created_by === m.student_id ? (
                        <View style={styles.leader}>
                          <Crown size={12} color={Colors.amber600} />
                          <Text style={styles.leaderText}>Leader</Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    marginBottom: 16,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  stack: {
    gap: 16,
  },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
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
    fontSize: 12,
    fontWeight: "700",
    color: Colors.successText,
  },
  inProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inProgressText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  review: {
    alignSelf: "flex-start",
    marginTop: 12,
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    ...Shadow.accent,
  },
  tabs: {
    marginTop: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.field,
    backgroundColor: "rgba(241,245,249,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabOn: {
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
  section: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  empty: {
    fontSize: 12,
    textAlign: "center",
    color: Colors.mutedForeground,
    paddingVertical: 16,
  },
  col: {
    overflow: "hidden",
  },
  colHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  colCount: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  colBody: {
    padding: 12,
    gap: 8,
  },
  task: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 10,
    gap: 4,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  taskDesc: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  taskMeta: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  message: {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.7)",
  },
  messageHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  sender: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  when: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  messageBody: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.primary,
  },
  resource: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resourceIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceText: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  resourceMeta: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  memberRoll: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  leader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.amber50,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  leaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.amber700,
  },
});
