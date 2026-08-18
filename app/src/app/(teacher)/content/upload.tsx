/**
 * C-TC-18 — upload a file reference or link, tagged by chapter.
 */

import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import {
  ActionError,
  CheckboxRow,
  OutlineButton,
  PrimaryButton,
  assignmentKey,
  splitAssignmentKey,
} from "@/components/teacher-ui";
import { Card, PageHeader } from "@/components/ui";
import { statusLabel } from "@/lib/format";
import {
  createTeacherContent,
  fetchTeachingAssignments,
  type TeacherContentType,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";

const CONTENT_TYPES: TeacherContentType[] = ["PDF", "VIDEO", "SLIDE", "LINK", "IMAGE", "AUDIO", "ZIP"];

export default function TeacherContentUploadPage() {
  const router = useRouter();
  const assignments = useResource(fetchTeachingAssignments, []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    classSubject: "",
    content_type: "PDF" as TeacherContentType,
    file_key: "",
    external_url: "",
    chapter: "",
    tags: "",
    is_visible: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      (assignments.data ?? []).map((assignment) => ({
        value: assignmentKey(assignment.subject_id, assignment.class_id),
        label: `${assignment.subject_code} · ${assignment.class_name}`,
      })),
    [assignments.data],
  );

  async function submit() {
    const parsed = splitAssignmentKey(form.classSubject);
    if (!parsed) {
      setError("Select the class and subject this content belongs to.");
      return;
    }
    if (!form.file_key.trim() && !form.external_url.trim()) {
      setError("Provide a file key or an external link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTeacherContent({
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject_id: parsed.subjectId,
        class_id: parsed.classId,
        content_type: form.content_type,
        file_key: form.file_key.trim() || null,
        external_url: form.external_url.trim() || null,
        chapter: form.chapter.trim() || null,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        is_visible: form.is_visible,
      });
      router.replace("/(teacher)/content");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this content.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Upload content"
        subtitle="Attach a stored file key or an external link, and tag it by chapter so students can find it."
      />
      <AsyncState
        loading={assignments.loading}
        error={assignments.error}
        onRetry={assignments.reload}
        loadingLabel="Loading your teaching scope…"
      >
        <Card>
          <View style={styles.form}>
            <TextField label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
            <TextField
              label="Description (optional)"
              value={form.description}
              onChangeText={(description) => setForm({ ...form, description })}
              multiline
            />
            <SelectField
              label="Class & subject"
              options={[{ value: "", label: "Select class and subject" }, ...options]}
              value={form.classSubject}
              onChange={(classSubject) => setForm({ ...form, classSubject })}
            />
            <SelectField
              label="Content type"
              options={CONTENT_TYPES.map((type) => ({ value: type, label: statusLabel(type) }))}
              value={form.content_type}
              onChange={(content_type) => setForm({ ...form, content_type: content_type as TeacherContentType })}
            />
            <TextField
              label="File key (from storage)"
              value={form.file_key}
              onChangeText={(file_key) => setForm({ ...form, file_key })}
              placeholder="tenant/class/subject/file.pdf"
            />
            <TextField
              label="External link"
              value={form.external_url}
              onChangeText={(external_url) => setForm({ ...form, external_url })}
              placeholder="https://…"
            />
            <Text style={styles.hint}>Provide at least one of a file key or an external link.</Text>
            <TextField
              label="Chapter (optional)"
              value={form.chapter}
              onChangeText={(chapter) => setForm({ ...form, chapter })}
              placeholder="Chapter 3 — Trees"
            />
            <TextField
              label="Tags (comma separated)"
              value={form.tags}
              onChangeText={(tags) => setForm({ ...form, tags })}
              placeholder="graphs, bfs, revision"
            />
            <CheckboxRow
              label="Visible to students immediately"
              checked={form.is_visible}
              onChange={(is_visible) => setForm({ ...form, is_visible })}
            />
            <ActionError message={error} />
            <View style={styles.actions}>
              <PrimaryButton
                label={busy ? "Uploading…" : "Upload content"}
                icon={Plus}
                loading={busy}
                onPress={submit}
              />
              <OutlineButton label="Cancel" onPress={() => router.replace("/(teacher)/content")} />
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
  hint: {
    marginTop: -8,
    fontSize: 11,
    color: "#64748B",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
