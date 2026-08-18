/**
 * C-TC-20 — post a class-scoped notice.
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Megaphone } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { ActionError, OutlineButton, PrimaryButton } from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { parseDatetimeLocal } from "@/lib/format";
import { createTeacherNotice, fetchTeacherNoticeTargets } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";

export default function TeacherNoticeComposerPage() {
  const router = useRouter();
  const targets = useResource(fetchTeacherNoticeTargets, []);
  const [form, setForm] = useState({
    title: "",
    body: "",
    targetId: "",
    priority: "NORMAL" as "NORMAL" | "IMPORTANT" | "URGENT",
    expiresAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Enter a title and message.");
      return;
    }
    if (!form.targetId) {
      setError("Select the class receiving this notice.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTeacherNotice({
        title: form.title.trim(),
        body: form.body.trim(),
        class_id: form.targetId,
        priority: form.priority,
        expires_at: parseDatetimeLocal(form.expiresAt),
      });
      router.replace("/(teacher)/notices");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish this notice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Post notice"
        subtitle="Publish to a class you teach. The server verifies every target."
      />
      <AsyncState
        loading={targets.loading}
        error={targets.error}
        onRetry={targets.reload}
        loadingLabel="Loading notice targets…"
      >
        <Card>
          <View style={styles.form}>
            <TextField label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
            <TextField
              label="Message"
              value={form.body}
              onChangeText={(body) => setForm({ ...form, body })}
              multiline
            />
            <SelectField
              label="Class"
              options={[
                { value: "", label: "Select class" },
                ...(targets.data ?? []).map((target) => ({ value: target.id, label: target.name })),
              ]}
              value={form.targetId}
              onChange={(targetId) => setForm({ ...form, targetId })}
            />
            <SelectField
              label="Priority"
              options={[
                { value: "NORMAL", label: "Normal" },
                { value: "IMPORTANT", label: "Important" },
                { value: "URGENT", label: "Urgent" },
              ]}
              value={form.priority}
              onChange={(priority) => setForm({ ...form, priority: priority as typeof form.priority })}
            />
            <TextField
              label="Expires at (optional)"
              value={form.expiresAt}
              onChangeText={(expiresAt) => setForm({ ...form, expiresAt })}
              placeholder="YYYY-MM-DDTHH:MM"
            />
            <ActionError message={error} />
            <View style={styles.actions}>
              <PrimaryButton
                label={busy ? "Publishing…" : "Publish notice"}
                icon={Megaphone}
                loading={busy}
                onPress={submit}
              />
              <OutlineButton label="Cancel" onPress={() => router.replace("/(teacher)/notices")} />
            </View>
          </View>
        </Card>
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
