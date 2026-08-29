/**
 * C-PA-09 — published results for one child (mobile port of the results half of
 * ParentChildExaminationsPage).
 *
 * Only *published* cards exist here, and `results` is a module of its own on the link
 * precisely because a school may want a grandparent to follow attendance without ever
 * seeing a mark sheet. Nothing on this screen is hidden client-side: the list is what
 * the server says is published.
 *
 * The signed grade-card PDF is not offered — that download is the student's own
 * route, and re-implementing it for guardians would mean a second copy of the
 * school's document. Families who need a copy ask the office, which is also the only
 * way the request gets audited.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { ChildGate, Chip, DataRow, FactRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateOnly, percent, statusLabel } from "@/lib/format";
import { fetchChildResult, fetchChildResults, type StudentResultRow } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function ParentResultsPage() {
  const childId = useChildId();
  const results = useResource(() => fetchChildResults(childId), [childId]);

  return (
    <Screen>
      <ChildGate module="results" title="{child} — results" subtitle="Term cards the school has published">
        <AsyncState loading={results.loading} error={results.error} onRetry={results.reload} loadingLabel="Loading results…">
          {results.data?.length ? (
            <View style={styles.stack}>
              {results.data.map((row) => (
                <ResultCard key={row.publication_id} childId={childId} row={row} />
              ))}
              <Text style={styles.footnote}>
                Rank is within the class, not the year, and only appears when the school publishes it.
              </Text>
            </View>
          ) : (
            <Card>
              <EmptyState text="No result has been published for this child yet. The signed card is issued by the office, not by this app." />
            </Card>
          )}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

function ResultCard({ childId, row }: { childId: string; row: StudentResultRow }) {
  const [open, setOpen] = useState(false);
  const tone = row.result === "PASS" ? "success" : row.result === "FAIL" ? "danger" : "warning";

  return (
    <Card padded={false}>
      <DataRow
        title={row.title}
        meta={`${[row.class_name, row.academic_year].filter(Boolean).join(" · ") || dateOnly(row.published_at)} · ${row.total_marks_obtained}/${row.total_marks_possible}`}
        onPress={() => setOpen(!open)}
        right={<Chip label={statusLabel(row.result)} tone={tone} />}
      />
      {open ? (
        <View style={styles.detail}>
          <View style={styles.summary}>
            <MetricCard label="Percentage" value={percent(row.percentage)} hint={`${row.total_marks_obtained} of ${row.total_marks_possible}`} />
            <MetricCard label="Grade" value={row.grade || "—"} hint={row.rank === null ? "Rank not published" : `Rank ${row.rank}`} />
          </View>
          <ResultDetail childId={childId} publicationId={row.publication_id} />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Mounted only when the card is expanded, so the subject breakdown costs one request
 * per card a guardian actually opens instead of one per result on the account.
 */
function ResultDetail({ childId, publicationId }: { childId: string; publicationId: string }) {
  const detail = useResource(() => fetchChildResult(childId, publicationId), [childId, publicationId]);

  return (
    <AsyncState loading={detail.loading} error={detail.error} onRetry={detail.reload} loadingLabel="Loading the card…">
      {detail.data ? (
        <>
          {detail.data.subject_scores.map((score) => (
            <FactRow
              key={score.subject_name}
              label={score.subject_name}
              value={`${score.marks_obtained}/${score.marks_possible}${score.grade ? ` · ${score.grade}` : ""}`}
            />
          ))}
          {detail.data.remarks ? <Text style={styles.remarks}>{detail.data.remarks}</Text> : null}
          <Text style={styles.footnote}>
            Published {dateOnly(detail.data.published_at)}
            {detail.data.institution_name ? ` · ${detail.data.institution_name}` : ""}
          </Text>
        </>
      ) : null}
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  detail: { paddingHorizontal: 16, paddingBottom: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  summary: { flexDirection: "row", gap: 8, paddingTop: 12 },
  remarks: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.bodyText,
    marginTop: 8,
    padding: 10,
    borderRadius: Radius.field,
    backgroundColor: Colors.background,
  },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
});
