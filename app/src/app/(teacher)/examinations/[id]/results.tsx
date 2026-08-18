/**
 * C-TC-11 — submissions for one exam: grade descriptive answers, release results.
 * Grading opens a dedicated screen so every question stem is readable.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { ActionError, PrimaryButton, StatusPill } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, percent, statusLabel } from "@/lib/format";
import { fetchExamAttempts, fetchTeacherExam, releaseExamResults } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

function attemptTone(status: string): "success" | "accent" | "danger" | "muted" {
  if (status === "GRADED") return "success";
  if (status === "IN_PROGRESS") return "accent";
  if (status === "MALPRACTICE" || status === "NOT_ATTEMPTED") return "danger";
  return "muted";
}

export default function TeacherExamResultsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = id ?? "";
  const exam = useResource(
    () => (examId ? fetchTeacherExam(examId) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const attempts = useResource(
    () => (examId ? fetchExamAttempts(examId, { limit: 100 }) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function release() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await releaseExamResults(examId);
      if (exam.data) exam.setData({ ...exam.data, ...updated });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not release the results.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title={exam.data ? `Results — ${exam.data.title}` : "Exam results"}
        subtitle="Grade descriptive answers, then release the results to students."
        action={
          <View style={styles.actions}>
            <Link href={{ pathname: "/(teacher)/examinations/[id]", params: { id: examId } }} style={styles.linkBtn}>
              Exam detail
            </Link>
            {exam.data && exam.data.status !== "RESULTS_RELEASED" && exam.data.status !== "DRAFT" ? (
              <PrimaryButton
                label={busy ? "Releasing…" : "Release results"}
                icon={Send}
                loading={busy}
                onPress={release}
              />
            ) : null}
          </View>
        }
      />
      <ActionError message={actionError} />
      <AsyncState
        loading={attempts.loading}
        error={attempts.error}
        onRetry={attempts.reload}
        loadingLabel="Loading attempts…"
      >
        {attempts.data ? (
          attempts.data.items.length ? (
            <View style={styles.list}>
              {attempts.data.items.map((attempt) => (
                <Card key={attempt.attempt_id}>
                  <View style={styles.top}>
                    <Text style={styles.name}>{attempt.student_name}</Text>
                    <StatusPill label={statusLabel(attempt.status)} tone={attemptTone(attempt.status)} />
                  </View>
                  <Text style={styles.meta}>{attempt.roll_number ?? "No roll number"}</Text>
                  <Text style={styles.meta}>
                    Submitted {attempt.submitted_at ? dateTime(attempt.submitted_at) : "—"}
                  </Text>
                  <Text style={styles.score}>
                    {attempt.total_score !== null
                      ? `${attempt.total_score}${attempt.grade ? ` · ${attempt.grade}` : ""}`
                      : "—"}
                    {attempt.percentage !== null ? `  (${percent(attempt.percentage)})` : ""}
                  </Text>
                  {attempt.pending_grading_count ? (
                    <Text style={styles.pending}>{attempt.pending_grading_count} answer(s) need grading</Text>
                  ) : null}
                  {attempt.status !== "IN_PROGRESS" ? (
                    <Link
                      href={{
                        pathname: "/(teacher)/examinations/[id]/attempts/[attemptId]",
                        params: { id: examId, attemptId: attempt.attempt_id },
                      }}
                      style={styles.open}
                    >
                      {attempt.pending_grading_count ? "Grade" : "Review"}
                    </Link>
                  ) : (
                    <Text style={styles.inProgress}>In progress</Text>
                  )}
                </Card>
              ))}
            </View>
          ) : (
            <Card padded={false}>
              <EmptyTable text="No student attempts yet." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  linkBtn: {
    height: 40,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    overflow: "hidden",
  },
  list: {
    gap: 12,
  },
  top: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  score: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  pending: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.warningText,
  },
  open: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  inProgress: {
    marginTop: 12,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
});
