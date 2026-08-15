"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  FileCode2,
  FileText,
  FolderGit2,
  GraduationCap,
  Link2,
  ListTodo,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Card, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, dateTime } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  addTeamResource,
  cancelTeamInvitation,
  createTeamTask,
  deleteTeamResource,
  deleteTeamTask,
  fetchEligibleClassmates,
  fetchMyInvitations,
  fetchMyTeams,
  fetchTeamWorkspace,
  inviteTeamMember,
  leaveStudentAssignmentGroup,
  postTeamMessage,
  respondToInvitation,
  updateTeamTask,
  type StudentEligibleClassmateOut,
  type StudentGroupInviteOut,
  type StudentGroupMessageOut,
  type StudentGroupResourceOut,
  type StudentGroupTaskOut,
  type StudentMyTeamDetail,
  type StudentMyTeamSummary,
} from "@/lib/student";

// ── Student Teams Hub Page ──────────────────────────────────────────────────

export function StudentTeamsList({ onSelectTeam }: { onSelectTeam?: (groupId: string) => void }) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Project Teams & Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your project groups, coordinate tasks with teammates, share resources, and submit group assignments.
          </p>
        </div>
        <Link
          href="/student/assignments"
          className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border bg-white px-3.5 text-xs font-semibold text-primary shadow-sm hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> View Available Group Projects
        </Link>
      </div>

      {actionError ? (
        <div className="rounded-field border border-destructive-border bg-destructive-light p-3 text-xs font-medium text-destructive-text">
          {actionError}
        </div>
      ) : null}

      {/* Incoming Invitations Banner */}
      {invites.length > 0 ? (
        <Card className="border-accent/40 bg-gradient-to-r from-accent-light/30 via-white to-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-primary">
                Incoming Team Invitations ({invites.length})
              </h2>
              <p className="text-[11px] text-muted-foreground">
                You have been invited by team leaders to join project teams.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col justify-between rounded-field border border-border bg-white p-3.5 text-xs shadow-sm space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-sm">{inv.group_name}</span>
                    <span className="text-[10px] text-muted-foreground">{dateTime(inv.created_at)}</span>
                  </div>
                  <div className="mt-1 font-medium text-accent text-[11px]">
                    {inv.subject_name} · {inv.assignment_title}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Invited by <span className="font-semibold text-primary">{inv.inviter_name}</span> (Team Leader)
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <button
                    type="button"
                    disabled={busyInviteId === inv.id}
                    onClick={() => handleRespondInvite(inv.id, "ACCEPT")}
                    className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-field bg-accent px-3 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                  >
                    {busyInviteId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Accept & Join
                  </button>
                  <button
                    type="button"
                    disabled={busyInviteId === inv.id}
                    onClick={() => handleRespondInvite(inv.id, "REJECT")}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <X className="h-3 w-3" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-accent-light text-accent">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{teams.length}</div>
            <div className="text-xs text-muted-foreground">Total Teams ({activeCount} active)</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-amber-50 text-amber-600">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{leadingCount}</div>
            <div className="text-xs text-muted-foreground">Teams You Lead</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-success-light text-success-text">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{submittedCount}</div>
            <div className="text-xs text-muted-foreground">Submitted Projects</div>
          </div>
        </Card>
      </div>

      {/* Team Cards Grid */}
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your teams…">
        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-base font-bold text-primary">No Teams Formed Yet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              You are not currently enrolled in any project teams. Open a group assignment to form or join a team!
            </p>
            <div className="mt-4">
              <Link
                href="/student/assignments"
                className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
              >
                Browse Group Assignments
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <Card key={team.group_id} className="flex flex-col justify-between space-y-4 p-5 transition hover:shadow-md">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-primary">{team.group_name}</h3>
                        {team.is_leader ? (
                          <span title="Team Leader" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Crown className="h-3 w-3 text-amber-500" /> Leader
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-accent">
                        {team.subject_code} · {team.subject_name}
                      </p>
                    </div>

                    {team.is_submitted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-[11px] font-bold text-success-text">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" /> In Progress
                      </span>
                    )}
                  </div>

                  <div className="rounded-field border border-border/60 bg-muted/20 p-2.5 text-xs space-y-1">
                    <div className="font-semibold text-primary line-clamp-1">{team.assignment_title}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>Due: {dateTime(team.due_date)}</span>
                      <span>Total Marks: {team.total_marks}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Team Members ({team.member_count}/{team.max_group_size})
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {team.members.map((m) => (
                        <span
                          key={m.student_id}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${
                            m.is_me ? "bg-accent-light font-bold text-accent" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {m.student_name} {m.is_me ? "(You)" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    {team.teacher_name ? `Teacher: ${team.teacher_name}` : "Faculty Assigned"}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/student/teams/${team.group_id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3.5 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                    >
                      Open Workspace
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </AsyncState>
    </div>
  );
}

// ── Single Team Workspace Component ─────────────────────────────────────────

type WorkspaceTab = "tasks" | "messages" | "resources" | "members" | "submission";

export function StudentTeamWorkspace({ groupId }: { groupId: string }) {
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

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setBusy("add-task");
    setError(null);
    try {
      await createTeamTask(groupId, {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        assigned_to: taskAssignee || undefined,
        due_date: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
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

  async function handleDeleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setBusy(`delete-${taskId}`);
    try {
      await deleteTeamTask(groupId, taskId);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
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

  async function handleAddResource(e: React.FormEvent) {
    e.preventDefault();
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

  async function handleDeleteResource(resourceId: string) {
    if (!confirm("Are you sure you want to remove this resource link?")) return;
    setBusy(`delete-res-${resourceId}`);
    try {
      await deleteTeamResource(groupId, resourceId);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resource");
    } finally {
      setBusy(null);
    }
  }

  async function handleLeaveGroup() {
    if (!data) return;
    if (!confirm("Are you sure you want to leave this project team?")) return;
    setBusy("leave-group");
    try {
      await leaveStudentAssignmentGroup(data.assignment.id);
      window.location.href = "/student/teams";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setBusy(null);
    }
  }

  const filteredClassmates = classmates.filter(
    (c) =>
      c.student_name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      (c.roll_number && c.roll_number.toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top back bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/student/teams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Teams
        </Link>

        {data ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/student/assignments/${data.assignment.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-xs font-semibold text-primary hover:bg-muted"
            >
              <FileText className="h-3.5 w-3.5" /> Assignment Details
            </Link>
            <button
              type="button"
              disabled={busy === "leave-group"}
              onClick={handleLeaveGroup}
              className="inline-flex h-8 items-center gap-1.5 rounded-field border border-destructive-border bg-white px-3 text-xs font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" /> Leave Team
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-field border border-destructive-border bg-destructive-light p-3 text-xs font-medium text-destructive-text">
          {error}
        </div>
      ) : null}

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading team workspace…">
        {data ? (
          <div className="space-y-6">
            {/* Team Banner / Header */}
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-2xl font-bold text-primary">{data.group.name}</h1>
                    <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-bold text-accent">
                      {data.group.member_count} / {data.assignment.max_group_size} Members
                    </span>
                    {data.group.is_submitted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-xs font-bold text-success-text">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Project: <span className="font-semibold text-primary">{data.assignment.title}</span> · {data.assignment.subject_name} ({data.assignment.subject_code})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isLeader && data.group.members.length < data.assignment.max_group_size ? (
                    <button
                      type="button"
                      onClick={openInviteModal}
                      className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3.5 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Invite Teammates
                    </button>
                  ) : null}

                  <Link
                    href={`/student/assignments/${data.assignment.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-field border border-border bg-white px-3 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    <FileCode2 className="h-3.5 w-3.5" /> Submit Work
                  </Link>
                </div>
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "tasks" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ListTodo className="h-3.5 w-3.5" /> Tasks & To-Do ({data.tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("messages")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "messages" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Team Chat ({data.messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("resources")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "resources" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <FolderGit2 className="h-3.5 w-3.5" /> Shared Links ({data.resources.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("members")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "members" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" /> Teammates ({data.group.members.length})
                  {data.pending_invitations.length > 0 ? (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                      +{data.pending_invitations.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("submission")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "submission" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" /> Submission Overview
                </button>
              </div>
            </Card>

            {/* TAB CONTENT: TASKS */}
            {activeTab === "tasks" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-primary">Team Task Board</h2>
                    <p className="text-xs text-muted-foreground">Break down assignment milestones and assign tasks among members.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                  >
                    <Plus className="h-3.5 w-3.5" /> {showAddTask ? "Cancel" : "Add Task"}
                  </button>
                </div>

                {showAddTask ? (
                  <Card className="p-4 bg-muted/20 border-dashed">
                    <form onSubmit={handleAddTask} className="space-y-3">
                      <div>
                        <label className={labelClass}>Task Title *</label>
                        <input
                          type="text"
                          required
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="e.g. Research literature review or implement login API"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Description / Instructions</label>
                        <textarea
                          rows={2}
                          value={taskDesc}
                          onChange={(e) => setTaskDesc(e.target.value)}
                          placeholder="Provide details or links needed to complete this task"
                          className="w-full rounded-field border border-[#E2E8F0] p-3 text-xs text-primary outline-none focus:border-accent"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Assign To</label>
                          <select className={inputClass} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                            <option value="">Unassigned</option>
                            {data.group.members.map((m) => (
                              <option key={m.student_id} value={m.student_id}>
                                {m.student_name} {m.is_me ? "(You)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Due Date</label>
                          <input
                            type="datetime-local"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddTask(false)}
                          className="inline-flex h-8 items-center rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={busy === "add-task"}
                          className="inline-flex h-8 items-center gap-1 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                        >
                          {busy === "add-task" ? "Creating…" : "Save Task"}
                        </button>
                      </div>
                    </form>
                  </Card>
                ) : null}

                {/* Task Columns */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {(["TODO", "IN_PROGRESS", "DONE"] as const).map((colStatus) => {
                    const colTasks = data.tasks.filter((t) => t.status === colStatus);
                    const colLabel = colStatus === "TODO" ? "To Do" : colStatus === "IN_PROGRESS" ? "In Progress" : "Completed";
                    const colColor = colStatus === "TODO" ? "bg-muted" : colStatus === "IN_PROGRESS" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-success-light text-success-text border-success-border";

                    return (
                      <div key={colStatus} className="rounded-card border border-border bg-muted/10 p-3 space-y-3">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <span className="font-display text-xs font-bold text-primary">{colLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colColor}`}>
                            {colTasks.length}
                          </span>
                        </div>

                        {colTasks.length === 0 ? (
                          <div className="py-6 text-center text-xs text-muted-foreground italic">No tasks</div>
                        ) : (
                          <div className="space-y-2.5">
                            {colTasks.map((t) => (
                              <div
                                key={t.id}
                                className="group relative rounded-field border border-border bg-white p-3 shadow-sm transition hover:border-accent/40 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-xs text-primary">{t.title}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTask(t.id)}
                                    className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive-text"
                                    title="Delete task"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>

                                {t.description ? <p className="text-[11px] text-muted-foreground">{t.description}</p> : null}

                                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                  <span className="font-medium text-primary">
                                    {t.assignee_name ? `Assigned: ${t.assignee_name}` : "Unassigned"}
                                  </span>
                                  {t.due_date ? <span>Due: {dateTime(t.due_date)}</span> : null}
                                </div>

                                <button
                                  type="button"
                                  disabled={busy === `status-${t.id}`}
                                  onClick={() => handleTaskStatus(t.id, t.status)}
                                  className="w-full rounded-field border border-border bg-muted/30 py-1 text-center text-[10px] font-semibold text-primary hover:bg-muted transition"
                                >
                                  {t.status === "TODO" ? "Move → In Progress" : t.status === "IN_PROGRESS" ? "Mark as Done ✓" : "Re-open Task"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* TAB CONTENT: MESSAGES / CHAT */}
            {activeTab === "messages" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold text-primary">Team Discussion & Notes</h2>
                  <p className="text-xs text-muted-foreground">Coordinate project plans, share updates, and collaborate with your teammates.</p>
                </div>

                <Card className="p-4 space-y-4">
                  <div className="max-h-[450px] min-h-[220px] overflow-y-auto space-y-3 pr-2">
                    {data.messages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        No team messages yet. Post the first message to get started!
                      </div>
                    ) : (
                      data.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-col text-xs ${m.is_me ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
                            <span className="font-bold text-primary">{m.is_me ? "You" : m.sender_name}</span>
                            <span>· {dateTime(m.created_at)}</span>
                          </div>
                          <div
                            className={`max-w-[80%] rounded-card px-3.5 py-2 ${
                              m.is_me ? "bg-accent text-white" : "border border-border bg-muted/20 text-primary"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-border pt-3">
                    <input
                      type="text"
                      required
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a team update or message…"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={busy === "send-msg" || !newMessage.trim()}
                      className="inline-flex h-11 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                  </form>
                </Card>
              </div>
            ) : null}

            {/* TAB CONTENT: RESOURCES */}
            {activeTab === "resources" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-primary">Shared Repositories & Resources</h2>
                    <p className="text-xs text-muted-foreground">Centralize GitHub repos, Google Drive folders, Figma links, and documentation.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddResource(!showAddResource)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                  >
                    <Plus className="h-3.5 w-3.5" /> {showAddResource ? "Cancel" : "Add Resource Link"}
                  </button>
                </div>

                {showAddResource ? (
                  <Card className="p-4 bg-muted/20 border-dashed">
                    <form onSubmit={handleAddResource} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className={labelClass}>Resource Type</label>
                          <select className={inputClass} value={resType} onChange={(e) => setResType(e.target.value)}>
                            <option value="REPO">GitHub / Repository</option>
                            <option value="DRIVE">Google Drive / Folder</option>
                            <option value="DOC">Design / Document</option>
                            <option value="LINK">General Web Link</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Title *</label>
                          <input
                            type="text"
                            required
                            value={resTitle}
                            onChange={(e) => setResTitle(e.target.value)}
                            placeholder="e.g. GitHub Frontend Repo or Figma Wireframes"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>URL *</label>
                        <input
                          type="url"
                          required
                          value={resUrl}
                          onChange={(e) => setResUrl(e.target.value)}
                          placeholder="https://github.com/org/repo or https://drive.google.com/..."
                          className={inputClass}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddResource(false)}
                          className="inline-flex h-8 items-center rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={busy === "add-res"}
                          className="inline-flex h-8 items-center gap-1 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                        >
                          {busy === "add-res" ? "Saving…" : "Save Resource"}
                        </button>
                      </div>
                    </form>
                  </Card>
                ) : null}

                {/* Resource List */}
                {data.resources.length === 0 ? (
                  <Card className="p-8 text-center text-xs text-muted-foreground">
                    No resources added yet. Share your project repository or Drive links above!
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.resources.map((res) => (
                      <Card key={res.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-muted text-primary">
                            {res.resource_type === "REPO" ? (
                              <FolderGit2 className="h-4 w-4" />
                            ) : res.resource_type === "DOC" ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-primary hover:text-accent flex items-center gap-1"
                            >
                              {res.title} <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-[10px] text-muted-foreground">Added by {res.creator_name || "Teammate"}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteResource(res.id)}
                          className="text-muted-foreground hover:text-destructive-text"
                          title="Remove resource"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* TAB CONTENT: MEMBERS */}
            {activeTab === "members" ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-primary">Team Members & Roster</h2>
                    <p className="text-xs text-muted-foreground">
                      Required team size: {data.assignment.min_group_size} to {data.assignment.max_group_size} students.
                    </p>
                  </div>

                  {isLeader && data.group.members.length < data.assignment.max_group_size ? (
                    <button
                      type="button"
                      onClick={openInviteModal}
                      className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3.5 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Invite Teammates
                    </button>
                  ) : null}
                </div>

                {/* Active Members Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.group.members.map((m) => (
                    <Card
                      key={m.student_id}
                      className={`p-4 flex items-center justify-between text-xs ${
                        m.is_me ? "border-accent/40 bg-accent-light/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-bold text-primary">
                          {m.student_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-primary">
                            {m.student_name} {m.is_me ? "(You)" : ""}
                          </div>
                          {m.roll_number ? <div className="text-[11px] text-muted-foreground">Roll No: {m.roll_number}</div> : null}
                          <div className="text-[10px] text-muted-foreground">Joined {dateTime(m.joined_at)}</div>
                        </div>
                      </div>

                      {data.group.created_by === m.student_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                          <Crown className="h-3 w-3 text-amber-500" /> Leader
                        </span>
                      ) : null}
                    </Card>
                  ))}
                </div>

                {/* Pending Invitations Section */}
                {data.pending_invitations.length > 0 ? (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-primary">
                        Pending Invitations ({data.pending_invitations.length})
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        Awaiting student acceptance
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {data.pending_invitations.map((inv) => (
                        <Card key={inv.id} className="p-3.5 flex items-center justify-between text-xs border-dashed">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 font-bold">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-primary">{inv.student_name}</div>
                              {inv.student_roll_number ? (
                                <div className="text-[11px] text-muted-foreground">Roll No: {inv.student_roll_number}</div>
                              ) : null}
                              <div className="text-[10px] text-muted-foreground">Invited {dateTime(inv.created_at)}</div>
                            </div>
                          </div>

                          {isLeader ? (
                            <button
                              type="button"
                              disabled={busy === `cancel-${inv.id}`}
                              onClick={() => handleCancelInvite(inv.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-field border border-destructive-border bg-white px-2.5 text-[11px] font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60"
                            >
                              <X className="h-3 w-3" /> Cancel
                            </button>
                          ) : null}
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* TAB CONTENT: SUBMISSION */}
            {activeTab === "submission" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold text-primary">Assignment & Submission Overview</h2>
                  <p className="text-xs text-muted-foreground">Submissions made by any team member represent the entire group.</p>
                </div>

                <Card className="p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-field border border-border p-3">
                      <span className="text-muted-foreground">Due Date</span>
                      <div className="font-semibold text-primary mt-1">{dateTime(data.assignment.due_date)}</div>
                    </div>
                    <div className="rounded-field border border-border p-3">
                      <span className="text-muted-foreground">Total / Passing Marks</span>
                      <div className="font-semibold text-primary mt-1">
                        {data.assignment.total_marks} / {data.assignment.passing_marks} marks
                      </div>
                    </div>
                    <div className="rounded-field border border-border p-3">
                      <span className="text-muted-foreground">Status</span>
                      <div className="font-semibold mt-1">
                        {data.group.is_submitted ? (
                          <span className="text-success-text font-bold">Work Submitted</span>
                        ) : (
                          <span className="text-amber-600 font-bold">Pending Submission</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground">
                      Ready to submit your group assignment?
                    </span>
                    <Link
                      href={`/student/assignments/${data.assignment.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                    >
                      <FileCode2 className="h-3.5 w-3.5" /> Go to Submission Page
                    </Link>
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        ) : null}
      </AsyncState>

      {/* Invite Modal */}
      {showInviteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-white p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-accent">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">Invite Teammate</h3>
                  <p className="text-xs text-muted-foreground">Select an eligible classmate from this course</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-muted-foreground hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search classmate by name or roll number…"
                className={`${inputClass} pl-9 text-xs`}
              />
            </div>

            {/* Classmates list */}
            <div className="max-h-[320px] min-h-[160px] overflow-y-auto space-y-2 pr-1">
              {loadingClassmates ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" /> Loading classmates…
                </div>
              ) : filteredClassmates.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No eligible classmates found.
                </div>
              ) : (
                filteredClassmates.map((c) => {
                  const isInvited = c.has_pending_invite;
                  const isGrouped = c.already_in_group;

                  return (
                    <div
                      key={c.student_id}
                      className="flex items-center justify-between rounded-field border border-border p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-primary">{c.student_name}</div>
                        {c.roll_number ? <div className="text-[11px] text-muted-foreground">Roll No: {c.roll_number}</div> : null}
                      </div>

                      {isGrouped ? (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          In Another Team
                        </span>
                      ) : isInvited ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                          Invite Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === `invite-${c.student_id}`}
                          onClick={() => handleSendInvite(c.student_id)}
                          className="inline-flex h-7 items-center gap-1 rounded-field bg-accent px-3 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                        >
                          {busy === `invite-${c.student_id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Invite
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="inline-flex h-8 items-center rounded-field border border-border px-4 text-xs font-semibold text-primary hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
