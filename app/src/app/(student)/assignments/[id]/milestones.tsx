/**
 * C-ST-12 milestone progress — port of StudentAssignmentMilestonesPage in
 * fontend/components/student/student-assignments.tsx: full stepper, no submit
 * actions.
 */

import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Clock, Lock } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, statusLabel } from "@/lib/format";
import { fetchStudentAssignment } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function StudentAssignmentMilestonesPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignmentId = id ?? "";
  const resource = useResource(
    () => (assignmentId ? fetchStudentAssignment(assignmentId) : Promise.reject(new Error("No assignment ID provided"))),
    [assignmentId],
  );
  const data = resource.data;

  return (
    <Screen>
      <PageHeader
        title={data ? `Milestones — ${data.title}` : "Milestone progress"}
        subtitle="Stages unlock in order once the previous one is approved."
        action={
          <Link
            href={{ pathname: "/(student)/assignments/[id]", params: { id: assignmentId } }}
            style={styles.detailLink}
          >
            Assignment detail
          </Link>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading milestones…"
      >
        {data ? (
          data.milestones.length ? (
            <Card>
              {(() => {
                const approved = data.milestones.filter((m) => m.my_status === "APPROVED").length;
                const underReview = data.milestones.filter((m) => m.my_status === "SUBMITTED" || m.my_status === "UNDER_REVIEW").length;
                const pct = Math.round((approved / data.milestones.length) * 100);
                return (
                  <View style={styles.progress}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLabel}>
                        {approved} of {data.milestones.length} approved
                        {underReview > 0 ? ` · ${underReview} under review` : ""}
                      </Text>
                      <Text style={styles.progressLabel}>{pct}%</Text>
                    </View>
                    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Milestone progress">
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })()}

              <View>
                {data.milestones.map((milestone, idx) => {
                  const mine = milestone.my_status;
                  const isApproved = mine === "APPROVED";
                  const isUnderReview = mine === "SUBMITTED" || mine === "UNDER_REVIEW";
                  const isResubmit = mine === "RESUBMIT_REQUESTED";
                  const isLocked = !milestone.unlocked;
                  const isLast = idx === data.milestones.length - 1;

                  return (
                    <View key={milestone.id} style={styles.row}>
                      <View style={styles.connector}>
                        <View
                          style={[
                            styles.circle,
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
                            <Text style={[styles.circleNumber, { color: Colors.accent }]}>{idx + 1}</Text>
                          )}
                        </View>
                        {!isLast ? (
                          <View
                            style={[
                              styles.line,
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

                      <View style={[styles.content, !isLast && styles.contentGap]}>
                        <Text style={[styles.title, isLocked && { color: Colors.mutedForeground }]}>
                          {milestone.title}
                          <Text style={styles.marks}>  {milestone.marks} marks</Text>
                        </Text>
                        {milestone.description ? <Text style={styles.description}>{milestone.description}</Text> : null}
                        <Text style={styles.status}>
                          {isLocked
                            ? "🔒 Locked — previous stage not approved yet"
                            : milestone.my_status
                              ? `${statusLabel(milestone.my_status)}${milestone.my_score !== null ? ` · scored ${milestone.my_score}/${milestone.marks}` : ""}${milestone.my_submitted_at ? ` · submitted ${dateTime(milestone.my_submitted_at)}` : ""}`
                              : "Unlocked — ready for your submission"}
                          {milestone.due_date ? ` · due ${dateTime(milestone.due_date)}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.noMilestones}>This assignment has no milestones — it is a single submission.</Text>
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailLink: {
    height: 40,
    lineHeight: 38,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    overflow: "hidden",
    backgroundColor: Colors.background,
    textAlign: "center",
  },
  progress: {
    marginBottom: 24,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.muted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  connector: {
    alignItems: "center",
  },
  circle: {
    marginTop: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNumber: {
    fontSize: 12,
    fontWeight: "700",
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  content: {
    flex: 1,
  },
  contentGap: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  marks: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  status: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  noMilestones: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
});
