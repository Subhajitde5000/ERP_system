/**
 * Shared create/edit exam form — powers C-TC-08 (new) and C-TC-09 (detail).
 * Port of ExamForm in fontend/components/teacher/teacher-examinations.tsx.
 */

import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AsyncState } from "@/components/principal-ui";
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
import { Card } from "@/components/ui";
import { parseDatetimeLocal, toDatetimeLocal } from "@/lib/format";
import {
  createTeacherExam,
  fetchTeachingAssignments,
  updateTeacherExam,
  type TeacherExamDetail,
  type TeacherExamType,
  type TeacherExamMode,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";

interface ExamFormState {
  title: string;
  classSubject: string;
  exam_type: string;
  mode: string;
  total_marks: string;
  passing_marks: string;
  duration_minutes: string;
  scheduled_at: string;
  window_end_at: string;
  instructions: string;
  allow_review: boolean;
  show_score_immediately: boolean;
  shuffle_questions: boolean;
}

export function TeacherExamForm({
  initial,
  examId,
}: {
  initial: TeacherExamDetail | null;
  examId: string | null;
}) {
  const router = useRouter();
  const assignments = useResource(fetchTeachingAssignments, []);
  const [form, setForm] = useState<ExamFormState>(() => ({
    title: initial?.title ?? "",
    classSubject: initial ? assignmentKey(initial.subject_id, initial.class_id) : "",
    exam_type: initial?.exam_type ?? "MIXED",
    mode: initial?.mode ?? "ONLINE",
    total_marks: initial ? String(initial.total_marks) : "50",
    passing_marks: initial ? String(initial.passing_marks) : "20",
    duration_minutes: initial ? String(initial.duration_minutes) : "60",
    scheduled_at: initial ? toDatetimeLocal(initial.scheduled_at) : "",
    window_end_at: initial ? toDatetimeLocal(initial.window_end_at) : "",
    instructions: initial?.instructions ?? "",
    allow_review: initial?.allow_review ?? false,
    show_score_immediately: initial?.show_score_immediately ?? false,
    shuffle_questions: initial?.shuffle_questions ?? false,
  }));
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

  const editable = !initial || initial.status === "DRAFT";

  async function submit() {
    const parsed = splitAssignmentKey(form.classSubject);
    if (!parsed) {
      setError("Select the class and subject for this exam.");
      return;
    }
    const scheduled = parseDatetimeLocal(form.scheduled_at);
    if (!scheduled) {
      setError("Pick when the exam starts (YYYY-MM-DDTHH:MM).");
      return;
    }
    const total = Number(form.total_marks);
    const passing = Number(form.passing_marks);
    if (passing > total) {
      setError("Passing marks cannot exceed total marks.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base = {
        title: form.title.trim(),
        exam_type: form.exam_type as TeacherExamType,
        mode: form.mode as TeacherExamMode,
        total_marks: total,
        passing_marks: passing,
        duration_minutes: Number(form.duration_minutes),
        instructions: form.instructions.trim() || null,
        scheduled_at: scheduled,
        window_end_at: parseDatetimeLocal(form.window_end_at),
        allow_review: form.allow_review,
        show_score_immediately: form.show_score_immediately,
        shuffle_questions: form.shuffle_questions,
      };
      if (examId) {
        await updateTeacherExam(examId, base);
        router.replace({ pathname: "/(teacher)/examinations/[id]", params: { id: examId } });
      } else {
        const created = await createTeacherExam({
          ...base,
          subject_id: parsed.subjectId,
          class_id: parsed.classId,
        });
        router.replace({ pathname: "/(teacher)/examinations/[id]/questions", params: { id: created.id } });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this exam.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AsyncState
      loading={assignments.loading}
      error={assignments.error}
      onRetry={assignments.reload}
      loadingLabel="Loading your teaching scope…"
    >
      <Card>
        <View style={styles.form}>
          <TextField
            label="Exam title"
            value={form.title}
            onChangeText={(title) => setForm({ ...form, title })}
            editable={editable}
          />
          <SelectField
            label="Class & subject"
            options={[{ value: "", label: "Select class and subject" }, ...options]}
            value={form.classSubject}
            onChange={(classSubject) => setForm({ ...form, classSubject })}
            disabled={!!examId || !editable}
          />
          {examId ? (
            <Text style={styles.hint}>Class and subject are fixed once the exam is created.</Text>
          ) : null}
          <SelectField
            label="Type"
            options={[
              { value: "MCQ", label: "MCQ" },
              { value: "DESCRIPTIVE", label: "Descriptive" },
              { value: "MIXED", label: "Mixed" },
              { value: "QUIZ", label: "Quiz" },
            ]}
            value={form.exam_type}
            onChange={(exam_type) => setForm({ ...form, exam_type })}
            disabled={!editable}
          />
          <SelectField
            label="Mode"
            options={[
              { value: "ONLINE", label: "Online" },
              { value: "OFFLINE", label: "Offline" },
            ]}
            value={form.mode}
            onChange={(mode) => setForm({ ...form, mode })}
            disabled={!editable}
          />
          <TextField
            label="Total marks"
            value={form.total_marks}
            onChangeText={(total_marks) => setForm({ ...form, total_marks })}
            keyboardType="numeric"
            editable={editable}
          />
          <TextField
            label="Passing marks"
            value={form.passing_marks}
            onChangeText={(passing_marks) => setForm({ ...form, passing_marks })}
            keyboardType="numeric"
            editable={editable}
          />
          <TextField
            label="Duration (minutes)"
            value={form.duration_minutes}
            onChangeText={(duration_minutes) => setForm({ ...form, duration_minutes })}
            keyboardType="numeric"
            editable={editable}
          />
          <TextField
            label="Starts at"
            value={form.scheduled_at}
            onChangeText={(scheduled_at) => setForm({ ...form, scheduled_at })}
            placeholder="YYYY-MM-DDTHH:MM"
            hint="Use YYYY-MM-DDTHH:MM"
            editable={editable}
          />
          <TextField
            label="Window ends (optional)"
            value={form.window_end_at}
            onChangeText={(window_end_at) => setForm({ ...form, window_end_at })}
            placeholder="YYYY-MM-DDTHH:MM"
            editable={editable}
          />
          <TextField
            label="Instructions (optional)"
            value={form.instructions}
            onChangeText={(instructions) => setForm({ ...form, instructions })}
            multiline
            editable={editable}
          />
          <CheckboxRow
            label="Allow answer review"
            checked={form.allow_review}
            onChange={(allow_review) => setForm({ ...form, allow_review })}
            disabled={!editable}
          />
          <CheckboxRow
            label="Show score immediately"
            checked={form.show_score_immediately}
            onChange={(show_score_immediately) => setForm({ ...form, show_score_immediately })}
            disabled={!editable}
          />
          <CheckboxRow
            label="Shuffle questions"
            checked={form.shuffle_questions}
            onChange={(shuffle_questions) => setForm({ ...form, shuffle_questions })}
            disabled={!editable}
          />
          <ActionError message={error} />
          {editable ? (
            <View style={styles.actions}>
              <PrimaryButton
                label={busy ? "Saving…" : examId ? "Save changes" : "Create exam & add questions"}
                loading={busy}
                onPress={submit}
              />
              <OutlineButton
                label="Cancel"
                onPress={() =>
                  examId
                    ? router.replace({ pathname: "/(teacher)/examinations/[id]", params: { id: examId } })
                    : router.replace("/(teacher)/examinations")
                }
              />
            </View>
          ) : null}
        </View>
      </Card>
    </AsyncState>
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
