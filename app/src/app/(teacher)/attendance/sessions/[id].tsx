/**
 * C-TC-05 — one session's records; editable until locked.
 * Port of TeacherAttendanceSessionDetailPage.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Lock } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { ActionError, PrimaryButton, StatusPill } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateOnly, dateTime } from "@/lib/format";
import { fetchAttendanceSession, lockAttendanceSession } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function TeacherAttendanceSessionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? "";
  const resource = useResource(
    () => (sessionId ? fetchAttendanceSession(sessionId) : Promise.reject(new Error("No session ID provided"))),
    [sessionId],
  );
  const [busy, setBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    setLockError(null);
    try {
      const updated = await lockAttendanceSession(sessionId);
      if (resource.data) resource.setData({ ...resource.data, ...updated });
    } catch (caught) {
      setLockError(caught instanceof Error ? caught.message : "Could not lock this session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Attendance session" subtitle="View the recorded marks. Locking a session freezes it permanently." />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading session…">
        {resource.data ? (
          <View style={styles.stack}>
            <Card>
              <Text style={styles.title}>
                {resource.data.subject_code} · {resource.data.class_name}
              </Text>
              <Text style={styles.meta}>
                {dateOnly(resource.data.date)} · Period {resource.data.period_label} · {resource.data.total_present} present /{" "}
                {resource.data.total_absent} absent
                {resource.data.locked_at ? ` · Locked ${dateTime(resource.data.locked_at)}` : ""}
              </Text>
              {resource.data.notes ? <Text style={styles.notes}>{resource.data.notes}</Text> : null}
              <View style={styles.actions}>
                <Link href="/(teacher)/attendance/mark" style={styles.markLink}>
                  {resource.data.is_locked ? "Back to marking" : "Edit in marking board"}
                </Link>
                {!resource.data.is_locked ? (
                  <PrimaryButton
                    label={busy ? "Locking…" : "Lock session"}
                    icon={Lock}
                    loading={busy}
                    onPress={lock}
                  />
                ) : null}
              </View>
              <ActionError message={lockError} />
            </Card>
            <Card padded={false}>
              {resource.data.records.length ? (
                <View>
                  {resource.data.records.map((record) => (
                    <View key={record.student_id} style={styles.record}>
                      <View style={styles.recordText}>
                        <Text style={styles.student}>{record.student_name}</Text>
                        <Text style={styles.roll}>{record.roll_number ?? "—"}</Text>
                      </View>
                      <View style={styles.recordSide}>
                        <StatusPill
                          label={record.status ?? "—"}
                          tone={
                            record.status === "ABSENT"
                              ? "danger"
                              : record.status === "PRESENT"
                                ? "success"
                                : "warning"
                          }
                        />
                        <Text style={styles.late}>
                          {record.late_by_minutes ? `${record.late_by_minutes} min late` : record.remarks ?? ""}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyTable text="No records in this session." />
              )}
            </Card>
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  notes: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  markLink: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    overflow: "hidden",
  },
  record: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recordText: {
    flex: 1,
  },
  student: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  roll: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  recordSide: {
    alignItems: "flex-end",
    gap: 4,
  },
  late: {
    fontSize: 11,
    color: Colors.mutedForeground,
  },
});
