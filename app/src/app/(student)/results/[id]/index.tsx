/**
 * C-ST-16 result detail — port of StudentResultDetailPage + ResultBody in
 * fontend/components/student/student-results.tsx: subject-wise breakdown for
 * one published result.
 */

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Download } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateOnly, percent } from "@/lib/format";
import { fetchStudentResult, type StudentResultDetail } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

export default function StudentResultDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const publicationId = id ?? "";
  const resource = useResource(
    () => (publicationId ? fetchStudentResult(publicationId) : Promise.reject(new Error("No publication ID provided"))),
    [publicationId],
  );

  return (
    <Screen>
      <PageHeader title="Result detail" subtitle="Subject-wise marks, grade and rank." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading the result…"
      >
        {resource.data ? <ResultBody result={resource.data} publicationId={publicationId} /> : null}
      </AsyncState>
    </Screen>
  );
}

function ResultBody({ result, publicationId }: { result: StudentResultDetail; publicationId: string }) {
  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{result.title}</Text>
            <Text style={styles.subtitle}>
              {result.institution_name ?? ""}
              {result.academic_year ? ` · ${result.academic_year}` : ""}
              {result.class_name ? ` · ${result.class_name}` : ""} · published {dateOnly(result.published_at)}
            </Text>
          </View>
          {result.has_grade_card ? (
            <Link
              href={{ pathname: "/(student)/results/[id]/grade-card", params: { id: publicationId } }}
              asChild
            >
              <View style={styles.gradeCardButton}>
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.gradeCardButtonLabel}>Grade card</Text>
              </View>
            </Link>
          ) : null}
        </View>
        <View style={styles.totals}>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{result.total_marks_obtained}</Text>
            <Text style={styles.totalLabel}>of {result.total_marks_possible}</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{percent(result.percentage)}</Text>
            <Text style={styles.totalLabel}>percentage</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={[styles.totalValue, { color: Colors.accent }]}>{result.grade}</Text>
            <Text style={styles.totalLabel}>grade</Text>
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalValue}>{result.rank ?? "—"}</Text>
            <Text style={styles.totalLabel}>rank</Text>
          </View>
        </View>
      </Card>
      <Card padded={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colSubject]}>Subject</Text>
              <Text style={[styles.th, styles.colNum]}>Marks</Text>
              <Text style={[styles.th, styles.colNum]}>Out of</Text>
              <Text style={[styles.th, styles.colNum]}>Grade</Text>
            </View>
            {result.subject_scores.length ? (
              result.subject_scores.map((score, index) => (
                <View key={`${score.subject_name}-${index}`} style={styles.tableRow}>
                  <Text style={[styles.subjectName, styles.colSubject]}>{score.subject_name}</Text>
                  <Text style={[styles.td, styles.colNum]}>{score.marks_obtained}</Text>
                  <Text style={[styles.td, styles.colNum]}>{score.marks_possible}</Text>
                  <Text style={[styles.grade, styles.colNum]}>{score.grade ?? "—"}</Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={styles.noScores}>Subject-wise scores are not part of this publication.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Card>
      {result.remarks ? (
        <Card>
          <Text style={styles.remarksTitle}>Remarks</Text>
          <Text style={styles.remarksBody}>{result.remarks}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  gradeCardButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    ...Shadow.accent,
  },
  gradeCardButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  totals: {
    marginTop: 16,
    gap: 16,
  },
  totalBox: {
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    padding: 16,
    alignItems: "center",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
  },
  totalLabel: {
    fontSize: 12,
    color: Colors.mutedForeground,
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
  },
  colSubject: { width: 220, paddingHorizontal: 20 },
  colNum: { width: 100, paddingHorizontal: 20 },
  subjectName: {
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  td: {
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  grade: {
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  noScores: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  remarksTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  remarksBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
});
