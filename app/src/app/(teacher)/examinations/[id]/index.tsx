/**
 * C-TC-09 — exam detail: edit draft, publish, jump to questions & results.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Send } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { TeacherExamForm } from "@/components/teacher-exam-form";
import { ActionError, PrimaryButton } from "@/components/teacher-ui";
import { PageHeader } from "@/components/ui";
import { fetchTeacherExam, publishTeacherExam } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function TeacherExamDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = id ?? "";
  const resource = useResource(
    () => (examId ? fetchTeacherExam(examId) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await publishTeacherExam(examId);
      if (resource.data) resource.setData({ ...resource.data, ...updated });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not publish this exam.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title={resource.data ? resource.data.title : "Exam"}
        subtitle="Edit the draft, manage its questions, then publish. Attempts and grading live under Results."
        action={
          resource.data ? (
            <View style={styles.actions}>
              <Link
                href={{ pathname: "/(teacher)/examinations/[id]/questions", params: { id: examId } }}
                style={styles.linkBtn}
              >
                Questions ({resource.data.question_count})
              </Link>
              <Link
                href={{ pathname: "/(teacher)/examinations/[id]/results", params: { id: examId } }}
                style={styles.linkBtn}
              >
                Results
              </Link>
              {resource.data.status === "DRAFT" ? (
                <PrimaryButton
                  label={busy ? "Publishing…" : "Publish"}
                  icon={Send}
                  loading={busy}
                  onPress={publish}
                />
              ) : null}
            </View>
          ) : undefined
        }
      />
      <ActionError message={actionError} />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading exam…">
        {resource.data ? (
          <TeacherExamForm
            initial={resource.data}
            examId={examId}
            key={`${resource.data.id}:${resource.data.status}`}
          />
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
});
