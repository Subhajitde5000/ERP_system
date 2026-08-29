/**
 * C-PA-10 — notices for one child (mobile port of ParentChildNoticesPage).
 *
 * The child's board, not a guardian broadcast: the server applies the student's
 * visibility rules, so a circular addressed to one section never reaches another
 * family. The "read" tick a student sees is deliberately absent — it measures
 * whether the *child* looked, and ticking it from a guardian account would falsify
 * a number the school uses.
 */

import { StyleSheet, Text, View } from "react-native";

import { AsyncState } from "@/components/principal-ui";
import { ChildGate, Chip } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateOnly, statusLabel } from "@/lib/format";
import { fetchChildNotices } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function ParentNoticesPage() {
  const childId = useChildId();
  const notices = useResource(() => fetchChildNotices(childId, { limit: 100 }), [childId]);

  return (
    <Screen>
      <ChildGate module="notice" title="{child} — notices" subtitle="Circulars addressed to the class or the school">
        <AsyncState loading={notices.loading} error={notices.error} onRetry={notices.reload} loadingLabel="Loading notices…">
          {notices.data?.items.length ? (
            <View style={styles.stack}>
              <Text style={styles.count}>
                {notices.data.unread_count} unread · {notices.data.items.length} shown
              </Text>
              {notices.data.items.map((notice) => (
                <Card key={notice.id} style={notice.is_pinned ? styles.pinned : undefined}>
                  <View style={styles.headRow}>
                    <Text style={styles.title}>{notice.title}</Text>
                    <View style={styles.chips}>
                      {notice.priority !== "NORMAL" ? (
                        <Chip label={statusLabel(notice.priority)} tone={notice.priority === "URGENT" ? "danger" : "warning"} />
                      ) : null}
                      {notice.is_pinned ? <Chip label="Pinned" tone="success" /> : null}
                      {!notice.is_read ? <Chip label="New" /> : null}
                    </View>
                  </View>
                  <Text style={styles.body}>{notice.body}</Text>
                  <Text style={styles.meta}>
                    {[
                      notice.author_name && `From ${notice.author_name}`,
                      notice.target_name ? `${notice.target_scope} · ${notice.target_name}` : null,
                      notice.published_at ? dateOnly(notice.published_at) : null,
                      notice.expires_at ? `expires ${dateOnly(notice.expires_at)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "School notice board"}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState text="Nothing has been posted to this board yet." />
            </Card>
          )}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  count: { fontSize: 11, fontWeight: "600", color: Colors.mutedForeground },
  headRow: { gap: 6 },
  title: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  body: { fontSize: 13, lineHeight: 20, color: Colors.bodyText, marginTop: 8 },
  meta: { fontSize: 11, color: Colors.mutedForeground, marginTop: 10 },
  pinned: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentLight },
});
