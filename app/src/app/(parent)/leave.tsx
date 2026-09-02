/**
 * C-PA-06 — leave for one child (mobile port of ParentChildLeavePage).
 *
 * The one write a guardian gets. A child cannot write their own application from a
 * hospital bed and a parent should not have to phone the office to say "they are
 * ill", so a guardian files on the child's behalf: the row carries
 * `request_source = "PARENT"` and the teacher sees who asked. It is still reviewed,
 * never auto-approved — an absence is a legal record, not a message.
 *
 * Filing is allowed by the `attendance` module, not a separate one: half a
 * conversation about an absence is worse than the whole thing.
 */

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Plus, X } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Button } from "@/components/button";
import { ChildGate, Chip, DataRow } from "@/components/parent-ui";
import { FormAlert } from "@/components/form-alert";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { TextField } from "@/components/text-field";
import { dateOnly, statusLabel } from "@/lib/format";
import { applyChildLeave, cancelChildLeave, fetchChildLeaves, type ParentLeaveRow } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius, Shadow } from "@/theme";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function ParentLeavePage() {
  const childId = useChildId();
  const leaves = useResource(() => fetchChildLeaves(childId, { limit: 100 }), [childId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "", document_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submit() {
    if (!DATE_PATTERN.test(form.from_date)) return setError("Start date must be YYYY-MM-DD.");
    if (!DATE_PATTERN.test(form.to_date)) return setError("End date must be YYYY-MM-DD.");
    if (form.to_date < form.from_date) return setError("The end date cannot be before the start date.");
    if (form.reason.trim().length < 3) return setError("Say why the child will be absent.");
    setBusy(true);
    setError(null);
    try {
      await applyChildLeave(childId, {
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
        document_url: form.document_url.trim() || null,
      });
      setForm({ from_date: "", to_date: "", reason: "", document_url: "" });
      setOpen(false);
      await leaves.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(row: ParentLeaveRow) {
    const current = leaves.data;
    if (!current) return;
    setBusyId(row.id);
    setError(null);
    try {
      const updated = await cancelChildLeave(childId, row.id);
      leaves.setData({ ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That request could not be withdrawn.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <ChildGate module="attendance" title="{child} — leave" subtitle="Applications you or the child have sent to the school">
        <View style={styles.toolbar}>
          <Button onPress={() => { setOpen(!open); setError(null); }}>
            {open ? <X size={14} color="#FFFFFF" /> : <Plus size={14} color="#FFFFFF" />}
            <Text style={styles.buttonLabel}>{open ? "Close" : "Request leave"}</Text>
          </Button>
        </View>

        {open ? (
          <Card>
            <Text style={styles.formTitle}>On behalf of your child</Text>
            <View style={styles.formGrid}>
              <View style={styles.formCell}>
                <TextField
                  label="From"
                  value={form.from_date}
                  onChangeText={(from_date) => setForm({ ...form, from_date })}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.formCell}>
                <TextField
                  label="To"
                  value={form.to_date}
                  onChangeText={(to_date) => setForm({ ...form, to_date })}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <TextField
              label="Reason"
              value={form.reason}
              onChangeText={(reason) => setForm({ ...form, reason })}
              placeholder="Fever since last night; the clinic visit is at 4pm"
              multiline
              hint="The teacher reads this verbatim. A date and a reason beat a blank “unwell”."
            />
            <TextField
              label="Document link"
              value={form.document_url}
              onChangeText={(document_url) => setForm({ ...form, document_url })}
              placeholder="Optional — clinic or travel link"
            />
            {error ? <FormAlert>{error}</FormAlert> : null}
            <Button onPress={submit} loading={busy} loadingText="Sending…">
              <Text style={styles.buttonLabel}>Send to the class teacher</Text>
            </Button>
          </Card>
        ) : error ? (
          <FormAlert>{error}</FormAlert>
        ) : null}

        <AsyncState loading={leaves.loading} error={leaves.error} onRetry={leaves.reload} loadingLabel="Loading leave requests…">
          <Card padded={false}>
            {leaves.data?.items.length ? (
              leaves.data.items.map((row) => (
                <View key={row.id}>
                  <DataRow
                    title={`${dateOnly(row.from_date)} → ${row.to_date === row.from_date ? "" : dateOnly(row.to_date)}`}
                    meta={`${row.reason}${row.reviewed_at ? ` · reviewed ${dateOnly(row.reviewed_at)}` : ""}`}
                    right={
                      <View style={styles.rightStack}>
                        <Chip
                          label={statusLabel(row.status)}
                          tone={row.status === "APPROVED" ? "success" : row.status === "REJECTED" ? "danger" : "warning"}
                        />
                        {row.mine ? <Chip label="By you" /> : <Chip label={`By ${row.request_source.toLowerCase()}`} />}
                      </View>
                    }
                  />
                  {row.status === "PENDING" && row.mine ? (
                    <View style={styles.rowAction}>
                      <Text
                        accessibilityRole="button"
                        onPress={busyId === row.id ? undefined : () => cancel(row)}
                        style={[styles.withdraw, busyId === row.id && styles.withdrawOff]}
                      >
                        {busyId === row.id ? "Withdrawing…" : "Withdraw"}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <EmptyState text="No leave has been requested for this child." />
            )}
          </Card>
        </AsyncState>

        <Text style={styles.footnote}>
          A request can be withdrawn while it is still pending. Once a teacher has decided, the answer stands in
          the record — reopen it with the office rather than sending a second copy.
        </Text>
      </ChildGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", justifyContent: "flex-end" },
  buttonLabel: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  formTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  formGrid: { flexDirection: "row", gap: 12 },
  formCell: { flex: 1, minWidth: 0 },
  rightStack: { alignItems: "flex-end", gap: 4 },
  rowAction: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", justifyContent: "flex-end" },
  withdraw: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.destructiveText,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.destructiveBorder,
    backgroundColor: Colors.destructiveLight,
    overflow: "hidden",
    ...Shadow.card,
  },
  withdrawOff: { opacity: 0.5 },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
});
