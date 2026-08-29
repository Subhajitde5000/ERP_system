/**
 * C-PA-08b — assignments for one child (mobile port of ParentChildAssignmentsPage).
 *
 * Read-only by design: a guardian can see what is outstanding, when it was handed in
 * and what it scored, but submitting is the child's own act. On the web the same rule
 * means this list has no form; on the phone it is why there is no "＋" button.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { ChildGate, Chip, DataRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateOnly, statusLabel } from "@/lib/format";
import { fetchChildAssignments } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const FILTERS = [
  { key: "pending", label: "To do" },
  { key: "submitted", label: "Sent" },
  { key: "graded", label: "Marked" },
  { key: "all", label: "All" },
] as const;

export default function ParentAssignmentsPage() {
  const childId = useChildId();
  const [status, setStatus] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const list = useResource(() => fetchChildAssignments(childId, { status, limit: 100 }), [childId, status]);

  return (
    <Screen>
      <ChildGate module="assignment" title="{child} — assignments" subtitle="What is set, what is in, what is marked">
        <View style={styles.tabs}>
          {FILTERS.map((item) => (
            <Text
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: status === item.key }}
              onPress={() => setStatus(item.key)}
              style={[styles.tab, status === item.key && styles.tabActive]}
            >
              {item.label}
            </Text>
          ))}
        </View>

        <AsyncState loading={list.loading} error={list.error} onRetry={list.reload} loadingLabel="Loading assignments…">
          {list.data?.items.length ? (
            <Card padded={false}>
              {list.data.items.map((item) => (
                <DataRow
                  key={item.id}
                  title={item.title}
                  meta={[
                    item.subject_name,
                    `${item.assignment_type} · ${item.total_marks} marks`,
                    item.my_submitted_at ? `sent ${dateOnly(item.my_submitted_at)}` : `due ${dateOnly(item.due_date)}`,
                    item.teacher_name ? `set by ${item.teacher_name}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  right={
                    <View style={styles.right}>
                      <Chip
                        label={statusLabel(item.my_status)}
                        tone={item.my_status === "GRADED" ? "success" : item.is_late ? "danger" : item.my_status === "PENDING" ? "warning" : "muted"}
                      />
                      {item.my_score !== null ? <Text style={styles.score}>{`${item.my_score}/${item.total_marks}`}</Text> : null}
                    </View>
                  }
                />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState
                text={
                  status === "pending"
                    ? "Nothing outstanding — every assignment on the list has been handed in."
                    : "No assignment in this list yet."
                }
              />
            </Card>
          )}
        </AsyncState>

        <Text style={styles.footnote}>
          Work is handed in by the student — this portal can read the list and its marks, never submit on the
          child&apos;s behalf.
        </Text>
      </ChildGate>
    </Screen>
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
  tab: { paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontWeight: "600", color: Colors.mutedForeground },
  tabActive: { backgroundColor: Colors.accentLight, color: Colors.accent },
  right: { alignItems: "flex-end", gap: 4 },
  score: { fontSize: 12, fontWeight: "700", color: Colors.foreground },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground, marginTop: 16 },
});
