/**
 * C-ST-07 examinations — port of StudentExamsPage in
 * fontend/components/student/student-examinations.tsx: every published exam
 * for the student's class.
 */

import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchStudentExams, type StudentExamRow } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const WHEN_FILTERS = [
  ["", "All"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
] as const;

export default function StudentExamsPage() {
  const [when, setWhen] = useState<string>("upcoming");
  const resource = useResource(
    () => fetchStudentExams({ when: (when || undefined) as "upcoming" | "completed" | "all" | undefined, limit: 100 }),
    [when],
  );

  return (
    <Screen>
      <PageHeader
        title="Examinations"
        subtitle="Your published exams. Upcoming shows active and scheduled exams; Completed shows past ones."
      />
      <View style={styles.filters}>
        {WHEN_FILTERS.map(([value, label]) => (
          <TouchableOpacity
            key={value || "ALL"}
            accessibilityState={{ selected: when === value }}
            onPress={() => setWhen(value)}
            style={[styles.filter, when === value && styles.filterActive]}
          >
            <Text style={[styles.filterLabel, when === value && styles.filterLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your exams…"
      >
        {resource.data ? (
          <Card padded={false}>
            {resource.data.items.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, styles.colExam]}>Exam</Text>
                    <Text style={[styles.th, styles.colSubject]}>Subject</Text>
                    <Text style={[styles.th, styles.colSchedule]}>Schedule</Text>
                    <Text style={[styles.th, styles.colMarks]}>Marks</Text>
                    <Text style={[styles.th, styles.colStatus]}>Status</Text>
                    <Text style={[styles.th, styles.colAction]}> </Text>
                  </View>
                  {resource.data.items.map((exam) => (
                    <ExamRow key={exam.id} exam={exam} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <EmptyTable text="No exams in this view yet." />
            )}
          </Card>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function ExamRow({ exam }: { exam: StudentExamRow }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.colExam}>
        <Text style={styles.examTitle}>{exam.title}</Text>
        <Text style={styles.examSub}>
          {statusLabel(exam.exam_type)} · {exam.mode} · {exam.duration_minutes} min
        </Text>
      </View>
      <Text style={[styles.td, styles.colSubject]}>{exam.subject_code}</Text>
      <View style={styles.colSchedule}>
        <Text style={styles.tdInner}>{dateTime(exam.scheduled_at)}</Text>
        {exam.window_end_at ? <Text style={styles.examSub}>until {dateTime(exam.window_end_at)}</Text> : null}
      </View>
      <View style={styles.colMarks}>
        <Text style={styles.tdInner}>
          {exam.total_marks} (pass {exam.passing_marks})
        </Text>
        {exam.my_score !== null ? <Text style={styles.scoredText}>Scored {exam.my_score}</Text> : null}
      </View>
      <View style={styles.colStatus}>
        {exam.my_attempt_status ? (
          <AttemptBadge status={exam.my_attempt_status} />
        ) : (
          <View
            style={[
              styles.badge,
              exam.status === "ONGOING" || exam.status === "PUBLISHED"
                ? { backgroundColor: Colors.accentLight }
                : { backgroundColor: Colors.muted },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                exam.status === "ONGOING" || exam.status === "PUBLISHED"
                  ? { color: Colors.accent }
                  : { color: Colors.mutedForeground },
              ]}
            >
              {statusLabel(exam.status)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.colAction}>
        {exam.can_attempt ? (
          <Link href={{ pathname: "/(student)/examinations/[id]/attempt", params: { id: exam.id } }} asChild>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonLabel}>Start exam</Text>
            </TouchableOpacity>
          </Link>
        ) : exam.result_available ? (
          <Link href={{ pathname: "/(student)/examinations/[id]/result", params: { id: exam.id } }} style={styles.resultLink}>
            View result
          </Link>
        ) : exam.my_attempt_status === "IN_PROGRESS" ? (
          <Link href={{ pathname: "/(student)/examinations/[id]/attempt", params: { id: exam.id } }} asChild>
            <TouchableOpacity style={styles.resumeButton}>
              <Text style={styles.resumeButtonLabel}>Resume</Text>
            </TouchableOpacity>
          </Link>
        ) : null}
      </View>
    </View>
  );
}

function AttemptBadge({ status }: { status: string }) {
  const style =
    status === "GRADED"
      ? { backgroundColor: Colors.successLight, color: Colors.successText }
      : status === "NOT_ATTEMPTED"
        ? { backgroundColor: Colors.destructiveLight, color: Colors.destructiveText }
        : status === "SUBMITTED"
          ? { backgroundColor: Colors.accentLight, color: Colors.accent }
          : status === "IN_PROGRESS"
            ? { backgroundColor: Colors.warningLight, color: Colors.warningText }
            : { backgroundColor: Colors.muted, color: Colors.mutedForeground };
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: style.color }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  filter: {
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  filterLabelActive: {
    color: Colors.accent,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
  },
  colExam: { width: 220, paddingHorizontal: 20 },
  colSubject: { width: 90, paddingHorizontal: 20, fontSize: 14, color: Colors.mutedForeground },
  colSchedule: { width: 170, paddingHorizontal: 20 },
  colMarks: { width: 140, paddingHorizontal: 20 },
  colStatus: { width: 130, paddingHorizontal: 20 },
  colAction: { width: 110, paddingHorizontal: 20, alignItems: "flex-end" },
  examTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  examSub: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  td: {
    fontSize: 14,
  },
  tdInner: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  scoredText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.successText,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  startButtonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  resultLink: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
  resumeButton: {
    borderRadius: Radius.field,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resumeButtonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.warningText,
  },
});
