/**
 * C-TC-16 — one submission: files, feedback, score, review history.
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import {
  ActionError,
  PrimaryButton,
  StatusPill,
  submissionStatusTone,
} from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import {
  fetchTeacherSubmission,
  reviewTeacherSubmission,
  type TeacherReviewDecision,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function TeacherSubmissionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const submissionId = id ?? "";
  const resource = useResource(
    () =>
      submissionId
        ? fetchTeacherSubmission(submissionId)
        : Promise.reject(new Error("No submission ID provided")),
    [submissionId],
  );
  const [form, setForm] = useState({
    decision: "APPROVED" as TeacherReviewDecision,
    score: "",
    feedback: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewable = resource.data
    ? ["SUBMITTED", "UNDER_REVIEW", "RESUBMIT_REQUESTED"].includes(resource.data.status)
    : false;

  async function submitReview() {
    if (!resource.data) return;
    const score = form.score.trim() === "" ? null : Number(form.score);
    if (form.decision === "APPROVED" && score === null) {
      setError("Enter a score to approve the submission.");
      return;
    }
    const maxMarks = resource.data.milestone_marks ?? resource.data.total_marks;
    if (score !== null && (Number.isNaN(score) || score < 0 || score > maxMarks)) {
      setError(`Score must be between 0 and ${maxMarks}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await reviewTeacherSubmission(submissionId, {
        decision: form.decision,
        score,
        feedback: form.feedback.trim() || null,
      });
      resource.setData(updated);
      setForm({ decision: "APPROVED", score: "", feedback: "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Submission review" subtitle="One student's work — files, feedback, score and review history." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading submission…"
      >
        {resource.data ? (
          <View style={styles.stack}>
            <Card>
              <View style={styles.top}>
                <View style={styles.topText}>
                  <Text style={styles.name}>{resource.data.student_name}</Text>
                  <Text style={styles.meta}>
                    {resource.data.roll_number ?? "No roll number"} ·{" "}
                    <Link
                      href={{
                        pathname: "/(teacher)/assignments/[id]",
                        params: { id: resource.data.assignment_id },
                      }}
                      style={styles.inlineLink}
                    >
                      {resource.data.assignment_title}
                    </Link>
                    {resource.data.milestone_title ? ` · ${resource.data.milestone_title}` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    Submitted {dateTime(resource.data.submitted_at)} · v{resource.data.version}
                    {resource.data.is_late
                      ? ` · Late${resource.data.late_by_minutes ? ` by ${resource.data.late_by_minutes} min` : ""}`
                      : ""}
                  </Text>
                </View>
                <StatusPill
                  label={statusLabel(resource.data.status)}
                  tone={submissionStatusTone(resource.data.status)}
                />
              </View>
              {resource.data.text_response ? (
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>Written response</Text>
                  <Text style={styles.response}>{resource.data.text_response}</Text>
                </View>
              ) : null}
              {resource.data.files.length ? (
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>Files</Text>
                  {resource.data.files.map((file) => (
                    <View key={file.id} style={styles.fileRow}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.file_name}
                      </Text>
                      <Text style={styles.fileMeta}>
                        {(file.file_size_bytes / (1024 * 1024)).toFixed(2)} MB · {file.mime_type}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {resource.data.feedback && !reviewable ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.blockLabel}>Your feedback</Text>
                  <Text style={styles.feedbackBody}>{resource.data.feedback}</Text>
                  {resource.data.score !== null ? (
                    <Text style={styles.scoreLine}>
                      Score: {resource.data.score} / {resource.data.milestone_marks ?? resource.data.total_marks}
                      {resource.data.grade ? ` · Grade ${resource.data.grade}` : ""}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Card>

            {reviewable ? (
              <Card>
                <Text style={styles.cardTitle}>Review this submission</Text>
                <View style={styles.decisions}>
                  {(
                    [
                      ["APPROVED", "Approve"],
                      ["CHANGES_REQUESTED", "Request changes"],
                      ["REJECTED", "Reject"],
                    ] as [TeacherReviewDecision, string][]
                  ).map(([value, label]) => {
                    const active = form.decision === value;
                    const tone =
                      value === "APPROVED"
                        ? { borderColor: Colors.successBorder, backgroundColor: Colors.successLight, color: Colors.successText }
                        : value === "REJECTED"
                          ? {
                              borderColor: Colors.destructiveBorder,
                              backgroundColor: Colors.destructiveLight,
                              color: Colors.destructiveText,
                            }
                          : { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight, color: Colors.warningText };
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setForm({ ...form, decision: value })}
                        style={[
                          styles.decision,
                          active
                            ? { borderColor: tone.borderColor, backgroundColor: tone.backgroundColor }
                            : styles.decisionIdle,
                        ]}
                      >
                        <Text
                          style={[
                            styles.decisionLabel,
                            active ? { color: tone.color } : { color: Colors.mutedForeground },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.form}>
                  <TextField
                    label={`Score (0–${resource.data.milestone_marks ?? resource.data.total_marks})${form.decision === "APPROVED" ? " *" : ""}`}
                    value={form.score}
                    onChangeText={(score) => setForm({ ...form, score })}
                    keyboardType="numeric"
                  />
                  <TextField
                    label="Feedback for the student"
                    value={form.feedback}
                    onChangeText={(feedback) => setForm({ ...form, feedback })}
                  />
                  <ActionError message={error} />
                  <PrimaryButton label={busy ? "Saving…" : "Save review"} loading={busy} onPress={submitReview} />
                </View>
              </Card>
            ) : null}

            <Card>
              <Text style={styles.cardTitle}>Review history</Text>
              {resource.data.reviews.length ? (
                <View style={styles.history}>
                  {resource.data.reviews.map((review) => (
                    <View key={review.id} style={styles.historyItem}>
                      <Text style={styles.historyTitle}>
                        {statusLabel(review.decision)}
                        {review.marks_awarded !== null ? ` · ${review.marks_awarded} marks` : ""}
                      </Text>
                      <Text style={styles.historyMeta}>
                        attempt {review.attempt_number} · {review.reviewer_name ?? "Reviewer"} ·{" "}
                        {dateTime(review.reviewed_at)}
                      </Text>
                      {review.feedback ? <Text style={styles.historyFeedback}>{review.feedback}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyHistory}>No reviews yet — this is the first pass.</Text>
              )}
            </Card>
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  topText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  inlineLink: {
    fontWeight: "600",
    color: Colors.accent,
  },
  block: {
    marginTop: 16,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  response: {
    marginTop: 8,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.primary,
  },
  fileRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  fileMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  feedbackBox: {
    marginTop: 16,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(241,245,249,0.5)",
    padding: 16,
  },
  feedbackBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  scoreLine: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  decisions: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  decision: {
    height: 40,
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  decisionIdle: {
    borderColor: Colors.border,
  },
  decisionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  form: {
    marginTop: 16,
    gap: 16,
  },
  history: {
    marginTop: 12,
    gap: 12,
  },
  historyItem: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    paddingLeft: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  historyMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  historyFeedback: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  emptyHistory: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
});
