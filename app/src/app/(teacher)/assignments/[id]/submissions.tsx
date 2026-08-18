/**
 * C-TC-15 — every submission for one assignment, with review actions.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { FilterChips, StatusPill, submissionStatusTone } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchTeacherAssignment, fetchTeacherSubmissions } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "RESUBMIT_REQUESTED", label: "Resubmit requested" },
];

export default function TeacherAssignmentSubmissionsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = id ?? "";
  const assignment = useResource(
    () =>
      assignmentId
        ? fetchTeacherAssignment(assignmentId)
        : Promise.reject(new Error("No assignment ID provided")),
    [assignmentId],
  );
  const [status, setStatus] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const resource = useResource(
    () =>
      fetchTeacherSubmissions({
        assignmentId,
        milestoneId: milestoneId || undefined,
        status: status || undefined,
        limit: 100,
      }),
    [assignmentId, milestoneId, status],
  );

  const milestoneFilters = [
    { value: "", label: "All stages" },
    ...(assignment.data?.milestones ?? []).map((m, idx) => ({
      value: m.id,
      label: `Stage ${idx + 1}: ${m.title}`,
    })),
  ];

  return (
    <Screen>
      <PageHeader
        title={assignment.data ? `Submissions — ${assignment.data.title}` : "Submissions"}
        subtitle="Review each student's work: approve, reject, or ask for a resubmission."
        action={
          <Link href={{ pathname: "/(teacher)/assignments/[id]", params: { id: assignmentId } }} style={styles.linkBtn}>
            Assignment detail
          </Link>
        }
      />
      <Text style={styles.filterLabel}>Status</Text>
      <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
      {assignment.data?.milestones.length ? (
        <>
          <Text style={styles.filterLabel}>Stage</Text>
          <FilterChips options={milestoneFilters} value={milestoneId} onChange={setMilestoneId} />
        </>
      ) : null}
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading submissions…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((submission) => (
                <Card key={submission.id}>
                  <View style={styles.top}>
                    <Text style={styles.name}>{submission.student_name}</Text>
                    <StatusPill label={statusLabel(submission.status)} tone={submissionStatusTone(submission.status)} />
                  </View>
                  <Text style={styles.meta}>
                    {submission.roll_number ?? "No roll number"}
                    {submission.group_name ? ` · Team: ${submission.group_name}` : ""}
                    {submission.milestone_title ? ` · ${submission.milestone_title}` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {dateTime(submission.submitted_at)} · v{submission.version}
                    {submission.is_late
                      ? ` · Late${submission.late_by_minutes ? ` by ${submission.late_by_minutes} min` : ""}`
                      : ""}
                  </Text>
                  <Text style={styles.score}>
                    {submission.score !== null
                      ? `${submission.score}${submission.grade ? ` · ${submission.grade}` : ""}`
                      : "—"}
                  </Text>
                  <Link
                    href={{ pathname: "/(teacher)/submissions/[id]", params: { id: submission.id } }}
                    style={styles.open}
                  >
                    Review
                  </Link>
                </Card>
              ))}
            </View>
          ) : (
            <Card padded={false}>
              <EmptyTable text="No submissions match this filter." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  filterLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
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
  open: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
});
