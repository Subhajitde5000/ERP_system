/**
 * C-ST-17 grade card — port of StudentGradeCardPage in
 * fontend/components/student/student-results.tsx. The website renders it as a
 * printable sheet; the app renders the same statement-of-marks card
 * (the browser Print button has no mobile counterpart).
 */

import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { GraduationCap } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateOnly, percent } from "@/lib/format";
import { useInstitutionAuth } from "@/lib/session";
import { fetchGradeCard } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function StudentGradeCardPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const publicationId = id ?? "";
  const { user } = useInstitutionAuth();
  const resource = useResource(
    () => (publicationId ? fetchGradeCard(publicationId) : Promise.reject(new Error("No publication ID provided"))),
    [publicationId],
  );

  const result = resource.data;
  const serial = result ? result.publication_id.replaceAll("-", "").slice(0, 10).toUpperCase() : "";

  return (
    <Screen>
      <PageHeader title="Grade card" subtitle="Your official statement of marks." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your grade card…"
      >
        {result ? (
          <Card>
            <View style={styles.heading}>
              <GraduationCap size={32} color={Colors.accent} />
              <Text style={styles.institution}>{result.institution_name ?? "Institution"}</Text>
              <Text style={styles.statement}>Statement of marks — {result.title}</Text>
              <Text style={styles.cardMeta}>
                {result.academic_year ? `Academic year ${result.academic_year}` : ""}
                {result.class_name ? ` · Class ${result.class_name}` : ""} · Card No. {serial}
              </Text>
            </View>
            <View style={styles.studentRows}>
              <Text style={styles.studentRow}>
                <Text style={styles.studentLabel}>Student: </Text>
                <Text style={styles.studentValue}>{user?.name ?? "—"}</Text>
              </Text>
              <Text style={styles.studentRow}>
                <Text style={styles.studentLabel}>Published: </Text>
                <Text style={styles.studentValue}>{dateOnly(result.published_at)}</Text>
              </Text>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colSubject]}>Subject</Text>
              <Text style={[styles.th, styles.colRight]}>Max marks</Text>
              <Text style={[styles.th, styles.colRight]}>Obtained</Text>
              <Text style={[styles.th, styles.colRight]}>Grade</Text>
            </View>
            {result.subject_scores.map((score, index) => (
              <View key={`${score.subject_name}-${index}`} style={styles.tableRow}>
                <Text style={[styles.subjectName, styles.colSubject]}>{score.subject_name}</Text>
                <Text style={[styles.mutedRight, styles.colRight]}>{score.marks_possible}</Text>
                <Text style={[styles.obtainedRight, styles.colRight]}>{score.marks_obtained}</Text>
                <Text style={[styles.obtainedRight, styles.colRight]}>{score.grade ?? "—"}</Text>
              </View>
            ))}
            <View style={styles.tableTotal}>
              <Text style={[styles.totalCell, styles.colSubject]}>Total</Text>
              <Text style={[styles.totalCell, styles.colRight]}>{result.total_marks_possible}</Text>
              <Text style={[styles.totalCell, styles.colRight]}>{result.total_marks_obtained}</Text>
              <Text style={[styles.totalCell, styles.colRight]}>{result.grade}</Text>
            </View>

            <View style={styles.summary}>
              <Text style={styles.summaryItem}>
                Percentage: <Text style={styles.summaryValue}>{percent(result.percentage)}</Text>
              </Text>
              <Text style={styles.summaryItem}>
                Grade: <Text style={styles.summaryValue}>{result.grade}</Text>
              </Text>
              <Text style={styles.summaryItem}>
                Result: <Text style={styles.summaryValue}>{result.result.replaceAll("_", " ")}</Text>
              </Text>
            </View>
            {result.remarks ? <Text style={styles.remarks}>Remarks: {result.remarks}</Text> : null}
            <View style={styles.signatures}>
              <Text style={styles.signature}>Class teacher</Text>
              <Text style={styles.signature}>Controller of examinations</Text>
              <Text style={styles.signature}>Principal</Text>
            </View>
          </Card>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 16,
    alignItems: "center",
  },
  institution: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: Colors.primary,
    textAlign: "center",
  },
  statement: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  studentRows: {
    marginTop: 16,
    gap: 6,
  },
  studentRow: {
    fontSize: 14,
  },
  studentLabel: {
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  studentValue: {
    fontWeight: "600",
    color: Colors.primary,
  },
  tableHead: {
    marginTop: 16,
    flexDirection: "row",
    borderTopWidth: 2,
    borderBottomWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  colSubject: {
    flex: 1,
    paddingRight: 12,
  },
  colRight: {
    width: 72,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  mutedRight: {
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  obtainedRight: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  tableTotal: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    paddingVertical: 8,
  },
  totalCell: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  summary: {
    marginTop: 16,
    gap: 8,
    alignItems: "center",
  },
  summaryItem: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  summaryValue: {
    color: Colors.primary,
  },
  remarks: {
    marginTop: 12,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  signatures: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
});
