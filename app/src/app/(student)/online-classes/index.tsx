/**
 * Student online classes — today's classes with join, upcoming and history.
 * Mobile port of fontend/components/student/student-online-classes.tsx.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { dateTime } from "@/lib/format";
import { fetchMyOnlineClasses, type StudentOnlineClassRow } from "@/lib/online-class";
import { Colors, Radius } from "@/theme";

export default function StudentOnlineClassesPage() {
  const router = useRouter();
  const resource = useResource(fetchMyOnlineClasses, []);

  return (
    <Screen>
      <PageHeader title="Online classes" subtitle="Join live classes — attendance records itself." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your classes…">
        {resource.data ? (
          <>
            <Section title="Today's classes" classes={resource.data.today} empty="No online classes today." onPress={(id) => router.push(`/online-classes/${id}`)} />
            <Section title="Upcoming" classes={resource.data.upcoming} empty="Nothing scheduled yet." onPress={(id) => router.push(`/online-classes/${id}`)} />
            <Section title="Past" classes={resource.data.past} empty="Completed classes appear here." onPress={(id) => router.push(`/online-classes/${id}`)} />
          </>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function Section({ title, classes, empty, onPress }: { title: string; classes: StudentOnlineClassRow[]; empty: string; onPress: (id: string) => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {classes.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        classes.map((oc) => (
          <Card key={oc.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>
                  {oc.subject_code} · {oc.topic}
                </Text>
                <Text style={styles.cardMeta}>
                  {oc.status === "LIVE" ? "🔴 Live now" : oc.scheduled_at ? dateTime(oc.scheduled_at) : oc.status} · {oc.duration_minutes} min · {oc.teacher_name}
                </Text>
              </View>
              {oc.status === "LIVE" ? (
                <TouchableOpacity style={styles.joinButton} onPress={() => onPress(oc.id)}>
                  <Text style={styles.joinText}>
                    {oc.join_state === "WAITING" ? "Waiting room" : oc.join_state === "IN_CLASS" ? "Rejoin" : oc.join_state === "JOINABLE" ? "Join" : "Closed"}
                  </Text>
                </TouchableOpacity>
              ) : oc.status === "SCHEDULED" ? (
                <TouchableOpacity style={styles.ghostChip} onPress={() => onPress(oc.id)}>
                  <Text style={styles.ghostChipText}>Details</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 16, gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  card: { gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  cardMeta: { fontSize: 12, color: Colors.mutedForeground },
  joinButton: { backgroundColor: Colors.accent, borderRadius: Radius.field, paddingHorizontal: 14, paddingVertical: 8 },
  joinText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  ghostChip: { borderRadius: Radius.field, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  ghostChipText: { color: Colors.mutedForeground, fontSize: 12, fontWeight: "700" },
});
