/**
 * Teacher online classes — list, start scheduled classes, open the live room
 * or the automatic attendance report. Mobile port of
 * fontend/components/teacher/teacher-online-classes.tsx (list part).
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Video, Zap } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { dateTime } from "@/lib/format";
import { cancelOnlineClass, fetchTeacherOnlineClasses, startOnlineClass, type OnlineClassRow } from "@/lib/online-class";
import { Colors, Radius } from "@/theme";

export default function TeacherOnlineClassesPage() {
  const router = useRouter();
  const list = useResource(fetchTeacherOnlineClasses, []);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await list.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  }

  const groups: [string, OnlineClassRow[]][] = [
    ["Live now", list.data?.items.filter((c) => c.status === "LIVE") ?? []],
    ["Scheduled", list.data?.items.filter((c) => c.status === "SCHEDULED") ?? []],
    ["History", list.data?.items.filter((c) => c.status === "COMPLETED" || c.status === "CANCELLED") ?? []],
  ];

  return (
    <Screen>
      <PageHeader
        title="Online classes"
        subtitle="Teach live — attendance is automatic."
        action={
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconButton} accessibilityRole="button" onPress={() => router.push("/online-classes/new?mode=scheduled")}>
              <Video size={18} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, styles.iconButtonPrimary]} accessibilityRole="button" onPress={() => router.push("/online-classes/new?mode=instant")}>
              <Zap size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AsyncState loading={list.loading} error={list.error} onRetry={list.reload} loadingLabel="Loading your classes…">
        {groups.map(([title, classes]) => (
          <View key={title} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {classes.length === 0 ? (
              <EmptyState text={title === "Live now" ? "No live class right now." : title === "Scheduled" ? "Nothing scheduled yet." : "Completed classes appear here."} />
            ) : (
              classes.map((oc) => (
                <Card key={oc.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{oc.subject_code} · {oc.topic}</Text>
                  <Text style={styles.cardMeta}>
                    {oc.class_name} · {oc.mode === "INSTANT" ? "Instant" : "Scheduled"}
                    {oc.status === "SCHEDULED" && oc.scheduled_at ? ` · ${dateTime(oc.scheduled_at)}` : ""}
                    {oc.status === "COMPLETED" ? ` · ${oc.participant_count} attended` : ""}
                  </Text>
                  <View style={styles.cardActions}>
                    {oc.status === "SCHEDULED" ? (
                      <>
                        <TouchableOpacity style={styles.primaryChip} onPress={() => act(() => startOnlineClass(oc.id))}>
                          <Text style={styles.primaryChipText}>Start class</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostChip} onPress={() => act(() => cancelOnlineClass(oc.id))}>
                          <Text style={styles.ghostChipText}>Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.primaryChip} onPress={() => router.push(`/online-classes/${oc.id}`)}>
                        <Text style={styles.primaryChipText}>
                          {oc.status === "LIVE" ? "Open live room" : oc.status === "COMPLETED" ? "Attendance" : "Details"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        ))}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8 },
  iconButton: {
    height: 40, width: 40, borderRadius: Radius.field, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.accent, backgroundColor: "#FFFFFF",
  },
  iconButtonPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  error: { color: Colors.destructive, fontSize: 13, marginBottom: 8 },
  section: { marginTop: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  card: { gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  cardMeta: { fontSize: 12, color: Colors.mutedForeground },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  primaryChip: { backgroundColor: Colors.accent, borderRadius: Radius.field, paddingHorizontal: 14, paddingVertical: 8 },
  primaryChipText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  ghostChip: { borderRadius: Radius.field, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  ghostChipText: { color: Colors.mutedForeground, fontSize: 12, fontWeight: "700" },
});
