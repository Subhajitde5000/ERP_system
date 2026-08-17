/**
 * C-ST-11 / C-ST-12 assignment detail — port of StudentAssignmentDetailPage in
 * fontend/components/student/student-assignments.tsx plus the StudentGroupSection
 * from fontend/components/assignment/group-management.tsx: brief, milestones
 * chain, group formation, submit/resubmit with files.
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
import { Link, useLocalSearchParams } from "expo-router";
import {
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Eye,
  FileText,
  Lock,
  LogOut,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { Image } from "expo-image";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { myStatusClass } from "@/app/(student)/assignments/index";
import { dateTime, statusLabel } from "@/lib/format";
import {
  createStudentAssignmentGroup,
  fetchStudentAssignment,
  fetchStudentAssignmentGroups,
  joinStudentAssignmentGroup,
  leaveStudentAssignmentGroup,
  reuseStudentAssignmentGroup,
  submitStudentAssignment,
  type StudentAssignmentDetail,
  type StudentSubmissionFileIn,
  type StudentSubmissionFileOut,
} from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentAssignmentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = id ?? "";
  const resource = useResource(
    () => (assignmentId ? fetchStudentAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const [submitFor, setSubmitFor] = useState<string | null | undefined>(undefined);
  const data = resource.data;

  const latest = data?.my_submissions[0] ?? null;
  const canSubmit = Boolean(
    data &&
      data.status === "PUBLISHED" &&
      (!latest || latest.status !== "APPROVED"),
  );

  return (
    <Screen>
      <PageHeader title={data ? data.title : "Assignment"} subtitle="The brief, your submissions and the teacher's feedback." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading assignment…"
      >
        {data ? (
          <View style={styles.stack}>
            <AssignmentBrief data={data} canSubmit={canSubmit} onSubmitClicked={() => setSubmitFor(null)} />
            {data.assignment_type === "GROUP" ? (
              <StudentGroupSection
                assignmentId={data.id}
                minGroupSize={data.min_group_size}
                maxGroupSize={data.max_group_size}
                isClosed={data.status === "CLOSED"}
                onGroupChanged={async () => {
                  await resource.reload();
                }}
              />
            ) : null}
            {data.milestones.length ? (
              <MilestoneChain data={data} onSubmitMilestone={(milestoneId) => setSubmitFor(milestoneId)} />
            ) : null}
            {submitFor !== undefined ? (
              <SubmissionComposer
                key={submitFor ?? "assignment"}
                data={data}
                milestoneId={submitFor}
                onDone={async (submitted) => {
                  setSubmitFor(undefined);
                  if (submitted) await resource.reload();
                }}
              />
            ) : null}
            <SubmissionsHistory data={data} onResubmit={(milestoneId) => setSubmitFor(milestoneId)} />
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

// ── Brief ────────────────────────────────────────────────────────────────────

function AssignmentBrief({
  data,
  canSubmit,
  onSubmitClicked,
}: {
  data: StudentAssignmentDetail;
  canSubmit: boolean;
  onSubmitClicked: () => void;
}) {
  return (
    <Card>
      <View style={styles.briefBadges}>
        <View style={[styles.pill, { backgroundColor: Colors.accentLight }]}>
          <Text style={[styles.pillText, { color: Colors.accent }]}>{statusLabel(data.assignment_type)}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: myStatusClass(data.my_status).backgroundColor }]}>
          <Text style={[styles.pillText, { color: myStatusClass(data.my_status).color }]}>
            {statusLabel(data.my_status)}
          </Text>
        </View>
        {data.assignment_type === "GROUP" && data.my_group ? (
          <View style={[styles.pill, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.pillText, { color: Colors.successText }]}>Group: {data.my_group.name}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.briefRows}>
        <BriefRow label="Subject" value={`${data.subject_code} · ${data.subject_name}`} />
        <BriefRow label="Teacher" value={data.teacher_name ?? "—"} />
        <BriefRow label="Marks" value={`${data.total_marks} total · pass ${data.passing_marks}`} />
        <BriefRow label="Due" value={dateTime(data.due_date)} />
        {data.assignment_type === "GROUP" ? (
          <BriefRow label="Group size" value={`${data.min_group_size} to ${data.max_group_size} members`} />
        ) : null}
        <BriefRow label="Late work" value={data.allow_late_submission ? "Accepted" : "Not accepted"} />
        <BriefRow
          label="Files"
          value={`${data.allowed_file_types.length ? data.allowed_file_types.map((ext) => `.${ext}`).join(" ") : "Any"} · up to ${data.max_file_size_mb} MB`}
        />
      </View>
      <Text style={styles.briefDescription}>{data.description}</Text>
      {data.instructions_url ? (
        <Pressable onPress={() => Linking.openURL(data.instructions_url!)}>
          <Text style={styles.referenceLink}>Reference material</Text>
        </Pressable>
      ) : null}
      {canSubmit && !data.milestones.length ? (
        <TouchableOpacity onPress={onSubmitClicked} style={styles.submitWork}>
          <Send size={16} color="#FFFFFF" />
          <Text style={styles.submitWorkLabel}>
            {data.my_submissions.length ? "Resubmit work" : "Submit work"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.briefRow}>
      <Text style={styles.briefRowLabel}>{label}</Text>
      <Text style={styles.briefRowValue}>{value}</Text>
    </View>
  );
}

// ── Group section (C-ST-11 groups) ──────────────────────────────────────────

function StudentGroupSection({
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

  async function handleCreate() {
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

  function handleLeave() {
    Alert.alert("Leave group", "Are you sure you want to leave this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
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
        },
      },
    ]);
  }

  return (
    <Card>
      <View style={styles.groupHeader}>
        <View style={styles.groupHeaderLeft}>
          <Users size={20} color={Colors.accent} />
          <Text style={styles.groupTitle}>Project Team / Group</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: Colors.muted }]}>
          <Text style={[styles.pillText, { color: Colors.mutedForeground }]}>
            Team Size: {minGroupSize}–{maxGroupSize} students
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.groupError}>
          <ShieldAlert size={16} color={Colors.destructiveText} />
          <Text style={styles.groupErrorText}>{error}</Text>
        </View>
      ) : null}

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading group info…">
        {groupData ? (
          <View style={styles.groupBody}>
            {myGroup ? (
              <View style={styles.myGroup}>
                <View style={styles.myGroupHeader}>
                  <View>
                    <View style={styles.myGroupTitleRow}>
                      <Text style={styles.myGroupName}>{myGroup.name}</Text>
                      <View style={[styles.pill, { backgroundColor: Colors.accentLight }]}>
                        <Text style={[styles.pillText, { color: Colors.accent }]}>Your Group</Text>
                      </View>
                      {myGroup.is_submitted ? (
                        <View style={[styles.pill, { backgroundColor: Colors.successLight }]}>
                          <CheckCircle2 size={12} color={Colors.successText} />
                          <Text style={[styles.pillText, { color: Colors.successText }]}>Submitted</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.myGroupMeta}>
                      {myGroup.member_count} of max {maxGroupSize} members
                      {myGroup.member_count < minGroupSize ? (
                        <Text style={{ color: Colors.warningText, fontWeight: "600" }}>
                          {" "}
                          (Need at least {minGroupSize - myGroup.member_count} more member to submit)
                        </Text>
                      ) : (
                        <Text style={{ color: Colors.successText, fontWeight: "600" }}> (Ready for submission)</Text>
                      )}
                    </Text>
                  </View>

                  {!myGroup.is_submitted && !isClosed ? (
                    <TouchableOpacity disabled={busy === "leave"} onPress={handleLeave} style={styles.leaveGroup}>
                      <LogOut size={14} color={Colors.destructiveText} />
                      <Text style={styles.leaveGroupLabel}>{busy === "leave" ? "Leaving…" : "Leave Group"}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.members}>
                  <Text style={styles.membersTitle}>Group Members</Text>
                  <View style={styles.membersGrid}>
                    {myGroup.members.map((m) => (
                      <View
                        key={m.student_id}
                        style={[
                          styles.member,
                          m.is_me ? { borderColor: "rgba(79,70,229,0.4)", backgroundColor: "rgba(238,242,255,0.2)" } : undefined,
                        ]}
                      >
                        <View style={styles.memberLeft}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>{m.student_name.charAt(0)}</Text>
                          </View>
                          <View>
                            <Text style={styles.memberName}>
                              {m.student_name}
                              {m.roll_number ? <Text style={styles.memberRoll}> ({m.roll_number})</Text> : null}
                              {m.is_me ? <Text style={styles.memberYou}> (You)</Text> : null}
                            </Text>
                          </View>
                        </View>
                        {myGroup.created_by === m.student_id ? (
                          <View style={styles.leaderChip}>
                            <Crown size={12} color="#F59E0B" />
                            <Text style={styles.leaderChipText}>Leader</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.groupBody}>
                <View style={styles.noGroupNotice}>
                  <Text style={styles.noGroupTitle}>You haven't joined a group yet.</Text>
                  <Text style={styles.noGroupBody}>
                    This is a group project. You can reuse a past team from another subject, create a new team, or
                    join an existing team.
                  </Text>
                </View>

                {previousGroups.length && !isClosed ? (
                  <View style={styles.reusePanel}>
                    <View style={styles.reuseHeading}>
                      <Sparkles size={16} color={Colors.accent} />
                      <Text style={styles.reuseTitle}>Reuse a Past Team</Text>
                    </View>
                    <Text style={styles.reuseBody}>
                      Save time by reusing your team from another subject or project. Your teammates will be added
                      automatically!
                    </Text>
                    <View style={styles.reuseGrid}>
                      {previousGroups.map((prev) => (
                        <View key={prev.group_id} style={styles.reuseCard}>
                          <Text style={styles.reuseCardName}>{prev.group_name}</Text>
                          <Text style={styles.reuseCardMeta}>
                            {prev.subject_name} · {prev.assignment_title}
                          </Text>
                          <Text style={styles.reuseCardMembers}>
                            {prev.members.map((m) => m.student_name).join(", ")}
                          </Text>
                          <TouchableOpacity
                            disabled={busy === `reuse-${prev.group_id}`}
                            onPress={() => handleReuse(prev.group_id)}
                            style={styles.reuseButton}
                          >
                            <Users size={12} color="#FFFFFF" />
                            <Text style={styles.reuseButtonLabel}>
                              {busy === `reuse-${prev.group_id}` ? "Reusing…" : "Reuse This Team"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {!isClosed ? (
                  showCreate ? (
                    <View style={styles.createPanel}>
                      <Text style={styles.createLabel}>New Group Name</Text>
                      <TextInput
                        style={styles.createInput}
                        value={newGroupName}
                        onChangeText={setNewGroupName}
                        placeholder="e.g. Team Phoenix"
                        placeholderTextColor={Colors.placeholder}
                      />
                      <View style={styles.createActions}>
                        <TouchableOpacity disabled={busy === "create"} onPress={handleCreate} style={styles.createButton}>
                          <Plus size={14} color="#FFFFFF" />
                          <Text style={styles.createButtonLabel}>{busy === "create" ? "Creating…" : "Create Team"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.createCancel}>
                          <Text style={styles.createCancelLabel}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.createOpen}>
                      <Plus size={14} color="#FFFFFF" />
                      <Text style={styles.createOpenLabel}>Create a New Group</Text>
                    </TouchableOpacity>
                  )
                ) : null}

                <View>
                  <Text style={styles.availableTitle}>Available Class Groups ({otherGroups.length})</Text>
                  {otherGroups.length ? (
                    <View style={styles.availableGrid}>
                      {otherGroups.map((g) => {
                        const isFull = g.member_count >= maxGroupSize;
                        const canJoin = !isFull && !g.is_submitted && !isClosed;
                        return (
                          <View key={g.id} style={styles.availableCard}>
                            <View style={styles.availableCardTop}>
                              <View>
                                <Text style={styles.availableCardName}>{g.name}</Text>
                                <Text style={styles.availableCardMeta}>
                                  {g.member_count}/{maxGroupSize} members
                                </Text>
                              </View>
                              {canJoin ? (
                                <TouchableOpacity
                                  disabled={busy === `join-${g.id}`}
                                  onPress={() => handleJoin(g.id)}
                                  style={styles.joinButton}
                                >
                                  <UserPlus size={12} color="#FFFFFF" />
                                  <Text style={styles.joinButtonLabel}>
                                    {busy === `join-${g.id}` ? "Joining…" : "Join"}
                                  </Text>
                                </TouchableOpacity>
                              ) : isFull ? (
                                <View style={[styles.pill, { backgroundColor: Colors.muted }]}>
                                  <Text style={[styles.pillText, { color: Colors.mutedForeground }]}>Full</Text>
                                </View>
                              ) : g.is_submitted ? (
                                <View style={[styles.pill, { backgroundColor: Colors.successLight }]}>
                                  <Text style={[styles.pillText, { color: Colors.successText }]}>Submitted</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.availableMembers}>
                              {g.members.map((m) => (
                                <View key={m.student_id} style={[styles.pill, { backgroundColor: Colors.muted }]}>
                                  <Text style={[styles.pillText, { color: Colors.mutedForeground, fontWeight: "400" }]}>
                                    {m.student_name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.availableEmpty}>No other groups created yet. Be the first to create one!</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : null}
      </AsyncState>
    </Card>
  );
}

// ── Milestone chain ──────────────────────────────────────────────────────────

function MilestoneChain({
  data,
  onSubmitMilestone,
}: {
  data: StudentAssignmentDetail;
  onSubmitMilestone: (milestoneId: string) => void;
}) {
  const approved = data.milestones.filter((m) => m.my_status === "APPROVED").length;
  const submitted = data.milestones.filter((m) => m.my_status && m.my_status !== "APPROVED").length;
  const total = data.milestones.length;
  const pct = Math.round((approved / Math.max(1, total)) * 100);

  return (
    <Card>
      <View style={styles.milestoneHeader}>
        <View>
          <Text style={styles.milestoneTitle}>Milestones</Text>
          <Text style={styles.milestoneSubtitle}>
            {approved}/{total} approved{submitted > 0 ? ` · ${submitted} under review` : ""} · stages unlock one by one
          </Text>
        </View>
        <View style={styles.milestoneProgressWrap}>
          <View style={styles.milestoneTrack}>
            <View style={[styles.milestoneFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.milestonePct}>{pct}%</Text>
        </View>
      </View>

      <View>
        {data.milestones.map((milestone, idx) => {
          const mine = milestone.my_status;
          const isApproved = mine === "APPROVED";
          const isUnderReview = mine === "SUBMITTED" || mine === "UNDER_REVIEW";
          const isResubmit = mine === "RESUBMIT_REQUESTED";
          const isLocked = !milestone.unlocked;
          const submittable =
            data.status === "PUBLISHED" && milestone.unlocked && (!mine || mine !== "APPROVED");
          const isLast = idx === data.milestones.length - 1;

          return (
            <View key={milestone.id} style={styles.chainRow}>
              <View style={styles.chainConnector}>
                <View
                  style={[
                    styles.chainCircle,
                    isApproved
                      ? { borderColor: Colors.successText, backgroundColor: Colors.successLight }
                      : isUnderReview
                        ? { borderColor: Colors.warningText, backgroundColor: Colors.warningLight }
                        : isResubmit
                          ? { borderColor: Colors.destructiveBorder, backgroundColor: Colors.destructiveLight }
                          : isLocked
                            ? { borderColor: Colors.border, backgroundColor: Colors.muted }
                            : { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
                  ]}
                >
                  {isApproved ? (
                    <CheckCircle2 size={16} color={Colors.successText} />
                  ) : isUnderReview ? (
                    <Clock size={14} color={Colors.warningText} />
                  ) : isLocked ? (
                    <Lock size={14} color={Colors.mutedForeground} />
                  ) : (
                    <Send size={12} color={Colors.accent} />
                  )}
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.chainLine,
                      {
                        backgroundColor: isApproved
                          ? "rgba(4,120,87,0.3)"
                          : isUnderReview
                            ? "rgba(180,83,9,0.3)"
                            : Colors.border,
                      },
                    ]}
                  />
                ) : null}
              </View>

              <View style={[styles.chainContent, !isLast && styles.chainContentGap]}>
                <View
                  style={[
                    styles.chainCard,
                    isApproved
                      ? { borderColor: "rgba(4,120,87,0.2)", backgroundColor: "rgba(236,253,245,0.3)" }
                      : isUnderReview
                        ? { borderColor: "rgba(180,83,9,0.2)", backgroundColor: "rgba(255,251,235,0.3)" }
                        : isResubmit
                          ? { borderColor: "rgba(254,202,202,0.3)", backgroundColor: "rgba(254,242,242,0.2)" }
                          : isLocked
                            ? { borderColor: Colors.border, backgroundColor: "rgba(241,245,249,0.3)" }
                            : { borderColor: "rgba(79,70,229,0.4)", backgroundColor: "rgba(238,242,255,0.2)" },
                  ]}
                >
                  <View style={styles.chainCardTop}>
                    <View style={styles.chainCardText}>
                      <Text style={[styles.chainCardTitle, isLocked && { color: Colors.mutedForeground }]}>
                        {milestone.sort_order + 1}. {milestone.title}
                        <Text style={styles.chainMarks}>  {milestone.marks} marks</Text>
                      </Text>
                      {milestone.description ? (
                        <Text style={styles.chainCardDescription}>{milestone.description}</Text>
                      ) : null}
                      <Text style={styles.chainCardStatus}>
                        {isLocked
                          ? "Locked — complete the previous stage first"
                          : mine
                            ? `${statusLabel(mine)}${milestone.my_score !== null ? ` · ${milestone.my_score}/${milestone.marks} marks` : ""}`
                            : "Unlocked — ready for your submission"}
                        {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                      </Text>
                    </View>
                    {submittable ? (
                      <TouchableOpacity onPress={() => onSubmitMilestone(milestone.id)} style={styles.chainSubmit}>
                        <Send size={12} color="#FFFFFF" />
                        <Text style={styles.chainSubmitLabel}>{mine ? "Resubmit" : "Submit"}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ── Submission composer ──────────────────────────────────────────────────────

function SubmissionComposer({
  data,
  milestoneId,
  onDone,
}: {
  data: StudentAssignmentDetail;
  milestoneId: string | null;
  onDone: (submitted: boolean) => Promise<void>;
}) {
  const milestone = milestoneId ? data.milestones.find((item) => item.id === milestoneId) : null;
  const [textResponse, setTextResponse] = useState("");
  const [files, setFiles] = useState<StudentSubmissionFileIn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!textResponse.trim() && !files.length) {
      setError("Write a response or attach at least one file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitStudentAssignment(data.id, {
        milestone_id: milestoneId,
        text_response: textResponse.trim() || null,
        files,
      });
      await onDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your work.");
    } finally {
      setBusy(false);
    }
  }

  function addFile() {
    setFiles((current) => [
      ...current,
      { file_name: "", file_key: "", file_size_bytes: 0, mime_type: "application/octet-stream" },
    ]);
  }

  return (
    <Card>
      <Text style={styles.composerTitle}>Submit{milestone ? ` — ${milestone.title}` : ""}</Text>
      <View style={styles.composerForm}>
        <View>
          <Text style={styles.fieldLabel}>Written response</Text>
          <TextInput
            style={styles.textArea}
            multiline
            maxLength={20000}
            value={textResponse}
            onChangeText={setTextResponse}
            placeholder="Write your answer, or leave blank and attach files."
            placeholderTextColor={Colors.placeholder}
          />
        </View>
        <View>
          <Text style={styles.fieldLabel}>
            Files ({data.allowed_file_types.length ? data.allowed_file_types.map((ext) => `.${ext}`).join(", ") : "any type"} · max{" "}
            {data.max_file_size_mb} MB each)
          </Text>
          {files.map((file, index) => (
            <View key={index} style={styles.fileRow}>
              <TextInput
                accessibilityLabel={`File ${index + 1} name`}
                style={[styles.fileInput, styles.fileInputWide]}
                placeholder="report.pdf"
                placeholderTextColor={Colors.placeholder}
                value={file.file_name}
                onChangeText={(file_name) =>
                  setFiles((current) => current.map((item, i) => (i === index ? { ...item, file_name } : item)))
                }
              />
              <TextInput
                accessibilityLabel={`File ${index + 1} storage key`}
                style={[styles.fileInput, styles.fileInputWide]}
                placeholder="storage key (uploads/…/report.pdf)"
                placeholderTextColor={Colors.placeholder}
                value={file.file_key}
                onChangeText={(file_key) =>
                  setFiles((current) => current.map((item, i) => (i === index ? { ...item, file_key } : item)))
                }
              />
              <TextInput
                accessibilityLabel={`File ${index + 1} size in bytes`}
                style={[styles.fileInput, styles.fileInputNarrow]}
                keyboardType="number-pad"
                placeholder="size (bytes)"
                placeholderTextColor={Colors.placeholder}
                value={file.file_size_bytes ? String(file.file_size_bytes) : ""}
                onChangeText={(value) =>
                  setFiles((current) =>
                    current.map((item, i) => (i === index ? { ...item, file_size_bytes: Number(value) || 0 } : item)),
                  )
                }
              />
              <TouchableOpacity
                accessibilityLabel={`Remove file ${index + 1}`}
                onPress={() => setFiles((current) => current.filter((_, i) => i !== index))}
                style={styles.fileRemove}
              >
                <Trash2 size={14} color={Colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
          {files.length < 10 ? (
            <TouchableOpacity onPress={addFile} style={styles.fileAdd}>
              <Plus size={14} color={Colors.primary} />
              <Text style={styles.fileAddLabel}>Add file</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? <Text style={styles.composerError}>{error}</Text> : null}
        <View style={styles.composerActions}>
          <TouchableOpacity disabled={busy} onPress={submit} style={[styles.composerSubmit, busy && styles.disabled]}>
            <Send size={16} color="#FFFFFF" />
            <Text style={styles.composerSubmitLabel}>{busy ? "Submitting…" : "Submit"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDone(false)} style={styles.composerCancel}>
            <Text style={styles.composerCancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

// ── Submissions history ──────────────────────────────────────────────────────

function SubmissionsHistory({
  data,
  onResubmit,
}: {
  data: StudentAssignmentDetail;
  onResubmit?: (milestoneId: string | null) => void;
}) {
  const [previewFile, setPreviewFile] = useState<StudentSubmissionFileOut | null>(null);

  if (!data.my_submissions.length) return null;
  return (
    <Card>
      <Text style={styles.historyTitle}>My submissions</Text>
      <View style={styles.historyList}>
        {data.my_submissions.map((submission, index) => {
          const isLatestForStage = index === 0;
          const canResubmitThis =
            isLatestForStage && data.status === "PUBLISHED" && submission.status !== "APPROVED" && onResubmit;

          return (
            <View key={submission.id} style={styles.historyItem}>
              <View style={styles.historyItemTop}>
                <Text style={styles.historyItemTitle}>
                  v{submission.version} · {dateTime(submission.submitted_at)}
                  {submission.milestone_id
                    ? ` · ${data.milestones.find((milestone) => milestone.id === submission.milestone_id)?.title ?? "Milestone"}`
                    : ""}
                </Text>
                <View style={styles.historyItemActions}>
                  <View style={[styles.pill, { backgroundColor: myStatusClass(submission.status).backgroundColor }]}>
                    <Text style={[styles.pillText, { color: myStatusClass(submission.status).color }]}>
                      {statusLabel(submission.status)}
                      {submission.is_late ? " · LATE" : ""}
                    </Text>
                  </View>
                  {canResubmitThis ? (
                    <TouchableOpacity onPress={() => onResubmit(submission.milestone_id)} style={styles.resubmitButton}>
                      <Send size={12} color={Colors.accent} />
                      <Text style={styles.resubmitLabel}>Resubmit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              {submission.text_response ? (
                <Text style={styles.historyText}>{submission.text_response}</Text>
              ) : null}
              {submission.files.length ? (
                <View style={styles.historyFiles}>
                  <Text style={styles.historyFilesTitle}>Submitted Files</Text>
                  <View style={styles.historyFileList}>
                    {submission.files.map((file) => (
                      <View key={file.id} style={styles.historyFile}>
                        <View style={styles.historyFileLeft}>
                          <FileText size={16} color={Colors.accent} />
                          <Text style={styles.historyFileName} numberOfLines={1}>
                            {file.file_name}
                          </Text>
                          <Text style={styles.historyFileSize}>({(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB)</Text>
                        </View>
                        <View style={styles.historyFileActions}>
                          <TouchableOpacity onPress={() => setPreviewFile(file)} style={styles.historyFileButton}>
                            <Eye size={12} color={Colors.accent} />
                            <Text style={styles.historyFileButtonLabel}>Preview</Text>
                          </TouchableOpacity>
                          <Pressable
                            onPress={() =>
                              Linking.openURL(
                                file.file_key.startsWith("http") || file.file_key.startsWith("/")
                                  ? file.file_key
                                  : `/${file.file_key}`,
                              )
                            }
                            style={styles.historyFileButton}
                          >
                            <ExternalLink size={12} color={Colors.primary} />
                            <Text style={[styles.historyFileButtonLabel, { color: Colors.primary }]}>Open</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {submission.score !== null ? (
                <Text style={styles.historyScore}>
                  Score: {submission.score}
                  {submission.grade ? ` · Grade ${submission.grade}` : ""}
                </Text>
              ) : null}
              {submission.feedback ? (
                <Text style={styles.historyFeedback}>Teacher feedback: {submission.feedback}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {previewFile ? <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </Card>
  );
}

function FilePreviewModal({
  file,
  onClose,
}: {
  file: StudentSubmissionFileOut;
  onClose: () => void;
}) {
  const url = file.file_key.startsWith("http") || file.file_key.startsWith("/") ? file.file_key : `/${file.file_key}`;
  const isImage = file.mime_type.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(file.file_name);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => undefined}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIcon}>
                <FileText size={16} color={Colors.accent} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalFileName} numberOfLines={1}>
                  {file.file_name}
                </Text>
                <Text style={styles.modalFileMeta}>
                  {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB · {file.mime_type}
                </Text>
              </View>
            </View>
            <TouchableOpacity accessibilityLabel="Close modal" onPress={onClose} style={styles.modalClose}>
              <X size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {isImage ? (
              <View style={styles.modalImageWrap}>
                <Image source={{ uri: url }} style={styles.modalImage} contentFit="contain" />
              </View>
            ) : (
              <View style={styles.modalFallback}>
                <FileText size={48} color="rgba(100,116,139,0.6)" />
                <Text style={styles.modalFallbackName}>{file.file_name}</Text>
                <Text style={styles.modalFallbackMeta}>
                  File path / key: <Text style={styles.modalFallbackKey}>{file.file_key}</Text>
                </Text>
                <Text style={styles.modalFallbackNote}>
                  This document can be opened in a new tab or downloaded directly.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Text style={styles.modalUploaded}>Uploaded {dateTime(file.uploaded_at)}</Text>
            <View style={styles.modalFooterActions}>
              <Pressable onPress={() => Linking.openURL(url)} style={styles.modalOpen}>
                <ExternalLink size={14} color="#FFFFFF" />
                <Text style={styles.modalOpenLabel}>Open / Download</Text>
              </Pressable>
              <TouchableOpacity onPress={onClose} style={styles.modalDone}>
                <Text style={styles.modalDoneLabel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  briefBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  briefRows: {
    gap: 8,
  },
  briefRow: {
    flexDirection: "row",
    gap: 8,
  },
  briefRowLabel: {
    width: 112,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  briefRowValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  briefDescription: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  referenceLink: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.accent,
  },
  submitWork: {
    marginTop: 16,
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
  submitWorkLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  groupHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  groupHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  groupError: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(254,202,202,0.5)",
    backgroundColor: "rgba(254,242,242,0.3)",
    padding: 12,
  },
  groupErrorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.destructiveText,
  },
  groupBody: {
    marginTop: 16,
    gap: 16,
  },
  myGroup: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    backgroundColor: "rgba(238,242,255,0.1)",
    padding: 16,
  },
  myGroupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(79,70,229,0.2)",
    paddingBottom: 12,
  },
  myGroupTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  myGroupName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  myGroupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  leaveGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    paddingHorizontal: 12,
  },
  leaveGroupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.destructiveText,
  },
  members: {
    marginTop: 12,
  },
  membersTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: Colors.mutedForeground,
  },
  membersGrid: {
    marginTop: 8,
    gap: 8,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 10,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  memberAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  memberName: {
    fontSize: 12,
    color: Colors.primary,
  },
  memberRoll: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  memberYou: {
    fontSize: 10,
    color: Colors.accent,
  },
  leaderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leaderChipText: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  noGroupNotice: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(253,230,138,0.4)",
    backgroundColor: "rgba(255,251,235,0.2)",
    padding: 16,
  },
  noGroupTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.warningText,
  },
  noGroupBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
  },
  reusePanel: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.3)",
    backgroundColor: "rgba(238,242,255,0.1)",
    padding: 16,
  },
  reuseHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reuseTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  reuseBody: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.mutedForeground,
  },
  reuseGrid: {
    marginTop: 12,
    gap: 12,
  },
  reuseCard: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  reuseCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  reuseCardMeta: {
    fontSize: 11,
    color: Colors.accent,
  },
  reuseCardMembers: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  reuseButton: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Shadow.accent,
  },
  reuseButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  createPanel: {
    gap: 8,
  },
  createLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  createInput: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.primary,
  },
  createActions: {
    flexDirection: "row",
    gap: 8,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  createButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  createCancel: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  createCancelLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  createOpen: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  createOpenLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  availableTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: Colors.mutedForeground,
  },
  availableGrid: {
    gap: 12,
  },
  availableCard: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  availableCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  availableCardName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  availableCardMeta: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    ...Shadow.accent,
  },
  joinButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  availableMembers: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  availableEmpty: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    padding: 16,
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  milestoneSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  milestoneProgressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  milestoneTrack: {
    width: 96,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.muted,
    overflow: "hidden",
  },
  milestoneFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  milestonePct: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  chainRow: {
    flexDirection: "row",
    gap: 16,
  },
  chainConnector: {
    alignItems: "center",
  },
  chainCircle: {
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  chainLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  chainContent: {
    flex: 1,
  },
  chainContentGap: {
    paddingBottom: 24,
  },
  chainCard: {
    borderRadius: Radius.field,
    borderWidth: 1,
    padding: 12,
  },
  chainCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  chainCardText: {
    flex: 1,
  },
  chainCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  chainMarks: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  chainCardDescription: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  chainCardStatus: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  chainSubmit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    ...Shadow.accent,
  },
  chainSubmitLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  composerForm: {
    marginTop: 16,
    gap: 16,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  textArea: {
    minHeight: 112,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.primary,
    textAlignVertical: "top",
  },
  fileRow: {
    marginBottom: 8,
    gap: 8,
  },
  fileInput: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.primary,
  },
  fileInputWide: {},
  fileInputNarrow: {},
  fileRemove: {
    alignSelf: "flex-start",
    width: 36,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fileAdd: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    height: 32,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
  },
  fileAddLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  composerError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  composerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  composerSubmit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    ...Shadow.accent,
  },
  composerSubmitLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  composerCancel: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  composerCancelLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  disabled: {
    opacity: 0.6,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  historyList: {
    marginTop: 16,
    gap: 16,
  },
  historyItem: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  historyItemTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  historyItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resubmitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
  },
  resubmitLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  historyText: {
    marginTop: 8,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    padding: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  historyFiles: {
    marginTop: 12,
    gap: 6,
  },
  historyFilesTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  historyFileList: {
    gap: 6,
  },
  historyFile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyFileLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  historyFileName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
    color: Colors.primary,
  },
  historyFileSize: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  historyFileActions: {
    flexDirection: "row",
    gap: 6,
  },
  historyFileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  historyFileButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.accent,
  },
  historyScore: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  historyFeedback: {
    marginTop: 4,
    fontSize: 14,
    fontStyle: "italic",
    color: Colors.mutedForeground,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 672,
    maxHeight: "90%",
    borderRadius: Radius.card,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: 16,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderText: {
    flex: 1,
  },
  modalFileName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  modalFileMeta: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: Radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flexGrow: 0,
    padding: 16,
  },
  modalImageWrap: {
    borderRadius: Radius.field,
    backgroundColor: "rgba(241,245,249,0.4)",
    padding: 16,
    alignItems: "center",
  },
  modalImage: {
    width: "100%",
    height: 320,
    borderRadius: 4,
  },
  modalFallback: {
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.3)",
    padding: 24,
    alignItems: "center",
  },
  modalFallbackName: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  modalFallbackMeta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  modalFallbackKey: {
    fontSize: 11,
  },
  modalFallbackNote: {
    marginTop: 16,
    fontSize: 12,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.2)",
    padding: 16,
  },
  modalUploaded: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  modalFooterActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalOpen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  modalOpenLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalDone: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
});
