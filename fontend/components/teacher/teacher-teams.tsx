"use client";

import { useState } from "react";
import Link from "next/link";
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
  MessageSquare,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Card } from "@/components/admin/ui";
import { AsyncState, dateTime } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  fetchTeacherAssignments,
  fetchTeacherTeamWorkspace,
  type TeacherAssignmentRow,
  type TeacherTeamWorkspace,
} from "@/lib/teacher";
import { TeacherGroupsSection } from "@/components/assignment/group-management";

// ── Teacher Teams List Page ─────────────────────────────────────────────────

export function TeacherTeamsList() {
  const resource = useResource(() => fetchTeacherAssignments({ status: "ALL" }), []);
  const assignments = (resource.data?.items ?? []).filter((a) => a.assignment_type === "GROUP");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const activeAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId)
    : assignments[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Project Teams & Group Workspaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor student project teams, collaborate on group tasks, review team discussions, and manage rosters.
        </p>
      </div>

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading group assignments…">
        {assignments.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-base font-bold text-primary">No Group Projects Found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              You haven't created any group assignments yet. Create an assignment with type "Group Project" to form teams!
            </p>
            <div className="mt-4">
              <Link
                href="/teacher/assignments/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
              >
                Create Group Assignment
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Project Selection Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {assignments.map((a) => {
                const isSelected = (activeAssignment?.id === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAssignmentId(a.id)}
                    className={`inline-flex items-center gap-2 rounded-field px-3 py-2 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-accent text-white shadow-accent"
                        : "border border-border bg-white text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{a.title}</span>
                    <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-muted text-primary"}`}>
                      {a.class_name}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeAssignment ? (
              <div className="space-y-4">
                <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-base font-bold text-primary">{activeAssignment.title}</h2>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {activeAssignment.subject_code} · {activeAssignment.subject_name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Class: {activeAssignment.class_name} · Due: {dateTime(activeAssignment.due_date)} · {activeAssignment.group_count} Teams Formed
                    </p>
                  </div>

                  <Link
                    href={`/teacher/assignments/${activeAssignment.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-field border border-border px-3 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5" /> Assignment Details
                  </Link>
                </Card>

                <TeacherGroupsSection
                  assignmentId={activeAssignment.id}
                  minGroupSize={2}
                  maxGroupSize={6}
                />
              </div>
            ) : null}
          </div>
        )}
      </AsyncState>
    </div>
  );
}

// ── Teacher Single Team Workspace View ──────────────────────────────────────

export function TeacherTeamWorkspaceView({ groupId }: { groupId: string }) {
  const resource = useResource(() => fetchTeacherTeamWorkspace(groupId), [groupId]);
  const [activeTab, setActiveTab] = useState<"tasks" | "messages" | "resources" | "members">("tasks");

  const data = resource.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/teams"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Project Teams
        </Link>
      </div>

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading team workspace…">
        {data ? (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-bold text-primary">{data.group.name}</h1>
                    <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-bold text-accent">
                      {data.group.member_count} Students
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
                    Project: <span className="font-semibold text-primary">{data.assignment_title}</span> · {data.class_name} ({data.subject_name})
                  </p>
                </div>

                {data.submission ? (
                  <Link
                    href={`/teacher/submissions/${data.submission.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-field bg-accent px-3.5 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover"
                  >
                    <FileText className="h-3.5 w-3.5" /> Review Group Submission
                  </Link>
                ) : null}
              </div>

              {/* Tabs */}
              <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className={`inline-flex items-center gap-1.5 rounded-field px-3 py-1.5 transition ${
                    activeTab === "tasks" ? "bg-accent text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ListTodo className="h-3.5 w-3.5" /> Team Tasks ({data.tasks.length})
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
                  <Users className="h-3.5 w-3.5" /> Members ({data.group.members.length})
                </button>
              </div>
            </Card>

            {/* Content: Tasks */}
            {activeTab === "tasks" ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-primary">Student Task Breakdown</h2>
                {data.tasks.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-muted-foreground">The team has not created any subtasks yet.</Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["TODO", "IN_PROGRESS", "DONE"] as const).map((statusKey) => {
                      const colTasks = data.tasks.filter((t) => t.status === statusKey);
                      return (
                        <div key={statusKey} className="rounded-field border border-border bg-muted/10 p-3 space-y-2">
                          <div className="font-semibold text-xs text-primary border-b border-border/60 pb-1.5 flex justify-between">
                            <span>{statusKey === "TODO" ? "To Do" : statusKey === "IN_PROGRESS" ? "In Progress" : "Completed"}</span>
                            <span className="text-muted-foreground">{colTasks.length}</span>
                          </div>
                          <div className="space-y-2">
                            {colTasks.map((t) => (
                              <div key={t.id} className="rounded-field border border-border bg-white p-2.5 text-xs shadow-sm space-y-1">
                                <div className="font-medium text-primary">{t.title}</div>
                                {t.description ? <p className="text-[11px] text-muted-foreground">{t.description}</p> : null}
                                <div className="text-[10px] text-muted-foreground">
                                  {t.assignee_name ? `Assigned: ${t.assignee_name}` : "Unassigned"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Content: Messages */}
            {activeTab === "messages" ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-primary">Team Discussion Log</h2>
                <Card className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                  {data.messages.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6">No discussion messages logged by the team.</div>
                  ) : (
                    data.messages.map((m) => (
                      <div key={m.id} className="border-b border-border/60 pb-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-bold text-primary">{m.sender_name}</span>
                          <span>{dateTime(m.created_at)}</span>
                        </div>
                        <p className="text-primary">{m.message}</p>
                      </div>
                    ))
                  )}
                </Card>
              </div>
            ) : null}

            {/* Content: Resources */}
            {activeTab === "resources" ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-primary">Team Links & Repositories</h2>
                {data.resources.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-muted-foreground">No resources shared by this team.</Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.resources.map((r) => (
                      <Card key={r.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-muted text-primary">
                            {r.resource_type === "REPO" ? <FolderGit2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                          </div>
                          <div>
                            <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-accent flex items-center gap-1">
                              {r.title} <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-[10px] text-muted-foreground">Added by {r.creator_name || "Student"}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Content: Members */}
            {activeTab === "members" ? (
              <div className="space-y-4">
                <h2 className="font-display text-base font-bold text-primary">Team Members</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.group.members.map((m) => (
                    <Card key={m.student_id} className="p-4 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-primary">{m.student_name}</div>
                        {m.roll_number ? <div className="text-[11px] text-muted-foreground">Roll No: {m.roll_number}</div> : null}
                      </div>
                      {data.group.created_by === m.student_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                          <Crown className="h-3 w-3 text-amber-500" /> Leader
                        </span>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}
