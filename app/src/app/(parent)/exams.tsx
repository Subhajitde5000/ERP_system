/**
 * C-PA-08 — examinations for one child (mobile port of the exams half of
 * ParentChildExaminationsPage).
 *
 * A guardian sees the schedule and the mark. The answered paper is not here: the
 * student's own review endpoint unlocks per exam setting (`allow_review`,
 * `show_score_immediately`), and a parent reading a half-marked answer sheet before
 * the child does turns an ordinary result into a family argument. `/children/{id}
 * /examinations/{exam}/result` returns score, grade and totals only, by design.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { ChildGate, Chip, DataRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateTime, percent, statusLabel } from "@/lib/format";
import { fetchChildExamResult, fetchChildExaminations, type StudentExamRow } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;

type When = (typeof TABS)[number]["key"];

export default function ParentExamsPage() {
  const childId = useChildId();
  const [when, setWhen] = useState<When>("upcoming");
  const exams = useResource(() => fetchChildExaminations(childId, { when, limit: 100 }), [childId, when]);

  return (
    <Screen>
      <ChildGate module="examination" title="{child} — examinations" subtitle="Dates, and the mark once the result is published">
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <Text
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: when === tab.key }}
              onPress={() => setWhen(tab.key)}
              style={[styles.tab, when === tab.key && styles.tabActive]}
            >
              {tab.label}
            </Text>
          ))}
        </View>

        <AsyncState loading={exams.loading} error={exams.error} onRetry={exams.reload} loadingLabel="Loading examinations…">
          {exams.data?.items.length ? (
            <Card padded={false}>
              {exams.data.items.map((exam) => (
                <ExamRow key={exam.id} childId={childId} exam={exam} />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState
                text={
                  when === "upcoming"
                    ? "Nothing is scheduled. A new exam appears here the moment the school publishes it."
                    : "No examination in this list yet."
                }
              />
            </Card>
          )}
        </AsyncState>

        <Text style={styles.footnote}>
          A mark appears when the school publishes the result. Reading the answered script, question by question,
          is the student&apos;s own screen — the school sets whether it opens before or after review.
        </Text>
      </ChildGate>
    </Screen>
  );
}

/** One exam, with its mark loaded on demand so the list stays one request. */
function ExamRow({ childId, exam }: { childId: string; exam: StudentExamRow }) {
  const examId = exam.id;
  const title = exam.title;
  const meta = `${exam.subject_name} · ${exam.exam_type} · ${dateTime(exam.scheduled_at)}`;
  const published = exam.result_available;
  const [open, setOpen] = useState(published);
  const [result, setResult] = useState<{ loaded: boolean; busy: boolean; error: string | null; text: string | null }>({
    loaded: false,
    busy: false,
    error: null,
    text: null,
  });

  async function load() {
    if (result.loaded || result.busy || !published) return;
    setResult({ ...result, busy: true });
    try {
      const summary = await fetchChildExamResult(childId, examId);
      setResult({
        loaded: true,
        busy: false,
        error: null,
        text:
          summary.total_score === null
            ? summary.attempt_missing
              ? "Not attempted — the school can tell you why."
              : "Marked, but the score has not been released to guardians yet."
            : `${summary.total_score} / ${summary.total_marks}${summary.grade ? ` · grade ${summary.grade}` : ""} · ${percent(summary.percentage)} · pass mark ${summary.passing_marks}`,
      });
    } catch (caught) {
      setResult({
        loaded: true,
        busy: false,
        error: caught instanceof Error ? caught.message : "The mark could not be loaded.",
        text: null,
      });
    }
  }

  return (
    <View>
      <DataRow
        title={title}
        meta={meta}
        onPress={() => {
          const next = !open;
          setOpen(next);
          // Tapping opens the mark, and the mark is a second request: a list of 40
          // exams would otherwise pull 40 result payloads to draw a date.
          if (next) void load();
        }}
        right={
          published ? (
            <Chip label="Mark published" tone="success" />
          ) : exam.status === "ONGOING" ? (
            <Chip label="In progress" tone="warning" />
          ) : (
            <Chip label={statusLabel(exam.status)} />
          )
        }
      />
      {open ? (
        <View style={styles.detail}>
          {!published ? (
            <Text style={styles.detailText}>
              Nothing is published for this one yet. A result appears here when the school releases it —
              usually to the class in a morning and to families the same day.
            </Text>
          ) : null}
          {result.busy ? <Text style={styles.detailText}>Loading the mark…</Text> : null}
          {result.error ? <Text style={[styles.detailText, styles.detailError]}>{result.error}</Text> : null}
          {result.text ? <Text style={styles.detailText}>{result.text}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    overflow: "hidden",
    marginBottom: 16,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 9, fontSize: 13, fontWeight: "600", color: Colors.mutedForeground },
  tabActive: { backgroundColor: Colors.accentLight, color: Colors.accent },
  detail: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  detailText: { fontSize: 12, lineHeight: 18, color: Colors.mutedForeground, paddingTop: 8 },
  detailError: { color: Colors.destructiveText },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground, marginTop: 16 },
});
