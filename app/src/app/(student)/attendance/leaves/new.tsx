/**
 * C-ST-05 apply for leave — port of StudentApplyLeavePage in
 * fontend/components/student/student-attendance.tsx.
 * The server enforces the 30-day max and date overlap.
 */

import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/screen";
import { Card, PageHeader } from "@/components/ui";
import { TextField } from "@/components/text-field";
import { applyStudentLeave } from "@/lib/student";
import { Colors, Radius, Shadow } from "@/theme";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function StudentApplyLeavePage() {
  const router = useRouter();
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "", document_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!DATE_PATTERN.test(form.from_date)) {
      setError("Enter the start date as YYYY-MM-DD.");
      return;
    }
    if (!DATE_PATTERN.test(form.to_date)) {
      setError("Enter the end date as YYYY-MM-DD.");
      return;
    }
    if (!form.reason.trim()) {
      setError("Enter the reason for your leave.");
      return;
    }
    if (form.to_date < form.from_date) {
      setError("The end date cannot be before the start date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyStudentLeave({
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason.trim(),
        document_url: form.document_url.trim() || null,
      });
      router.replace("/(student)/attendance");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your leave request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Apply for leave" subtitle="Your class teacher (or subject teachers) will review the request." />
      <Card>
        <View style={styles.form}>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <TextField
                label="From"
                value={form.from_date}
                onChangeText={(from_date) => setForm({ ...form, from_date })}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.dateField}>
              <TextField
                label="To"
                value={form.to_date}
                onChangeText={(to_date) => setForm({ ...form, to_date })}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <TextField
            label="Reason"
            value={form.reason}
            onChangeText={(reason) => setForm({ ...form, reason })}
            multiline
          />
          <TextField
            label="Supporting document link (optional)"
            value={form.document_url}
            onChangeText={(document_url) => setForm({ ...form, document_url })}
            placeholder="https://…"
          />
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity disabled={busy} onPress={submit} style={[styles.submit, busy && styles.disabled]}>
              <Text style={styles.submitLabel}>{busy ? "Submitting…" : "Submit request"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.cancel}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  dateRow: {
    flexDirection: "row",
    gap: 16,
  },
  dateField: {
    flex: 1,
  },
  formError: {
    fontSize: 14,
    color: Colors.destructiveText,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  submit: {
    height: 44,
    borderRadius: Radius.field,
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.accent,
  },
  disabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancel: {
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
});
