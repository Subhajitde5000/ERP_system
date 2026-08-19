/**
 * C-TC-06 — review student leave applications for the teacher's classes.
 * Port of TeacherLeaveRequestsPage.
 */

import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import {
  ActionError,
  FilterChips,
  OutlineButton,
  PrimaryButton,
  StatusPill,
  leaveStatusTone,
} from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, dateTime, statusLabel } from "@/lib/format";
import { fetchTeacherLeaves, reviewTeacherLeave } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

const STATUS_FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "", label: "All" },
];

export default function TeacherLeaveRequestsPage() {
  const [status, setStatus] = useState<string>("PENDING");
  const resource = useResource(
    () => fetchTeacherLeaves({ status: status || undefined, limit: 100 }),
    [status],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(leaveId: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(leaveId);
    setActionError(null);
    try {
      const updated = await reviewTeacherLeave(leaveId, decision);
      if (!resource.data) return;
      const items = resource.data.items
        .map((leave) => (leave.id === leaveId ? { ...leave, ...updated } : leave))
        .filter((leave) => !status || leave.status === status);
      resource.setData({
        ...resource.data,
        items,
        pending_count: Math.max(0, resource.data.pending_count - 1),
      });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not review this leave request.");
      await resource.reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <PageHeader title="Leave requests" subtitle="Student leave applications for the classes you teach." />
      <View style={styles.filterRow}>
        <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
        {resource.data ? (
          <Text style={styles.pendingCount}>{resource.data.pending_count} pending review</Text>
        ) : null}
      </View>
      <ActionError message={actionError} />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading leave requests…"
      >
        {resource.data ? (
          resource.data.items.length ? (
            <View style={styles.list}>
              {resource.data.items.map((leave) => (
                <Card key={leave.id}>
                  <View style={styles.cardTop}>
                    <Text style={styles.name}>{leave.student_name}</Text>
                    <StatusPill label={statusLabel(leave.status)} tone={leaveStatusTone(leave.status)} />
                  </View>
                  <Text style={styles.meta}>
                    {leave.class_name}
                    {leave.roll_number ? ` · Roll ${leave.roll_number}` : ""} · {dateOnly(leave.from_date)} →{" "}
                    {dateOnly(leave.to_date)}
                  </Text>
                  <Text style={styles.reason}>{leave.reason}</Text>
                  <Text style={styles.applied}>
                    Applied {dateTime(leave.created_at)}
                    {leave.reviewed_at ? ` · Reviewed ${dateTime(leave.reviewed_at)}` : ""}
                  </Text>
                  {leave.document_url ? (
                    <Text style={styles.doc} onPress={() => Linking.openURL(leave.document_url!)}>
                      Supporting document
                    </Text>
                  ) : null}
                  {leave.status === "PENDING" ? (
                    <View style={styles.actions}>
                      <PrimaryButton
                        label="Approve"
                        icon={Check}
                        disabled={busyId === leave.id}
                        onPress={() => decide(leave.id, "APPROVED")}
                      />
                      <OutlineButton
                        label="Reject"
                        icon={X}
                        danger
                        disabled={busyId === leave.id}
                        onPress={() => decide(leave.id, "REJECTED")}
                      />
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState
                text={status === "PENDING" ? "No leave requests are waiting on you." : "No leave requests match this filter."}
              />
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    marginBottom: 4,
  },
  pendingCount: {
    marginTop: -8,
    marginBottom: 16,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  list: {
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  meta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  reason: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedForeground,
  },
  applied: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  doc: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.accent,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
