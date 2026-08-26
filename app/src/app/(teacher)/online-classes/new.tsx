/**
 * Schedule or start an instant online class — mobile port of the web setup
 * modal (fontend/components/teacher/teacher-online-classes.tsx ClassForm).
 */

import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/button";
import { Card, PageHeader } from "@/components/ui";
import { TextField } from "@/components/text-field";
import { useResource } from "@/hooks/use-resource";
import {
  fetchSetupOptions,
  scheduleOnlineClass,
  startInstantClass,
  type OnlineClassCreate,
} from "@/lib/online-class";
import { Colors } from "@/theme";

export default function NewOnlineClassPage() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const instant = modeParam === "instant";
  const options = useResource(fetchSetupOptions, []);

  const [form, setForm] = useState<OnlineClassCreate>({
    class_id: "",
    subject_id: "",
    topic: "",
    scheduled_at: null,
    duration_minutes: 60,
    allow_join: true,
    recording_enabled: false,
    timetable_slot_id: null,
  });
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const classIds = [...new Set(options.data?.assignments.map((a) => a.class_id) ?? [])];
  const subjects = options.data?.assignments.filter((a) => a.class_id === form.class_id) ?? [];

  const submit = async () => {
    setError(null);
    if (!form.class_id || !form.subject_id || !form.topic.trim()) {
      setError("Pick a class, a subject and a topic.");
      return;
    }
    if (!instant && !when) {
      setError("Pick the date and time for a scheduled class.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        scheduled_at: instant ? null : new Date(when).toISOString(),
      };
      const created = instant ? await startInstantClass(payload) : await scheduleOnlineClass(payload);
      router.replace(instant ? `/online-classes/${created.id}` : "/online-classes");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the class.");
      setBusy(false);
    }
  };

  return (
    <Screen>
      <PageHeader
        title={instant ? "Start instant class" : "Schedule online class"}
        subtitle={instant ? "Students are notified the moment you start." : "Follows your timetable; students see it in Today's classes."}
      />
      <AsyncState loading={options.loading} error={options.error} onRetry={options.reload} loadingLabel="Loading your classes…">
        <Card style={styles.form}>
          {options.data?.today_slots.length ? (
            <SelectField
              label="Today's timetable slot (optional)"
              options={[
                { value: "", label: "Not from timetable" },
                ...options.data.today_slots
                  .filter((slot) => slot.subject_id)
                  .map((slot) => ({
                    value: slot.id,
                    label: `P${slot.period_number} ${slot.start_time} · ${slot.subject_name ?? slot.class_name}`,
                  })),
              ]}
              value={form.timetable_slot_id ?? ""}
              onChange={(slotId) => {
                const slot = options.data?.today_slots.find((s) => s.id === slotId);
                if (slot?.subject_id) {
                  setForm((prev) => ({ ...prev, timetable_slot_id: slot.id, class_id: slot.class_id, subject_id: slot.subject_id! }));
                } else {
                  setForm((prev) => ({ ...prev, timetable_slot_id: null }));
                }
              }}
            />
          ) : null}
          <SelectField
            label="Class"
            options={classIds.map((id) => ({
              value: id,
              label: options.data?.assignments.find((a) => a.class_id === id)?.class_name ?? id,
            }))}
            value={form.class_id}
            onChange={(value) => setForm({ ...form, class_id: value, subject_id: "", timetable_slot_id: null })}
          />
          <SelectField
            label="Subject"
            options={subjects.map((a) => ({ value: a.subject_id, label: `${a.subject_code} — ${a.subject_name}` }))}
            value={form.subject_id}
            onChange={(value) => setForm({ ...form, subject_id: value })}
          />
          <TextField label="Topic" value={form.topic} onChangeText={(topic) => setForm({ ...form, topic })} placeholder="e.g. SQL Joins" autoCapitalize="sentences" />
          {!instant ? (
            <TextField
              label="Date & time (YYYY-MM-DD HH:mm)"
              value={when}
              onChangeText={setWhen}
              placeholder={`${new Date().toISOString().slice(0, 10)} 10:00`}
              error={when && Number.isNaN(Date.parse(when)) ? "Enter a valid date and time" : undefined}
            />
          ) : null}
          <TextField
            label="Duration (minutes)"
            value={String(form.duration_minutes)}
            onChangeText={(value) => setForm({ ...form, duration_minutes: Math.max(5, Math.min(480, Number(value) || 60)) })}
            keyboardType="numeric"
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow students to join (waiting room)</Text>
            <Switch value={form.allow_join} onValueChange={(allow_join) => setForm({ ...form, allow_join })} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Record the class</Text>
            <Switch value={form.recording_enabled} onValueChange={(recording_enabled) => setForm({ ...form, recording_enabled })} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button loading={busy} onPress={submit}>
            {instant ? "Create & start now" : "Schedule class"}
          </Button>
        </Card>
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  toggleLabel: { fontSize: 13, color: Colors.primary, flex: 1 },
  error: { color: Colors.destructive, fontSize: 13 },
});
