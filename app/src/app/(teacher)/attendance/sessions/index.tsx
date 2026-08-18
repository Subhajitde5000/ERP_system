/**
 * C-TC-04 — every attendance session the teacher marked, with filters.
 * Port of TeacherAttendanceSessionsPage.
 */

import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Lock } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { StatusPill } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { dateOnly } from "@/lib/format";
import { fetchAttendanceSessions, fetchTeachingAssignments } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function TeacherAttendanceSessionsPage() {
  const assignments = useResource(fetchTeachingAssignments, []);
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", classId: "", subjectId: "" });
  const resource = useResource(
    () =>
      fetchAttendanceSessions({
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        limit: 100,
      }),
    [filters.fromDate, filters.toDate, filters.classId, filters.subjectId],
  );

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const assignment of assignments.data ?? []) seen.set(assignment.class_id, assignment.class_name);
    return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [assignments.data]);

  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const assignment of assignments.data ?? []) {
      seen.set(assignment.subject_id, `${assignment.subject_code} · ${assignment.subject_name}`);
    }
    return [...seen.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [assignments.data]);

  return (
    <Screen>
      <PageHeader title="Attendance sessions" subtitle="Sessions you marked, filterable by date, class and subject." />
      <Card style={styles.filterCard} padded={false}>
        <View style={styles.filters}>
          <TextField
            label="From"
            value={filters.fromDate}
            onChangeText={(fromDate) => setFilters({ ...filters, fromDate })}
            placeholder="YYYY-MM-DD"
          />
          <TextField
            label="To"
            value={filters.toDate}
            onChangeText={(toDate) => setFilters({ ...filters, toDate })}
            placeholder="YYYY-MM-DD"
          />
          <SelectField
            label="Class"
            options={[{ value: "", label: "All classes" }, ...classOptions]}
            value={filters.classId}
            onChange={(classId) => setFilters({ ...filters, classId })}
          />
          <SelectField
            label="Subject"
            options={[{ value: "", label: "All subjects" }, ...subjectOptions]}
            value={filters.subjectId}
            onChange={(subjectId) => setFilters({ ...filters, subjectId })}
          />
        </View>
      </Card>
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading attendance sessions…"
      >
        {resource.data ? (
          <View style={styles.list}>
            {resource.data.items.length ? (
              resource.data.items.map((session) => (
                <Card key={session.id}>
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.title}>
                        {dateOnly(session.date)} · {session.period_label}
                      </Text>
                      <Text style={styles.meta}>
                        {session.class_name} · {session.subject_code}
                      </Text>
                      <Text style={styles.counts}>
                        <Text style={styles.present}>{session.total_present} present</Text>
                        {"  ·  "}
                        <Text style={styles.absent}>{session.total_absent} absent</Text>
                      </Text>
                    </View>
                    <View style={styles.rowSide}>
                      {session.is_locked ? (
                        <View style={styles.locked}>
                          <Lock size={12} color={Colors.mutedForeground} />
                          <StatusPill label="Locked" tone="muted" />
                        </View>
                      ) : (
                        <StatusPill label="Editable" tone="success" />
                      )}
                      <Link
                        href={{ pathname: "/(teacher)/attendance/sessions/[id]", params: { id: session.id } }}
                        style={styles.open}
                      >
                        Open
                      </Link>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card padded={false}>
                <EmptyTable text="No attendance sessions match these filters." />
              </Card>
            )}
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    marginBottom: 20,
    padding: 16,
  },
  filters: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  counts: {
    marginTop: 8,
    fontSize: 13,
  },
  present: {
    fontWeight: "600",
    color: Colors.successText,
  },
  absent: {
    fontWeight: "600",
    color: Colors.destructiveText,
  },
  rowSide: {
    alignItems: "flex-end",
    gap: 8,
  },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  open: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.accent,
  },
});
