/**
 * C-TC-13 — create assignment form.
 */

import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

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
import { parseDatetimeLocal } from "@/lib/format";
import { createTeacherAssignment, fetchTeachingAssignments, type TeacherAssignmentType } from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";

export default function TeacherCreateAssignmentPage() {
  const router = useRouter();
  const assignments = useResource(fetchTeachingAssignments, []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    classSubject: "",
    assignment_type: "REGULAR",
    total_marks: "50",
    passing_marks: "20",
    due_date: "",
    allow_late_submission: false,
    late_penalty_percent: "0",
    max_file_size_mb: "10",
    allowed_file_types: "pdf, doc, docx, zip",
    min_group_size: "2",
    max_group_size: "6",
    instructions_url: "",
    publish: true,
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
      setError("Select the class and subject for this assignment.");
      return;
    }
    const due = parseDatetimeLocal(form.due_date);
    if (!due) {
      setError("Pick a due date (YYYY-MM-DDTHH:MM).");
      return;
    }
    const total = Number(form.total_marks);
    if (Number(form.passing_marks) > total) {
      setError("Passing marks cannot exceed total marks.");
      return;
    }
    const minGrp = Number(form.min_group_size);
    const maxGrp = Number(form.max_group_size);
    if (form.assignment_type === "GROUP" && minGrp > maxGrp) {
      setError("Minimum group size cannot exceed maximum group size.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createTeacherAssignment({
        title: form.title.trim(),
        description: form.description.trim(),
        subject_id: parsed.subjectId,
        class_id: parsed.classId,
        assignment_type: form.assignment_type as TeacherAssignmentType,
        total_marks: total,
        passing_marks: Number(form.passing_marks),
        due_date: due,
        allow_late_submission: form.allow_late_submission,
        late_penalty_percent: Number(form.late_penalty_percent),
        max_file_size_mb: Number(form.max_file_size_mb),
        allowed_file_types: form.allowed_file_types
          .split(",")
          .map((ext) => ext.trim().toLowerCase())
          .filter(Boolean),
        min_group_size: minGrp,
        max_group_size: maxGrp,
        instructions_url: form.instructions_url.trim() || null,
        publish: form.publish,
      });
      router.replace({ pathname: "/(teacher)/assignments/[id]", params: { id: created.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="Create assignment" subtitle="Publish now, or keep it a draft and publish from the detail page." />
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
              label="Instructions"
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
              label="Type"
              options={[
                { value: "REGULAR", label: "Regular" },
                { value: "MILESTONE", label: "Milestone-based" },
                { value: "GROUP", label: "Group" },
              ]}
              value={form.assignment_type}
              onChange={(assignment_type) => setForm({ ...form, assignment_type })}
            />
            {form.assignment_type === "GROUP" ? (
              <View style={styles.groupBox}>
                <TextField
                  label="Minimum students per group"
                  value={form.min_group_size}
                  onChangeText={(min_group_size) => setForm({ ...form, min_group_size })}
                  keyboardType="numeric"
                />
                <TextField
                  label="Maximum students per group"
                  value={form.max_group_size}
                  onChangeText={(max_group_size) => setForm({ ...form, max_group_size })}
                  keyboardType="numeric"
                />
              </View>
            ) : null}
            <TextField
              label="Total marks"
              value={form.total_marks}
              onChangeText={(total_marks) => setForm({ ...form, total_marks })}
              keyboardType="numeric"
            />
            <TextField
              label="Passing marks"
              value={form.passing_marks}
              onChangeText={(passing_marks) => setForm({ ...form, passing_marks })}
              keyboardType="numeric"
            />
            <TextField
              label="Due date"
              value={form.due_date}
              onChangeText={(due_date) => setForm({ ...form, due_date })}
              placeholder="YYYY-MM-DDTHH:MM"
              hint="Use YYYY-MM-DDTHH:MM"
            />
            <TextField
              label="Max file size (MB)"
              value={form.max_file_size_mb}
              onChangeText={(max_file_size_mb) => setForm({ ...form, max_file_size_mb })}
              keyboardType="numeric"
            />
            <TextField
              label="Allowed file types (comma separated)"
              value={form.allowed_file_types}
              onChangeText={(allowed_file_types) => setForm({ ...form, allowed_file_types })}
              placeholder="pdf, doc, docx, zip"
            />
            <TextField
              label="Reference link (optional)"
              value={form.instructions_url}
              onChangeText={(instructions_url) => setForm({ ...form, instructions_url })}
              placeholder="https://…"
            />
            <CheckboxRow
              label="Allow late submissions"
              checked={form.allow_late_submission}
              onChange={(allow_late_submission) => setForm({ ...form, allow_late_submission })}
            />
            <CheckboxRow
              label="Publish immediately"
              checked={form.publish}
              onChange={(publish) => setForm({ ...form, publish })}
            />
            {form.allow_late_submission ? (
              <TextField
                label="Late penalty (%)"
                value={form.late_penalty_percent}
                onChangeText={(late_penalty_percent) => setForm({ ...form, late_penalty_percent })}
                keyboardType="numeric"
              />
            ) : null}
            <ActionError message={error} />
            <View style={styles.actions}>
              <PrimaryButton label={busy ? "Creating…" : "Create assignment"} loading={busy} onPress={submit} />
              <OutlineButton label="Cancel" onPress={() => router.replace("/(teacher)/assignments")} />
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
  groupBox: {
    gap: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.2)",
    backgroundColor: "rgba(238,242,255,0.4)",
    padding: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
});
