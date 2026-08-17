/**
 * Project Teams hub — port of StudentTeamsList in
 * fontend/components/student/student-teams.tsx: incoming invitations, team
 * metrics and the team cards.
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import {
  Check,
  CheckCircle2,
  Clock,
  Crown,
  LoaderCircle,
  Mail,
  Plus,
  Users,
  X,
} from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui";
import { dateTime } from "@/lib/format";
import {
  fetchMyInvitations,
  fetchMyTeams,
  respondToInvitation,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentTeamsListPage() {
  const resource = useResource(fetchMyTeams, []);
  const invitesResource = useResource(fetchMyInvitations, []);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const teams = resource.data ?? [];
  const invites = invitesResource.data ?? [];

  const activeCount = teams.filter((t) => !t.is_submitted).length;
  const submittedCount = teams.filter((t) => t.is_submitted).length;
  const leadingCount = teams.filter((t) => t.is_leader).length;

  async function handleRespondInvite(inviteId: string, action: "ACCEPT" | "REJECT") {
    setBusyInviteId(inviteId);
    setActionError(null);
    try {
      await respondToInvitation(inviteId, action);
      await Promise.all([resource.reload(), invitesResource.reload()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to process invitation");
    } finally {
      setBusyInviteId(null);
    }
  }

  return (
    <Screen>
      <View style={styles.stack}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.h1}>Project Teams &amp; Workspaces</Text>
            <Text style={styles.subtitle}>
              Manage your project groups, coordinate tasks with teammates, share resources, and submit group
              assignments.
            </Text>
          </View>
          <Link href="/(student)/assignments" asChild>
            <TouchableOpacity style={styles.viewProjects}>
              <Plus size={14} color={Colors.primary} />
              <Text style={styles.viewProjectsLabel}>View Available Group Projects</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {actionError ? <View style={styles.actionError}><Text style={styles.actionErrorText}>{actionError}</Text></View> : null}

        {/* Incoming Invitations Banner */}
        {invites.length > 0 ? (
          <Card style={styles.invitesCard}>
            <View style={styles.invitesHeader}>
              <View style={styles.invitesIcon}>
                <Mail size={14} color="#FFFFFF" />
              </View>
              <View style={styles.invitesHeaderText}>
                <Text style={styles.invitesTitle}>Incoming Team Invitations ({invites.length})</Text>
                <Text style={styles.invitesSubtitle}>
                  You have been invited by team leaders to join project teams.
                </Text>
              </View>
            </View>

            <View style={styles.invitesGrid}>
              {invites.map((inv) => (
                <View key={inv.id} style={styles.inviteCard}>
                  <View>
                    <View style={styles.inviteTop}>
                      <Text style={styles.inviteGroup}>{inv.group_name}</Text>
                      <Text style={styles.inviteDate}>{dateTime(inv.created_at)}</Text>
                    </View>
                    <Text style={styles.inviteSubject}>
                      {inv.subject_name} · {inv.assignment_title}
                    </Text>
                    <Text style={styles.inviteBy}>
                      Invited by <Text style={styles.inviteByName}>{inv.inviter_name}</Text> (Team Leader)
                    </Text>
                  </View>

                  <View style={styles.inviteActions}>
                    <TouchableOpacity
                      disabled={busyInviteId === inv.id}
                      onPress={() => handleRespondInvite(inv.id, "ACCEPT")}
                      style={[styles.acceptButton, busyInviteId === inv.id && styles.disabled]}
                    >
                      {busyInviteId === inv.id ? (
                        <LoaderCircle size={12} color="#FFFFFF" />
                      ) : (
                        <Check size={12} color="#FFFFFF" />
                      )}
                      <Text style={styles.acceptLabel}>Accept &amp; Join</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busyInviteId === inv.id}
                      onPress={() => handleRespondInvite(inv.id, "REJECT")}
                      style={[styles.declineButton, busyInviteId === inv.id && styles.disabled]}
                    >
                      <X size={12} color={Colors.mutedForeground} />
                      <Text style={styles.declineLabel}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Metrics */}
        <View style={styles.metrics}>
          <Card style={styles.metric}>
            <View style={[styles.metricIcon, { backgroundColor: Colors.accentLight }]}>
              <Users size={20} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.metricValue}>{teams.length}</Text>
              <Text style={styles.metricLabel}>Total Teams ({activeCount} active)</Text>
            </View>
          </Card>
          <Card style={styles.metric}>
            <View style={[styles.metricIcon, { backgroundColor: Colors.amber50 }]}>
              <Crown size={20} color={Colors.amber600} />
            </View>
            <View>
              <Text style={styles.metricValue}>{leadingCount}</Text>
              <Text style={styles.metricLabel}>Teams You Lead</Text>
            </View>
          </Card>
          <Card style={styles.metric}>
            <View style={[styles.metricIcon, { backgroundColor: Colors.successLight }]}>
              <CheckCircle2 size={20} color={Colors.successText} />
            </View>
            <View>
              <Text style={styles.metricValue}>{submittedCount}</Text>
              <Text style={styles.metricLabel}>Submitted Projects</Text>
            </View>
          </Card>
        </View>

        {/* Team Cards */}
        <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your teams…">
          {teams.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Users size={24} color={Colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Teams Formed Yet</Text>
              <Text style={styles.emptyBody}>
                You are not currently enrolled in any project teams. Open a group assignment to form or join a team!
              </Text>
              <Link href="/(student)/assignments" asChild>
                <TouchableOpacity style={styles.browseButton}>
                  <Text style={styles.browseButtonLabel}>Browse Group Assignments</Text>
                </TouchableOpacity>
              </Link>
            </Card>
          ) : (
            <View style={styles.teamsGrid}>
              {teams.map((team) => (
                <Card key={team.group_id} style={styles.teamCard}>
                  <View style={styles.teamBody}>
                    <View style={styles.teamTop}>
                      <View style={styles.teamTitleWrap}>
                        <View style={styles.teamTitleRow}>
                          <Text style={styles.teamName}>{team.group_name}</Text>
                          {team.is_leader ? (
                            <View style={[styles.leaderChip]}>
                              <Crown size={12} color="#F59E0B" />
                              <Text style={styles.leaderChipText}>Leader</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.teamSubject}>
                          {team.subject_code} · {team.subject_name}
                        </Text>
                      </View>

                      {team.is_submitted ? (
                        <View style={[styles.statusPill, { backgroundColor: Colors.successLight }]}>
                          <CheckCircle2 size={14} color={Colors.successText} />
                          <Text style={[styles.statusPillText, { color: Colors.successText }]}>Submitted</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: Colors.muted }]}>
                          <Clock size={12} color={Colors.mutedForeground} />
                          <Text style={[styles.statusPillText, { color: Colors.mutedForeground, fontWeight: "500" }]}>
                            In Progress
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.assignmentBox}>
                      <Text style={styles.assignmentTitle} numberOfLines={1}>
                        {team.assignment_title}
                      </Text>
                      <View style={styles.assignmentMeta}>
                        <Text style={styles.assignmentMetaText}>Due: {dateTime(team.due_date)}</Text>
                        <Text style={styles.assignmentMetaText}>Total Marks: {team.total_marks}</Text>
                      </View>
                    </View>

                    <View>
                      <Text style={styles.membersTitle}>
                        Team Members ({team.member_count}/{team.max_group_size})
                      </Text>
                      <View style={styles.membersChips}>
                        {team.members.map((m) => (
                          <View
                            key={m.student_id}
                            style={[
                              styles.memberChip,
                              m.is_me ? { backgroundColor: Colors.accentLight } : { backgroundColor: Colors.muted },
                            ]}
                          >
                            <Text
                              style={[
                                styles.memberChipText,
                                m.is_me ? { color: Colors.accent, fontWeight: "700" } : { color: Colors.mutedForeground },
                              ]}
                            >
                              {m.student_name} {m.is_me ? "(You)" : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.teamFooter}>
                    <Text style={styles.teamTeacher}>
                      {team.teacher_name ? `Teacher: ${team.teacher_name}` : "Faculty Assigned"}
                    </Text>
                    <Link href={{ pathname: "/(student)/teams/[id]", params: { id: team.group_id } }} asChild>
                      <TouchableOpacity style={styles.openWorkspace}>
                        <Text style={styles.openWorkspaceLabel}>Open Workspace</Text>
                      </TouchableOpacity>
                    </Link>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </AsyncState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  headerRow: {
    gap: 16,
  },
  headerText: {},
  h1: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  viewProjects: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
  },
  viewProjectsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  actionError: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: Colors.destructiveLight,
    padding: 12,
  },
  actionErrorText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.destructiveText,
  },
  invitesCard: {
    borderColor: "rgba(79,70,229,0.4)",
    backgroundColor: "rgba(238,242,255,0.3)",
  },
  invitesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  invitesIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  invitesHeaderText: {
    flex: 1,
  },
  invitesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  invitesSubtitle: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  invitesGrid: {
    gap: 12,
  },
  inviteCard: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12,
  },
  inviteTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inviteGroup: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  inviteDate: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  inviteSubject: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: Colors.accent,
  },
  inviteBy: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  inviteByName: {
    fontWeight: "600",
    color: Colors.primary,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.6)",
    paddingTop: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    ...Shadow.accent,
  },
  acceptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  declineLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  disabled: {
    opacity: 0.6,
  },
  metrics: {
    gap: 12,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.primary,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
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
  emptyBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
    textAlign: "center",
    maxWidth: 384,
  },
  browseButton: {
    marginTop: 16,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.accent,
  },
  browseButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  teamsGrid: {
    gap: 16,
  },
  teamCard: {
    gap: 16,
  },
  teamBody: {
    gap: 12,
  },
  teamTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  teamTitleWrap: {
    flex: 1,
  },
  teamTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  leaderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.amber50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  leaderChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.amber700,
  },
  teamSubject: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: Colors.accent,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  assignmentBox: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.6)",
    backgroundColor: "rgba(241,245,249,0.2)",
    padding: 10,
    gap: 4,
  },
  assignmentTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  assignmentMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  assignmentMetaText: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  membersTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: Colors.mutedForeground,
  },
  membersChips: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  memberChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  memberChipText: {
    fontSize: 11,
  },
  teamFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  teamTeacher: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  openWorkspace: {
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.accent,
  },
  openWorkspaceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
