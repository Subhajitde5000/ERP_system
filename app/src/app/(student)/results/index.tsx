/**
 * C-ST-15 results — port of StudentResultsPage in
 * fontend/components/student/student-results.tsx: one card per published
 * result.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { dateTime, percent } from "@/lib/format";
import { fetchStudentResults } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function StudentResultsPage() {
  const resource = useResource(fetchStudentResults, []);

  return (
    <Screen>
      <PageHeader title="Results" subtitle="Published results from the exam cell — anything visible here is final." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your results…"
      >
        {resource.data ? (
          resource.data.length ? (
            <View style={styles.grid}>
              {resource.data.map((result) => (
                <Link
                  key={result.publication_id}
                  href={{ pathname: "/(student)/results/[id]/index", params: { id: result.publication_id } }}
                  asChild
                >
                  <TouchableOpacity style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>{result.title}</Text>
                        <Text style={styles.cardSubtitle}>
                          {result.academic_year ?? ""}
                          {result.class_name ? ` · ${result.class_name}` : ""}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.resultBadge,
                          result.result === "PASS" || result.result === "PASS_WITH_GRACE"
                            ? { backgroundColor: Colors.successLight }
                            : result.result === "FAIL"
                              ? { backgroundColor: Colors.destructiveLight }
                              : { backgroundColor: Colors.warningLight },
                        ]}
                      >
                        <Text
                          style={[
                            styles.resultBadgeText,
                            result.result === "PASS" || result.result === "PASS_WITH_GRACE"
                              ? { color: Colors.successText }
                              : result.result === "FAIL"
                                ? { color: Colors.destructiveText }
                                : { color: Colors.warningText },
                          ]}
                        >
                          {result.result.replaceAll("_", " ")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreValue}>{result.total_marks_obtained}</Text>
                        <Text style={styles.scoreLabel}>of {result.total_marks_possible}</Text>
                      </View>
                      <View style={styles.scoreBox}>
                        <Text style={styles.scoreValue}>{percent(result.percentage)}</Text>
                        <Text style={styles.scoreLabel}>percentage</Text>
                      </View>
                      <View style={styles.scoreBox}>
                        <Text style={[styles.scoreValue, { color: Colors.accent }]}>{result.grade}</Text>
                        <Text style={styles.scoreLabel}>{result.rank ? `rank ${result.rank}` : "grade"}</Text>
                      </View>
                    </View>
                    <Text style={styles.published}>
                      Published {dateTime(result.published_at)}
                      {result.has_grade_card ? " · grade card available" : ""}
                    </Text>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyTable text="No results published yet — they appear here once the exam cell releases them." />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 16,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 20,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  resultBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    borderRadius: Radius.field,
    backgroundColor: Colors.muted,
    padding: 12,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: Colors.mutedForeground,
  },
  published: {
    marginTop: 12,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
});
