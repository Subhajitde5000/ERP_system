/**
 * Team workspace — port of StudentTeamWorkspace in
 * fontend/components/student/student-teams.tsx: tasks board, team chat,
 * shared links, roster with invitations, and the submission overview.
 */

import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  FileCode2,
  FileText,
  FolderGit2,
  Link2,
  ListTodo,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui";
import { dateTime } from "@/lib/format";
import {
  addTeamResource,
  cancelTeamInvitation,
  createTeamTask,
  deleteTeamResource,
  deleteTeamTask,
  fetchEligibleClassmates,
  fetchTeamWorkspace,
  inviteTeamMember,
  leaveStudentAssignmentGroup,
  postTeamMessage,
  updateTeamTask,
  type StudentEligibleClassmateOut,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

type WorkspaceTab = "tasks" | "messages" | "resources" | "members" | "submission";

export default function StudentTeamWorkspacePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? "";
  const router = useRouter();
  const resource = useResource(() => fetchTeamWorkspace(groupId), [groupId]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tasks");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New task form state
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  // New message state
  const [newMessage, setNewMessage] = useState("");

  // New resource state
  const [showAddResource, setShowAddResource] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [resType, setResType] = useState("LINK");

  // Invite member state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [classmates, setClassmates] = useState<StudentEligibleClassmateOut[]>([]);
  const [loadingClassmates, setLoadingClassmates] = useState(false);

  const data = resource.data;
  const isLeader = data?.group.members.some((m) => m.is_me && data.group.created_by === m.student_id) ?? false;

  async function openInviteModal() {
    setShowInviteModal(true);
    setLoadingClassmates(true);
    setError(null);
    try {
      const list = await fetchEligibleClassmates(groupId);
      setClassmates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class roster");
    } finally {
      setLoadingClassmates(false);
    }
  }

  async function handleSendInvite(studentId: string) {
    setBusy(`invite-${studentId}`);
    setError(null);
    try {
      await inviteTeamMember(groupId, studentId);
      const list = await fetchEligibleClassmates(groupId);
      setClassmates(list);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    setBusy(`cancel-${inviteId}`);
    setError(null);
    try {
      await cancelTeamInvitation(groupId, inviteId);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel invitation");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    setBusy("add-task");
    setError(null);
    try {
      await createTeamTask(groupId, {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        assigned_to: taskAssignee || undefined,
        due_date: taskDueDate.trim() ? new Date(taskDueDate.trim()).toISOString() : undefined,
      });
      setTaskTitle("");
      setTaskDesc("");
      setTaskAssignee("");
      setTaskDueDate("");
      setShowAddTask(false);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(null);
    }
  }

  async function handleTaskStatus(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "TODO" ? "IN_PROGRESS" : currentStatus === "IN_PROGRESS" ? "DONE" : "TODO";
    setBusy(`status-${taskId}`);
    try {
      await updateTeamTask(groupId, taskId, { status: nextStatus });
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusy(null);
    }
  }

  function handleDeleteTask(taskId: string) {
    Alert.alert("Delete task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(`delete-${taskId}`);
          try {
            await deleteTeamTask(groupId, taskId);
            await resource.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete task");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setBusy("send-msg");
    setError(null);
    try {
      await postTeamMessage(groupId, newMessage.trim());
      setNewMessage("");
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post message");
    } finally {
      setBusy(null);
    }
  }

  async function handleAddResource() {
    if (!resTitle.trim() || !resUrl.trim()) return;
    setBusy("add-res");
    setError(null);
    try {
      await addTeamResource(groupId, {
        title: resTitle.trim(),
        url: resUrl.trim(),
        resource_type: resType,
      });
      setResTitle("");
      setResUrl("");
      setResType("LINK");
      setShowAddResource(false);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add resource");
    } finally {
      setBusy(null);
    }
  }

  function handleDeleteResource(resourceId: string) {
    Alert.alert("Remove resource", "Are you sure you want to remove this resource link?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(`delete-res-${resourceId}`);
          try {
            await deleteTeamResource(groupId, resourceId);
            await resource.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete resource");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  function handleLeaveGroup() {
    if (!data) return;
    Alert.alert("Leave team", "Are you sure you want to leave this project team?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          setBusy("leave-group");
          try {
            await leaveStudentAssignmentGroup(data.assignment.id);
            router.replace("/(student)/teams");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to leave group");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  const filteredClassmates = classmates.filter(
    (c) =>
      c.student_name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      (c.roll_number && c.roll_number.toLowerCase().includes(inviteSearch.toLowerCase())),
  );

  return (
    <Screen>
      <View style={styles.stack}>
        {/* Top back bar */}
        <View style={styles.topBar}>
          <Link href="/(student)/teams" style={styles.backLink}>
            <ArrowLeft size={14} color={Colors.mutedForeground} />
            <Text style={styles.backLinkText}>Back to My Teams</Text>
          </Link>

          {data ? (
            <View style={styles.topBarActions}>
              <Link href={{ pathname: "/(student)/assignments/[id]/index", params: { id: data.assignment.id } }} asChild>
                <TouchableOpacity style={styles.topBarButton}>
                  <FileText size={14} color={Colors.primary} />
                  <Text style={styles.topBarButtonLabel}>Assignment Details</Text>
                </TouchableOpacity>
              </Link>
              <TouchableOpacity
                disabled={busy === "leave-group"}
                onPress={handleLeaveGroup}
                style={styles.leaveTeam}
              >
                <LogOut size={14} color={Colors.destructiveText} />
                <Text style={styles.leaveTeamLabel}>Leave Team</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

      {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : null}

      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading team workspace…"
      >
        {data ? (
          <View style={styles.stack}>
            {/* Team Banner / Header */}
            <Card style={styles.banner}>
              <View style={styles.bannerTop}>
                <View style={styles.bannerText}>
                  <View style={styles.bannerTitleRow}>
                    <Text style={styles.bannerName}>{data.group.name}</Text>
                    <View style={styles.membersCountPill}>
                      <Text style={styles.membersCountText}>
                        {data.group.member_count} / {data.assignment.max_group_size} Members
                      </Text>
                    </View>
                    {data.group.is_submitted ? (
                      <View style={[styles.statusPill, { backgroundColor: Colors.successLight }]}>
                        <CheckCircle2 size={14} color={Colors.successText} />
                        <Text style={[styles.statusPillText, { color: Colors.successText }]}>Submitted</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: Colors.muted }]}>
                        <Clock size={14} color={Colors.mutedForeground} />
                        <Text style={[styles.statusPillText, { color: Colors.mutedForeground, fontWeight: "500" }]}>
                          In Progress
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.bannerProject}>
                    Project: <Text style={styles.bannerProjectName}>{data.assignment.title}</Text> ·{" "}
                    {data.assignment.subject_name} ({data.assignment.subject_code})
                  </Text>
                </View>

                <View style={styles.bannerActions}>
                  {isLeader && data.group.members.length < data.assignment.max_group_size ? (
                    <TouchableOpacity onPress={openInviteModal} style={styles.inviteButton}>
                      <UserPlus size={14} color="#FFFFFF" />
                      <Text style={styles.inviteButtonLabel}>Invite Teammates</Text>
                    </TouchableOpacity>
                  ) : null}

                  <Link
                    href={{ pathname: "/(student)/assignments/[id]/index", params: { id: data.assignment.id } }}
                    asChild
                  >
                    <TouchableOpacity style={styles.topBarButton}>
                      <FileCode2 size={14} color={Colors.primary} />
                      <Text style={styles.topBarButtonLabel}>Submit Work</Text>
                    </TouchableOpacity>
                  </Link>
                </View>
              </View>

              {/* Workspace Navigation Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                <View style={styles.tabs}>
                  <TabButton active={activeTab === "tasks"} onPress={() => setActiveTab("tasks")} icon={<ListTodo size={14} color={activeTab === "tasks" ? "#FFFFFF" : Colors.mutedForeground} />} label={`Tasks & To-Do (${data.tasks.length})`} />
                  <TabButton active={activeTab === "messages"} onPress={() => setActiveTab("messages")} icon={<MessageSquare size={14} color={activeTab === "messages" ? "#FFFFFF" : Colors.mutedForeground} />} label={`Team Chat (${data.messages.length})`} />
                  <TabButton active={activeTab === "resources"} onPress={() => setActiveTab("resources")} icon={<FolderGit2 size={14} color={activeTab === "resources" ? "#FFFFFF" : Colors.mutedForeground} />} label={`Shared Links (${data.resources.length})`} />
                  <TabButton
                    active={activeTab === "members"}
                    onPress={() => setActiveTab("members")}
                    icon={<Users size={14} color={activeTab === "members" ? "#FFFFFF" : Colors.mutedForeground} />}
                    label={`Teammates (${data.group.members.length})`}
                    extra={
                      data.pending_invitations.length > 0 ? (
                        <View style={styles.tabExtra}>
                          <Text style={styles.tabExtraText}>+{data.pending_invitations.length}</Text>
                        </View>
                      ) : null
                    }
                  />
                  <TabButton active={activeTab === "submission"} onPress={() => setActiveTab("submission")} icon={<FileText size={14} color={activeTab === "submission" ? "#FFFFFF" : Colors.mutedForeground} />} label="Submission Overview" />
                </View>
              </ScrollView>
            </Card>

            {/* TAB CONTENT: TASKS */}
            {activeTab === "tasks" ? (
              <View style={styles.tabStack}>
                <View style={styles.tabHeader}>
                  <View style={styles.tabHeaderText}>
                    <Text style={styles.tabTitle}>Team Task Board</Text>
                    <Text style={styles.tabSubtitle}>
                      Break down assignment milestones and assign tasks among members.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAddTask(!showAddTask)} style={styles.smallPrimary}>
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.smallPrimaryLabel}>{showAddTask ? "Cancel" : "Add Task"}</Text>
                  </TouchableOpacity>
                </View>

                {showAddTask ? (
                  <Card style={styles.dashedCard}>
                    <View style={styles.formStack}>
                      <View>
                        <Text style={styles.fieldLabel}>Task Title *</Text>
                        <TextInput
                          value={taskTitle}
                          onChangeText={setTaskTitle}
                          placeholder="e.g. Research literature review or implement login API"
                          placeholderTextColor={Colors.placeholder}
                          style={styles.input}
                        />
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Description / Instructions</Text>
                        <TextInput
                          multiline
                          value={taskDesc}
                          onChangeText={setTaskDesc}
                          placeholder="Provide details or links needed to complete this task"
                          placeholderTextColor={Colors.placeholder}
                          style={styles.smallTextArea}
                        />
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Assign To</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.chipRow}>
                            <Chip selected={taskAssignee === ""} label="Unassigned" onPress={() => setTaskAssignee("")} />
                            {data.group.members.map((m) => (
                              <Chip
                                key={m.student_id}
                                selected={taskAssignee === m.student_id}
                                label={`${m.student_name} ${m.is_me ? "(You)" : ""}`}
                                onPress={() => setTaskAssignee(m.student_id)}
                              />
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Due Date</Text>
                        <TextInput
                          value={taskDueDate}
                          onChangeText={setTaskDueDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={Colors.placeholder}
                          style={styles.input}
                        />
                      </View>
                      <View style={styles.formActionsRight}>
                        <TouchableOpacity onPress={() => setShowAddTask(false)} style={styles.smallGhost}>
                          <Text style={styles.smallGhostLabel}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={busy === "add-task"} onPress={handleAddTask} style={[styles.smallPrimary, busy === "add-task" && styles.disabled]}>
                          <Text style={styles.smallPrimaryLabel}>{busy === "add-task" ? "Creating…" : "Save Task"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ) : null}

                {/* Task Columns */}
                <View style={styles.taskColumns}>
                  {(["TODO", "IN_PROGRESS", "DONE"] as const).map((colStatus) => {
                    const colTasks = data.tasks.filter((t) => t.status === colStatus);
                    const colLabel = colStatus === "TODO" ? "To Do" : colStatus === "IN_PROGRESS" ? "In Progress" : "Completed";
                    return (
                      <View key={colStatus} style={styles.taskColumn}>
                        <View style={styles.taskColumnHeader}>
                          <Text style={styles.taskColumnTitle}>{colLabel}</Text>
                          <View
                            style={[
                              styles.taskColumnCount,
                              colStatus === "TODO"
                                ? { backgroundColor: Colors.muted }
                                : colStatus === "IN_PROGRESS"
                                  ? { backgroundColor: Colors.amber50 }
                                  : { backgroundColor: Colors.successLight },
                            ]}
                          >
                            <Text
                              style={[
                                styles.taskColumnCountText,
                                colStatus === "TODO"
                                  ? { color: Colors.primary }
                                  : colStatus === "IN_PROGRESS"
                                    ? { color: Colors.amber700 }
                                    : { color: Colors.successText },
                              ]}
                            >
                              {colTasks.length}
                            </Text>
                          </View>
                        </View>

                        {colTasks.length === 0 ? (
                          <Text style={styles.noTasks}>No tasks</Text>
                        ) : (
                          <View style={styles.taskList}>
                            {colTasks.map((t) => (
                              <View key={t.id} style={styles.taskCard}>
                                <View style={styles.taskCardTop}>
                                  <Text style={styles.taskTitle}>{t.title}</Text>
                                  <TouchableOpacity onPress={() => handleDeleteTask(t.id)} accessibilityLabel="Delete task">
                                    <Trash2 size={12} color={Colors.mutedForeground} />
                                  </TouchableOpacity>
                                </View>

                                {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}

                                <View style={styles.taskMeta}>
                                  <Text style={styles.taskAssignee}>
                                    {t.assignee_name ? `Assigned: ${t.assignee_name}` : "Unassigned"}
                                  </Text>
                                  {t.due_date ? <Text style={styles.taskDue}>Due: {dateTime(t.due_date)}</Text> : null}
                                </View>

                                <TouchableOpacity
                                  disabled={busy === `status-${t.id}`}
                                  onPress={() => handleTaskStatus(t.id, t.status)}
                                  style={styles.taskStatusButton}
                                >
                                  <Text style={styles.taskStatusLabel}>
                                    {t.status === "TODO"
                                      ? "Move → In Progress"
                                      : t.status === "IN_PROGRESS"
                                        ? "Mark as Done ✓"
                                        : "Re-open Task"}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* TAB CONTENT: MESSAGES / CHAT */}
            {activeTab === "messages" ? (
              <View style={styles.tabStack}>
                <View>
                  <Text style={styles.tabTitle}>Team Discussion &amp; Notes</Text>
                  <Text style={styles.tabSubtitle}>
                    Coordinate project plans, share updates, and collaborate with your teammates.
                  </Text>
                </View>

                <Card style={styles.chatCard}>
                  <View style={styles.chatList}>
                    {data.messages.length === 0 ? (
                      <Text style={styles.chatEmpty}>No team messages yet. Post the first message to get started!</Text>
                    ) : (
                      data.messages.map((m) => (
                        <View key={m.id} style={[styles.chatRow, m.is_me ? styles.chatRowMine : styles.chatRowOther]}>
                          <Text style={styles.chatSender}>
                            <Text style={styles.chatSenderName}>{m.is_me ? "You" : m.sender_name}</Text> ·{" "}
                            {dateTime(m.created_at)}
                          </Text>
                          <View style={[styles.chatBubble, m.is_me ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                            <Text style={[styles.chatMessage, m.is_me && styles.chatMessageMine]}>{m.message}</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.chatInputRow}>
                    <TextInput
                      value={newMessage}
                      onChangeText={setNewMessage}
                      placeholder="Type a team update or message…"
                      placeholderTextColor={Colors.placeholder}
                      style={[styles.input, styles.chatInput]}
                      onSubmitEditing={() => {
                        if (newMessage.trim()) handleSendMessage();
                      }}
                    />
                    <TouchableOpacity
                      disabled={busy === "send-msg" || !newMessage.trim()}
                      onPress={handleSendMessage}
                      style={[styles.chatSend, (busy === "send-msg" || !newMessage.trim()) && styles.disabled]}
                    >
                      <Send size={14} color="#FFFFFF" />
                      <Text style={styles.chatSendLabel}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            ) : null}

            {/* TAB CONTENT: RESOURCES */}
            {activeTab === "resources" ? (
              <View style={styles.tabStack}>
                <View style={styles.tabHeader}>
                  <View style={styles.tabHeaderText}>
                    <Text style={styles.tabTitle}>Shared Repositories &amp; Resources</Text>
                    <Text style={styles.tabSubtitle}>
                      Centralize GitHub repos, Google Drive folders, Figma links, and documentation.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAddResource(!showAddResource)} style={styles.smallPrimary}>
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.smallPrimaryLabel}>{showAddResource ? "Cancel" : "Add Resource Link"}</Text>
                  </TouchableOpacity>
                </View>

                {showAddResource ? (
                  <Card style={styles.dashedCard}>
                    <View style={styles.formStack}>
                      <View>
                        <Text style={styles.fieldLabel}>Resource Type</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.chipRow}>
                            {[
                              ["REPO", "GitHub / Repository"],
                              ["DRIVE", "Google Drive / Folder"],
                              ["DOC", "Design / Document"],
                              ["LINK", "General Web Link"],
                            ].map(([value, label]) => (
                              <Chip key={value} selected={resType === value} label={label} onPress={() => setResType(value)} />
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>Title *</Text>
                        <TextInput
                          value={resTitle}
                          onChangeText={setResTitle}
                          placeholder="e.g. GitHub Frontend Repo or Figma Wireframes"
                          placeholderTextColor={Colors.placeholder}
                          style={styles.input}
                        />
                      </View>
                      <View>
                        <Text style={styles.fieldLabel}>URL *</Text>
                        <TextInput
                          value={resUrl}
                          onChangeText={setResUrl}
                          placeholder="https://github.com/org/repo or https://drive.google.com/..."
                          placeholderTextColor={Colors.placeholder}
                          style={styles.input}
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.formActionsRight}>
                        <TouchableOpacity onPress={() => setShowAddResource(false)} style={styles.smallGhost}>
                          <Text style={styles.smallGhostLabel}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={busy === "add-res"} onPress={handleAddResource} style={[styles.smallPrimary, busy === "add-res" && styles.disabled]}>
                          <Text style={styles.smallPrimaryLabel}>{busy === "add-res" ? "Saving…" : "Save Resource"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Card>
                ) : null}

                {/* Resource List */}
                {data.resources.length === 0 ? (
                  <Card style={styles.resourcesEmpty}>
                    <Text style={styles.resourcesEmptyText}>
                      No resources added yet. Share your project repository or Drive links above!
                    </Text>
                  </Card>
                ) : (
                  <View style={styles.resourceList}>
                    {data.resources.map((res) => (
                      <Card key={res.id} style={styles.resourceCard}>
                        <View style={styles.resourceLeft}>
                          <View style={styles.resourceIcon}>
                            {res.resource_type === "REPO" ? (
                              <FolderGit2 size={16} color={Colors.primary} />
                            ) : res.resource_type === "DOC" ? (
                              <FileText size={16} color={Colors.primary} />
                            ) : (
                              <Link2 size={16} color={Colors.primary} />
                            )}
                          </View>
                          <View style={styles.resourceText}>
                            <Pressable onPress={() => Linking.openURL(res.url)} style={styles.resourceLink}>
                              <Text style={styles.resourceLinkText} numberOfLines={1}>
                                {res.title}
                              </Text>
                              <ExternalLink size={12} color={Colors.primary} />
                            </Pressable>
                            <Text style={styles.resourceBy}>Added by {res.creator_name || "Teammate"}</Text>
                          </View>
                        </View>

                        <TouchableOpacity onPress={() => handleDeleteResource(res.id)} accessibilityLabel="Remove resource">
                          <Trash2 size={14} color={Colors.mutedForeground} />
                        </TouchableOpacity>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB CONTENT: MEMBERS */}
            {activeTab === "members" ? (
              <View style={styles.memberStack}>
                <View style={styles.tabHeader}>
                  <View style={styles.tabHeaderText}>
                    <Text style={styles.tabTitle}>Team Members &amp; Roster</Text>
                    <Text style={styles.tabSubtitle}>
                      Required team size: {data.assignment.min_group_size} to {data.assignment.max_group_size} students.
                    </Text>
                  </View>

                  {isLeader && data.group.members.length < data.assignment.max_group_size ? (
                    <TouchableOpacity onPress={openInviteModal} style={styles.smallPrimary}>
                      <UserPlus size={14} color="#FFFFFF" />
                      <Text style={styles.smallPrimaryLabel}>Invite Teammates</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Active Members Grid */}
                <View style={styles.memberGrid}>
                  {data.group.members.map((m) => (
                    <Card
                      key={m.student_id}
                      style={[
                        styles.memberCard,
                        m.is_me ? { borderColor: "rgba(79,70,229,0.4)", backgroundColor: "rgba(238,242,255,0.1)" } : undefined,
                      ]}
                    >
                      <View style={styles.memberLeft}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>{m.student_name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.memberName}>
                            {m.student_name} {m.is_me ? "(You)" : ""}
                          </Text>
                          {m.roll_number ? <Text style={styles.memberRoll}>Roll No: {m.roll_number}</Text> : null}
                          <Text style={styles.memberJoined}>Joined {dateTime(m.joined_at)}</Text>
                        </View>
                      </View>

                      {data.group.created_by === m.student_id ? (
                        <View style={styles.memberLeader}>
                          <Crown size={12} color="#F59E0B" />
                          <Text style={styles.memberLeaderText}>Leader</Text>
                        </View>
                      ) : null}
                    </Card>
                  ))}
                </View>

                {/* Pending Invitations Section */}
                {data.pending_invitations.length > 0 ? (
                  <View style={styles.pendingSection}>
                    <View style={styles.pendingHeader}>
                      <Text style={styles.pendingTitle}>Pending Invitations ({data.pending_invitations.length})</Text>
                      <Text style={styles.pendingSubtitle}>Awaiting student acceptance</Text>
                    </View>

                    <View style={styles.memberGrid}>
                      {data.pending_invitations.map((inv) => (
                        <Card key={inv.id} style={styles.pendingCard}>
                          <View style={styles.memberLeft}>
                            <View style={styles.pendingAvatar}>
                              <Clock size={16} color={Colors.amber600} />
                            </View>
                            <View>
                              <Text style={styles.memberName}>{inv.student_name}</Text>
                              {inv.student_roll_number ? (
                                <Text style={styles.memberRoll}>Roll No: {inv.student_roll_number}</Text>
                              ) : null}
                              <Text style={styles.memberJoined}>Invited {dateTime(inv.created_at)}</Text>
                            </View>
                          </View>

                          {isLeader ? (
                            <TouchableOpacity
                              disabled={busy === `cancel-${inv.id}`}
                              onPress={() => handleCancelInvite(inv.id)}
                              style={[styles.pendingCancel, busy === `cancel-${inv.id}` && styles.disabled]}
                            >
                              <X size={12} color={Colors.destructiveText} />
                              <Text style={styles.pendingCancelLabel}>Cancel</Text>
                            </TouchableOpacity>
                          ) : null}
                        </Card>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* TAB CONTENT: SUBMISSION */}
            {activeTab === "submission" ? (
              <View style={styles.tabStack}>
                <View>
                  <Text style={styles.tabTitle}>Assignment &amp; Submission Overview</Text>
                  <Text style={styles.tabSubtitle}>
                    Submissions made by any team member represent the entire group.
                  </Text>
                </View>

                <Card style={styles.submissionCard}>
                  <View style={styles.submissionStats}>
                    <View style={styles.submissionStat}>
                      <Text style={styles.submissionStatLabel}>Due Date</Text>
                      <Text style={styles.submissionStatValue}>{dateTime(data.assignment.due_date)}</Text>
                    </View>
                    <View style={styles.submissionStat}>
                      <Text style={styles.submissionStatLabel}>Total / Passing Marks</Text>
                      <Text style={styles.submissionStatValue}>
                        {data.assignment.total_marks} / {data.assignment.passing_marks} marks
                      </Text>
                    </View>
                    <View style={styles.submissionStat}>
                      <Text style={styles.submissionStatLabel}>Status</Text>
                      {data.group.is_submitted ? (
                        <Text style={[styles.submissionStatValue, { color: Colors.successText, fontWeight: "700" }]}>
                          Work Submitted
                        </Text>
                      ) : (
                        <Text style={[styles.submissionStatValue, { color: Colors.amber600, fontWeight: "700" }]}>
                          Pending Submission
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.submissionFooter}>
                    <Text style={styles.submissionPrompt}>Ready to submit your group assignment?</Text>
                    <Link
                      href={{ pathname: "/(student)/assignments/[id]/index", params: { id: data.assignment.id } }}
                      asChild
                    >
                      <TouchableOpacity style={styles.submissionButton}>
                        <FileCode2 size={14} color="#FFFFFF" />
                        <Text style={styles.submissionButtonLabel}>Go to Submission Page</Text>
                      </TouchableOpacity>
                    </Link>
                  </View>
                </Card>
              </View>
            ) : null}
          </View>
        ) : null}
      </AsyncState>

      {/* Invite Modal */}
      {showInviteModal ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowInviteModal(false)} />
          <View style={styles.inviteModal}>
            <View style={styles.inviteModalHeader}>
              <View style={styles.inviteModalTitle}>
                <View style={styles.inviteModalIcon}>
                  <UserPlus size={16} color={Colors.accent} />
                </View>
                <View>
                  <Text style={styles.inviteModalName}>Invite Teammate</Text>
                  <Text style={styles.inviteModalSubtitle}>Select an eligible classmate from this course</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.inviteModalClose}>
                <X size={16} color={Colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Search filter */}
            <View style={styles.inviteSearchField}>
              <Search size={16} color={Colors.mutedForeground} style={styles.inviteSearchIcon} />
              <TextInput
                value={inviteSearch}
                onChangeText={setInviteSearch}
                placeholder="Search classmate by name or roll number…"
                placeholderTextColor={Colors.placeholder}
                style={styles.inviteSearchInput}
              />
            </View>

            {/* Classmates list */}
            <ScrollView style={styles.classmateList}>
              {loadingClassmates ? (
                <View style={styles.classmateLoading}>
                  <LoaderCircle size={16} color={Colors.accent} />
                  <Text style={styles.classmateLoadingText}>Loading classmates…</Text>
                </View>
              ) : filteredClassmates.length === 0 ? (
                <Text style={styles.classmateEmpty}>No eligible classmates found.</Text>
              ) : (
                filteredClassmates.map((c) => {
                  const isInvited = c.has_pending_invite;
                  const isGrouped = c.already_in_group;

                  return (
                    <View key={c.student_id} style={styles.classmateRow}>
                      <View>
                        <Text style={styles.classmateName}>{c.student_name}</Text>
                        {c.roll_number ? <Text style={styles.classmateRoll}>Roll No: {c.roll_number}</Text> : null}
                      </View>

                      {isGrouped ? (
                        <View style={styles.classmateState}>
                          <Text style={styles.classmateStateText}>In Another Team</Text>
                        </View>
                      ) : isInvited ? (
                        <View style={[styles.classmateState, { backgroundColor: Colors.amber50 }]}>
                          <Text style={[styles.classmateStateText, { color: Colors.amber700, fontWeight: "700" }]}>
                            Invite Pending
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          disabled={busy === `invite-${c.student_id}`}
                          onPress={() => handleSendInvite(c.student_id)}
                          style={[styles.classmateInvite, busy === `invite-${c.student_id}` && styles.disabled]}
                        >
                          {busy === `invite-${c.student_id}` ? (
                            <LoaderCircle size={12} color="#FFFFFF" />
                          ) : (
                            <Send size={12} color="#FFFFFF" />
                          )}
                          <Text style={styles.classmateInviteLabel}>Invite</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.inviteModalFooter}>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.smallGhost}>
                <Text style={styles.smallGhostLabel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
      </View>
    </Screen>
  );
}

function TabButton({
  active,
  onPress,
  icon,
  label,
  extra,
}: {
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  extra?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={[styles.tab, active ? styles.tabActive : styles.tabIdle]}
    >
      {icon}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {extra}
    </TouchableOpacity>
  );
}

function Chip({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  topBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  topBarActions: {
    flexDirection: "row",
    gap: 8,
  },
  topBarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  topBarButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  leaveTeam: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  leaveTeamLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.destructiveText,
  },
  errorBanner: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: Colors.destructiveLight,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.destructiveText,
  },
  banner: {
    padding: 24,
  },
  bannerTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  bannerText: {
    flex: 1,
    gap: 4,
  },
  bannerTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  bannerName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
  },
  membersCountPill: {
    borderRadius: 999,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  membersCountText: {
    fontSize: 12,
    fontWeight: "700",
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
    fontSize: 12,
    fontWeight: "700",
  },
  bannerProject: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  bannerProjectName: {
    fontWeight: "600",
    color: Colors.primary,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 8,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    ...Shadow.accent,
  },
  inviteButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  tabsScroll: {
    marginTop: 24,
    flexGrow: 0,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.field,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabIdle: {
    backgroundColor: "rgba(241,245,249,0.6)",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  tabExtra: {
    marginLeft: 4,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabExtraText: {
    fontSize: 10,
    color: "#FFFFFF",
  },
  tabStack: {
    gap: 16,
  },
  memberStack: {
    gap: 24,
  },
  tabHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  tabHeaderText: {
    flex: 1,
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  tabSubtitle: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  smallPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    ...Shadow.accent,
  },
  smallPrimaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  smallGhost: {
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  smallGhostLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  disabled: {
    opacity: 0.6,
  },
  dashedCard: {
    padding: 16,
    backgroundColor: "rgba(241,245,249,0.2)",
    borderStyle: "dashed",
  },
  formStack: {
    gap: 12,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  input: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.primary,
  },
  smallTextArea: {
    minHeight: 64,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: Colors.primary,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  chipIdle: {
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  chipTextSelected: {
    color: Colors.accent,
  },
  formActionsRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 8,
  },
  taskColumns: {
    gap: 16,
  },
  taskColumn: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.1)",
    padding: 12,
    gap: 12,
  },
  taskColumnHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  taskColumnTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  taskColumnCount: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  taskColumnCountText: {
    fontSize: 10,
    fontWeight: "700",
  },
  noTasks: {
    paddingVertical: 24,
    textAlign: "center",
    fontSize: 12,
    fontStyle: "italic",
    color: Colors.mutedForeground,
  },
  taskList: {
    gap: 10,
  },
  taskCard: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 8,
  },
  taskCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  taskTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  taskDesc: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  taskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.4)",
    paddingTop: 4,
  },
  taskAssignee: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.primary,
  },
  taskDue: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  taskStatusButton: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.3)",
    paddingVertical: 4,
    alignItems: "center",
  },
  taskStatusLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.primary,
  },
  chatCard: {
    padding: 16,
    gap: 16,
  },
  chatList: {
    minHeight: 220,
    maxHeight: 450,
    gap: 12,
    paddingRight: 8,
  },
  chatEmpty: {
    paddingVertical: 48,
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  chatRow: {
    gap: 2,
  },
  chatRowMine: {
    alignItems: "flex-end",
  },
  chatRowOther: {
    alignItems: "flex-start",
  },
  chatSender: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  chatSenderName: {
    fontWeight: "700",
    color: Colors.primary,
  },
  chatBubble: {
    maxWidth: "80%",
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chatBubbleMine: {
    backgroundColor: Colors.accent,
  },
  chatBubbleOther: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.2)",
  },
  chatMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.primary,
  },
  chatMessageMine: {
    color: "#FFFFFF",
  },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  chatInput: {
    flex: 1,
  },
  chatSend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  chatSendLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resourcesEmpty: {
    padding: 32,
  },
  resourcesEmptyText: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  resourceList: {
    gap: 12,
  },
  resourceCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resourceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceText: {
    flex: 1,
  },
  resourceLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resourceLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    flexShrink: 1,
  },
  resourceBy: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  memberGrid: {
    gap: 12,
  },
  memberCard: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  memberName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  memberRoll: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  memberJoined: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  memberLeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.amber50,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  memberLeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.amber700,
  },
  pendingSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  pendingSubtitle: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  pendingCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderStyle: "dashed",
  },
  pendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.amber50,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
  },
  pendingCancelLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.destructiveText,
  },
  submissionCard: {
    padding: 20,
    gap: 16,
  },
  submissionStats: {
    gap: 12,
  },
  submissionStat: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  submissionStatLabel: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  submissionStatValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  submissionFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  submissionPrompt: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  submissionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  submissionButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  inviteModal: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "15%",
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 20,
    gap: 16,
  },
  inviteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inviteModalTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteModalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteModalName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  inviteModalSubtitle: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  inviteModalClose: {
    padding: 4,
  },
  inviteSearchField: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingRight: 14,
  },
  inviteSearchIcon: {
    marginHorizontal: 12,
  },
  inviteSearchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
  },
  classmateList: {
    maxHeight: 320,
    minHeight: 160,
    paddingRight: 4,
  },
  classmateLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 32,
  },
  classmateLoadingText: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  classmateEmpty: {
    paddingVertical: 32,
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  classmateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
  },
  classmateName: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  classmateRoll: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  classmateState: {
    borderRadius: 999,
    backgroundColor: Colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  classmateStateText: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  classmateInvite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    ...Shadow.accent,
  },
  classmateInviteLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  inviteModalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
});
