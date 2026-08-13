"use client";

import { useState } from "react";
import { CheckCircle2, Crown, History, LogOut, Plus, ShieldAlert, Sparkles, UserMinus, UserPlus, Users } from "lucide-react";
import { Card, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, dateTime } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  createStudentAssignmentGroup,
  fetchStudentAssignmentGroups,
  joinStudentAssignmentGroup,
  leaveStudentAssignmentGroup,
  reuseStudentAssignmentGroup,
  type StudentGroupRow,
} from "@/lib/student";
import {
  fetchTeacherAssignmentGroups,
  removeStudentFromGroup,
  type TeacherGroupRow,
} from "@/lib/teacher";

// ── Student Group Section ───────────────────────────────────────────────────

export function StudentGroupSection({
  assignmentId,
  minGroupSize,
  maxGroupSize,
  isClosed,
  onGroupChanged,
}: {
  assignmentId: string;
  minGroupSize: number;
  maxGroupSize: number;
  isClosed?: boolean;
  onGroupChanged?: () => void;
}) {
  const resource = useResource(() => fetchStudentAssignmentGroups(assignmentId), [assignmentId]);
  const [newGroupName, setNewGroupName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const groupData = resource.data;
  const myGroup = groupData?.my_group;
  const otherGroups = (groupData?.groups ?? []).filter((g) => !g.is_my_group);
  const previousGroups = groupData?.previous_groups ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setBusy("create");
    setError(null);
    try {
      await createStudentAssignmentGroup(assignmentId, newGroupName.trim());
      setNewGroupName("");
      setShowCreate(false);
      await resource.reload();
      onGroupChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setBusy(null);
    }
  }

  async function handleReuse(previousGroupId: string) {
    setBusy(`reuse-${previousGroupId}`);
    setError(null);
    try {
      await reuseStudentAssignmentGroup(assignmentId, previousGroupId);
      await resource.reload();
      onGroupChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reuse group");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin(groupId: string) {
    setBusy(`join-${groupId}`);
    setError(null);
    try {
      await joinStudentAssignmentGroup(assignmentId, groupId);
      await resource.reload();
      onGroupChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
    } finally {
      setBusy(null);
    }
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this group?")) return;
    setBusy("leave");
    setError(null);
    try {
      await leaveStudentAssignmentGroup(assignmentId);
      await resource.reload();
      onGroupChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave group");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          <h2 className="font-display text-base font-bold text-primary">Project Team / Group</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            Team Size: {minGroupSize}–{maxGroupSize} students
          </span>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-field border border-destructive-border/50 bg-destructive-light/30 p-3 text-xs text-destructive-text">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading group info…">
        {groupData ? (
          <div className="space-y-4">
            {myGroup ? (
              <div className="rounded-field border border-accent/30 bg-accent-light/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/20 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-primary">{myGroup.name}</span>
                      <span className="rounded-full bg-accent-light px-2.5 py-0.5 text-[10px] font-bold text-accent">
                        Your Group
                      </span>
                      {myGroup.is_submitted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success-text">
                          <CheckCircle2 className="h-3 w-3" /> Submitted
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {myGroup.member_count} of max {maxGroupSize} members
                      {myGroup.member_count < minGroupSize ? (
                        <span className="ml-1 font-semibold text-warning-text">
                          (Need at least {minGroupSize - myGroup.member_count} more member to submit)
                        </span>
                      ) : (
                        <span className="ml-1 font-semibold text-success-text">(Ready for submission)</span>
                      )}
                    </p>
                  </div>

                  {!myGroup.is_submitted && !isClosed ? (
                    <button
                      type="button"
                      disabled={busy === "leave"}
                      onClick={handleLeave}
                      className="inline-flex h-8 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light disabled:opacity-60"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {busy === "leave" ? "Leaving…" : "Leave Group"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Members</h4>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {myGroup.members.map((m) => (
                      <div
                        key={m.student_id}
                        className={`flex items-center justify-between rounded-field border p-2.5 text-xs transition ${
                          m.is_me ? "border-accent/40 bg-accent-light/20 font-semibold text-primary" : "border-border bg-white text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-primary">
                            {m.student_name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-primary">{m.student_name}</span>
                            {m.roll_number ? <span className="ml-1 text-[11px] text-muted-foreground">({m.roll_number})</span> : null}
                            {m.is_me ? <span className="ml-1 text-[10px] text-accent">(You)</span> : null}
                          </div>
                        </div>
                        {myGroup.created_by === m.student_id ? (
                          <span title="Group Creator" className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            <Crown className="h-3 w-3 text-amber-500" /> Leader
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-field border border-warning-border/40 bg-warning-light/20 p-4 text-xs text-warning-text">
                  <p className="font-semibold">You haven't joined a group yet.</p>
                  <p className="mt-1 text-muted-foreground">
                    This is a group project. You can reuse a past team from another subject, create a new team, or join an existing team.
                  </p>
                </div>

                {/* Reuse Past Teams from other subjects */}
                {previousGroups.length && !isClosed ? (
                  <div className="space-y-2 rounded-field border border-accent/30 bg-accent-light/10 p-4">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-accent" />
                      <h3 className="font-display text-sm font-bold text-primary">Reuse a Past Team</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Save time by reusing your team from another subject or project. Your teammates will be added automatically!
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {previousGroups.map((prev) => (
                        <div key={prev.group_id} className="rounded-field border border-border bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-primary">{prev.group_name}</h4>
                              <span className="text-[11px] text-muted-foreground">
                                From: {prev.subject_name} ({prev.assignment_title}) · {prev.member_count} members
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={busy === `reuse-${prev.group_id}`}
                              onClick={() => handleReuse(prev.group_id)}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-field bg-accent px-2.5 text-[11px] font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                            >
                              <History className="h-3 w-3" />
                              {busy === `reuse-${prev.group_id}` ? "Setting up…" : "Use This Team"}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {prev.members.map((m) => (
                              <span
                                key={m.student_id}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                                  m.is_me ? "bg-accent-light font-semibold text-accent" : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {m.student_name} {m.is_me ? "(You)" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!isClosed ? (
                  showCreate ? (
                    <form onSubmit={handleCreate} className="space-y-3 rounded-field border border-border bg-muted/20 p-4">
                      <h3 className="font-display text-sm font-bold text-primary">Create a New Team</h3>
                      <div>
                        <label htmlFor="group-name-input" className={labelClass}>Group / Project Name</label>
                        <input
                          id="group-name-input"
                          type="text"
                          className={inputClass}
                          placeholder="e.g. Phoenix Team, Group Alpha..."
                          maxLength={100}
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy === "create" || !newGroupName.trim()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {busy === "create" ? "Creating…" : "Create Team"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreate(false)}
                          className="inline-flex h-9 items-center rounded-field border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent transition hover:bg-accent-hover"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create a New Group
                      </button>
                    </div>
                  )
                ) : null}

                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Available Class Groups ({otherGroups.length})
                  </h3>
                  {otherGroups.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {otherGroups.map((g) => {
                        const isFull = g.member_count >= maxGroupSize;
                        const canJoin = !isFull && !g.is_submitted && !isClosed;
                        return (
                          <div key={g.id} className="rounded-field border border-border bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-semibold text-primary">{g.name}</h4>
                                <span className="text-[11px] text-muted-foreground">
                                  {g.member_count}/{maxGroupSize} members
                                </span>
                              </div>
                              {canJoin ? (
                                <button
                                  type="button"
                                  disabled={busy === `join-${g.id}`}
                                  onClick={() => handleJoin(g.id)}
                                  className="inline-flex h-7 items-center gap-1 rounded-field bg-accent px-2.5 text-[11px] font-semibold text-white shadow-accent hover:bg-accent-hover disabled:opacity-60"
                                >
                                  <UserPlus className="h-3 w-3" />
                                  {busy === `join-${g.id}` ? "Joining…" : "Join"}
                                </button>
                              ) : isFull ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  Full
                                </span>
                              ) : g.is_submitted ? (
                                <span className="rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-success-text">
                                  Submitted
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {g.members.map((m) => (
                                <span
                                  key={m.student_id}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {m.student_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-field border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No other groups created yet. Be the first to create one!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </AsyncState>
    </Card>
  );
}

// ── Teacher Groups Section ──────────────────────────────────────────────────

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

  async function handleRemoveMember(groupId: string, studentId: string, studentName: string) {
    if (!confirm(`Remove ${studentName} from this group?`)) return;
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
  }

  const groups = resource.data?.items ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          <h2 className="font-display text-base font-bold text-primary">Student Project Groups</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">
            Requirement: {minGroupSize}–{maxGroupSize} students/group
          </span>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-field border border-destructive-border/50 bg-destructive-light/30 p-3 text-xs text-destructive-text">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading groups…">
        {groups.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <div key={group.id} className="rounded-field border border-border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
                  <div>
                    <h3 className="font-display font-bold text-primary">{group.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Created by {group.creator_name ?? "Student"} · {group.member_count}/{maxGroupSize} members
                    </p>
                  </div>
                  {group.is_submitted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.5 text-[10px] font-bold text-success-text">
                      <CheckCircle2 className="h-3 w-3" /> Submitted
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Forming
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Members:</span>
                  <div className="space-y-1">
                    {group.members.map((m) => (
                      <div key={m.student_id} className="flex items-center justify-between rounded bg-muted/40 px-2.5 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-primary">{m.student_name}</span>
                          {m.roll_number ? <span className="text-[11px] text-muted-foreground">({m.roll_number})</span> : null}
                          {group.created_by === m.student_id ? (
                            <span title="Leader"><Crown className="h-3 w-3 text-amber-500" /></span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          title="Remove student from group"
                          disabled={busy === `rm-${m.student_id}`}
                          onClick={() => handleRemoveMember(group.id, m.student_id, m.student_name)}
                          className="text-muted-foreground hover:text-destructive-text disabled:opacity-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-field border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="font-semibold text-primary">No student groups created yet</p>
            <p className="mt-1">Students enrolled in this class will form their groups here.</p>
          </div>
        )}
      </AsyncState>
    </Card>
  );
}
