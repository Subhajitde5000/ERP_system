/**
 * C-TC-07 — every exam this teacher created, filterable by status.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Plus } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { FilterChips, StatusPill, examStatusTone } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchTeacherExams } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "RESULTS_RELEASED", label: "Results released" },
];

export default function TeacherExamsPage() {
  const [status, setStatus] = useState("");
  const resource = useResource(
    () => fetchTeacherExams({ status: status || undefined, limit: 100 }),
    [status],
  );

  return (
    <Screen>
      <PageHeader
        title="Examinations"
        subtitle="Exams you created for your subjects. Drafts stay invisible to students until published."
        action={
          <Link href="/(teacher)/examinations/new" style={styles.create}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createLabel}>Create exam</Text>
          </Link>
        }
      />
      <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your exams…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((exam) => (
                <Card key={exam.id}>
                  <View style={styles.top}>
                    <Text style={styles.title}>{exam.title}</Text>
                    <StatusPill label={statusLabel(exam.status)} tone={examStatusTone(exam.status)} />
                  </View>
                  <Text style={styles.sub}>
                    {statusLabel(exam.exam_type)} · {exam.mode} · {exam.class_name} · {exam.subject_code}
                  </Text>
                  <Text style={styles.meta}>
                    {dateTime(exam.scheduled_at)} · {exam.total_marks} marks (pass {exam.passing_marks})
                  </Text>
                  <Text style={styles.meta}>
                    {exam.question_count} questions · {exam.attempt_count} attempts
                    {exam.pending_grading_count
                      ? ` · ${exam.pending_grading_count} to grade`
                      : ""}
                  </Text>
                  <Link
                    href={{ pathname: "/(teacher)/examinations/[id]", params: { id: exam.id } }}
                    style={styles.open}
                  >
                    {exam.status === "DRAFT" ? "Edit" : "Open"}
                  </Link>
                </Card>
              ))}
            </View>
          ) : (
            <Card padded={false}>
              <EmptyTable text="No exams here yet. Create your first exam to get started." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  create: {
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
  createLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  open: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
});
