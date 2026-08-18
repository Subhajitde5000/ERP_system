/**
 * C-TC-10 — add MCQ / descriptive / true-false questions with options.
 * Port of TeacherExamQuestionsPage. Question text is always rendered in full
 * (the website "empty square" review bug is avoided here by never collapsing
 * the stem into an icon-only control).
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { Database, Pencil, Plus, Trash2, X } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import {
  ActionError,
  OutlineButton,
  PrimaryButton,
  WarningBanner,
} from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { statusLabel } from "@/lib/format";
import {
  addExamQuestion,
  deleteExamQuestion,
  fetchQuestionBank,
  fetchTeacherExam,
  importQuestionsFromBank,
  updateExamQuestion,
  type QuestionBankItemOut,
  type TeacherQuestionIn,
  type TeacherQuestionOptionIn,
  type TeacherQuestionOut,
  type TeacherQuestionType,
  type TeacherQuestionUpdate,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

const OBJECTIVE: TeacherQuestionType[] = ["MCQ", "TRUE_FALSE"];

interface OptionDraft extends TeacherQuestionOptionIn {
  key: number;
}

let optionKey = 0;

function newOption(isCorrect = false): OptionDraft {
  optionKey += 1;
  return { key: optionKey, text: "", is_correct: isCorrect, sort_order: optionKey };
}

export default function TeacherExamQuestionsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const examId = id ?? "";
  const resource = useResource(
    () => (examId ? fetchTeacherExam(examId) : Promise.reject(new Error("Exam ID is required"))),
    [examId],
  );
  const [editing, setEditing] = useState<TeacherQuestionOut | null>(null);
  const [showImport, setShowImport] = useState(false);
  const data = resource.data;
  const questions = Array.isArray(data?.questions) ? data.questions : [];

  return (
    <Screen>
      <PageHeader
        title={data ? `Questions — ${data.title}` : "Questions"}
        subtitle="Objective questions are auto-graded; descriptive ones are graded from the Results screen."
        action={
          <View style={styles.headerActions}>
            {data && data.status === "DRAFT" ? (
              <PrimaryButton label="Import from Question Bank" icon={Database} onPress={() => setShowImport(true)} />
            ) : null}
            <Link href={{ pathname: "/(teacher)/examinations/[id]", params: { id: examId } }} style={styles.linkBtn}>
              Exam detail
            </Link>
            <Link href={{ pathname: "/(teacher)/examinations/[id]/results", params: { id: examId } }} style={styles.linkBtn}>
              Results
            </Link>
          </View>
        }
      />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading questions…"
      >
        {data ? (
          <View style={styles.stack}>
            {data.status !== "DRAFT" ? (
              <WarningBanner>
                This exam is {statusLabel(data.status).toLowerCase()} — questions can no longer be edited.
              </WarningBanner>
            ) : null}
            {questions.length ? (
              questions.map((question, index) => (
                <Card key={question.id}>
                  <Text style={styles.qMeta}>
                    Q{index + 1} · {statusLabel(question.question_type)} · {question.marks} marks
                    {question.negative_marks ? ` · −${question.negative_marks} negative` : ""}
                    {question.difficulty ? ` · ${statusLabel(question.difficulty)}` : ""}
                  </Text>
                  <Text style={styles.qText}>{question.text}</Text>
                  {question.options.length ? (
                    <View style={styles.options}>
                      {question.options.map((option) => (
                        <View key={option.id} style={styles.optionRow}>
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: option.is_correct ? Colors.success : Colors.border },
                            ]}
                          />
                          <Text
                            style={[
                              styles.optionText,
                              option.is_correct && { color: Colors.successText, fontWeight: "600" },
                            ]}
                          >
                            {option.text}
                            {option.is_correct ? "  (correct)" : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {question.explanation ? (
                    <Text style={styles.explanation}>Explanation: {question.explanation}</Text>
                  ) : null}
                  {data.status === "DRAFT" ? (
                    <View style={styles.qActions}>
                      <OutlineButton
                        label="Edit"
                        icon={Pencil}
                        onPress={() => setEditing(question)}
                      />
                      <RemoveQuestionButton
                        examId={examId}
                        questionId={question.id}
                        onRemoved={(detail) => {
                          if (editing?.id === question.id) setEditing(null);
                          resource.setData({ ...data, ...detail });
                        }}
                      />
                    </View>
                  ) : null}
                </Card>
              ))
            ) : (
              <Card>
                <EmptyState text="No questions yet — add the first one below." />
              </Card>
            )}
            {data.status === "DRAFT" ? (
              <QuestionComposer
                examId={examId}
                editing={editing}
                onCancelEdit={() => setEditing(null)}
                onSaved={async () => {
                  setEditing(null);
                  await resource.reload();
                }}
              />
            ) : null}
            {showImport ? (
              <ImportFromBankModal
                examId={examId}
                onClose={() => setShowImport(false)}
                onImported={async () => {
                  setShowImport(false);
                  await resource.reload();
                }}
              />
            ) : null}
          </View>
        ) : null}
      </AsyncState>
    </Screen>
  );
}

function RemoveQuestionButton({
  examId,
  questionId,
  onRemoved,
}: {
  examId: string;
  questionId: string;
  onRemoved: (detail: Awaited<ReturnType<typeof deleteExamQuestion>>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View>
      <OutlineButton
        label={busy ? "Removing…" : "Remove"}
        icon={Trash2}
        danger
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const detail = await deleteExamQuestion(examId, questionId);
            onRemoved(detail);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not delete this question.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ActionError message={error} />
    </View>
  );
}

function QuestionComposer({
  examId,
  editing,
  onCancelEdit,
  onSaved,
}: {
  examId: string;
  editing: TeacherQuestionOut | null;
  onCancelEdit: () => void;
  onSaved: () => Promise<void>;
}) {
  const [questionType, setQuestionType] = useState<TeacherQuestionType>("MCQ");
  const [text, setText] = useState("");
  const [marks, setMarks] = useState("2");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [difficulty, setDifficulty] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([newOption(true), newOption(), newOption(), newOption()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objective = OBJECTIVE.includes(questionType);

  const resetToAddMode = useCallback(() => {
    setQuestionType("MCQ");
    setText("");
    setMarks("2");
    setNegativeMarks("0");
    setDifficulty("");
    setExplanation("");
    setOptions([newOption(true), newOption(), newOption(), newOption()]);
    setError(null);
  }, []);

  useEffect(() => {
    if (!editing) {
      resetToAddMode();
      return;
    }
    setQuestionType(editing.question_type as TeacherQuestionType);
    setText(editing.text);
    setMarks(String(editing.marks));
    setNegativeMarks(String(editing.negative_marks ?? 0));
    setDifficulty(editing.difficulty ?? "");
    setExplanation(editing.explanation ?? "");
    setOptions(
      editing.options.map((option) => {
        optionKey += 1;
        return { key: optionKey, text: option.text, is_correct: option.is_correct, sort_order: option.sort_order };
      }),
    );
    setError(null);
  }, [editing, resetToAddMode]);

  async function submit() {
    if (!text.trim()) {
      setError("Write the question text.");
      return;
    }
    let payloadOptions: TeacherQuestionOptionIn[] = [];
    if (objective) {
      payloadOptions = options
        .filter((option) => option.text.trim())
        .map((option, index) => ({ text: option.text.trim(), is_correct: !!option.is_correct, sort_order: index }));
      if (payloadOptions.length < 2) {
        setError("Add at least two options for objective questions.");
        return;
      }
      if (!payloadOptions.some((option) => option.is_correct)) {
        setError("Mark which option is correct.");
        return;
      }
      if (questionType === "TRUE_FALSE" && payloadOptions.length !== 2) {
        setError("True/false questions need exactly two options.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const payload: TeacherQuestionIn = {
        text: text.trim(),
        question_type: questionType,
        marks: Number(marks),
        negative_marks: Number(negativeMarks),
        explanation: explanation.trim() || null,
        difficulty: (difficulty || null) as TeacherQuestionIn["difficulty"],
        options: payloadOptions,
      };
      if (editing) {
        const changes: TeacherQuestionUpdate = {
          text: payload.text,
          marks: payload.marks,
          negative_marks: payload.negative_marks,
          explanation: payload.explanation,
          difficulty: payload.difficulty,
          options: payload.options,
        };
        await updateExamQuestion(examId, editing.id, changes);
      } else {
        await addExamQuestion(examId, payload);
        resetToAddMode();
      }
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : editing
            ? "Could not save this question."
            : "Could not add this question.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={styles.composerTitle}>{editing ? "Edit question" : "Add a question"}</Text>
      <View style={styles.form}>
        <SelectField
          label="Question type"
          options={[
            { value: "MCQ", label: "Multiple choice" },
            { value: "TRUE_FALSE", label: "True / False" },
            { value: "SHORT_ANSWER", label: "Short answer" },
            { value: "LONG_ANSWER", label: "Long answer" },
            { value: "FILL_BLANK", label: "Fill in the blank" },
            { value: "MATCH", label: "Match the following" },
          ]}
          value={questionType}
          onChange={(next) => {
            if (editing) return;
            const typed = next as TeacherQuestionType;
            setQuestionType(typed);
            if (typed === "TRUE_FALSE") {
              setOptions([
                { ...newOption(true), text: "True" },
                { ...newOption(), text: "False" },
              ]);
            } else if (typed === "MCQ") {
              setOptions([newOption(true), newOption(), newOption(), newOption()]);
            }
          }}
        />
        <TextField label="Marks" value={marks} onChangeText={setMarks} keyboardType="numeric" />
        <TextField label="Negative marks" value={negativeMarks} onChangeText={setNegativeMarks} keyboardType="numeric" />
        <TextField label="Question" value={text} onChangeText={setText} multiline />
        {objective ? (
          <View style={styles.optionEditor}>
            <Text style={styles.optionLegend}>Options — tap the circle for the correct answer</Text>
            {options.map((option, index) => (
              <View key={option.key} style={styles.optionEditRow}>
                <Pressable
                  accessibilityLabel={`Option ${index + 1} is correct`}
                  onPress={() =>
                    setOptions((current) => current.map((item) => ({ ...item, is_correct: item.key === option.key })))
                  }
                  style={[styles.radio, option.is_correct && styles.radioOn]}
                />
                <View style={styles.optionInput}>
                  <TextField
                    label={`Option ${index + 1}`}
                    value={option.text}
                    onChangeText={(value) =>
                      setOptions((current) =>
                        current.map((item) => (item.key === option.key ? { ...item, text: value } : item)),
                      )
                    }
                    editable={questionType !== "TRUE_FALSE"}
                  />
                </View>
                {questionType === "MCQ" && options.length > 2 ? (
                  <OutlineButton
                    label=""
                    icon={Trash2}
                    danger
                    onPress={() => setOptions((current) => current.filter((item) => item.key !== option.key))}
                  />
                ) : null}
              </View>
            ))}
            {questionType === "MCQ" && options.length < 8 ? (
              <OutlineButton label="Add option" icon={Plus} onPress={() => setOptions((current) => [...current, newOption()])} />
            ) : null}
          </View>
        ) : null}
        <SelectField
          label="Difficulty (optional)"
          options={[
            { value: "", label: "Not set" },
            { value: "EASY", label: "Easy" },
            { value: "MEDIUM", label: "Medium" },
            { value: "HARD", label: "Hard" },
          ]}
          value={difficulty}
          onChange={setDifficulty}
        />
        <TextField label="Explanation (optional)" value={explanation} onChangeText={setExplanation} />
        <ActionError message={error} />
        <View style={styles.formActions}>
          <PrimaryButton
            label={busy ? (editing ? "Saving…" : "Adding…") : editing ? "Save changes" : "Add question"}
            icon={editing ? Pencil : Plus}
            loading={busy}
            onPress={submit}
          />
          {editing ? <OutlineButton label="Cancel" disabled={busy} onPress={onCancelEdit} /> : null}
        </View>
      </View>
    </Card>
  );
}

function ImportFromBankModal({
  examId,
  onClose,
  onImported,
}: {
  examId: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const bank = useResource(
    () => fetchQuestionBank({ search: search.trim() || undefined, limit: 100 }),
    [search],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items: QuestionBankItemOut[] = bank.data?.items ?? [];

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!selectedIds.size) return;
    setImporting(true);
    setError(null);
    try {
      await importQuestionsFromBank(examId, Array.from(selectedIds));
      await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to import questions.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Import from Question Bank</Text>
              <Text style={styles.modalSub}>Select saved questions to import into this examination.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>
          <TextField label="Search" value={search} onChangeText={setSearch} placeholder="Search saved questions…" />
          <ScrollView style={styles.modalList}>
            {bank.loading ? (
              <Text style={styles.modalEmpty}>Loading Question Bank...</Text>
            ) : items.length ? (
              items.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggle(item.id)}
                    style={[styles.bankItem, selected && styles.bankItemOn]}
                  >
                    <View style={[styles.checkBox, selected && styles.checkBoxOn]} />
                    <View style={styles.bankItemText}>
                      <Text style={styles.bankMeta}>
                        {statusLabel(item.question_type)} · {item.default_marks} marks
                        {item.difficulty ? ` · ${item.difficulty}` : ""}
                        {item.subject_name ? ` · ${item.subject_name}` : ""}
                      </Text>
                      <Text style={styles.bankText}>{item.text}</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.modalEmpty}>No questions found in Question Bank matching your filter.</Text>
            )}
          </ScrollView>
          <ActionError message={error} />
          <View style={styles.modalFooter}>
            <Text style={styles.modalCount}>
              {selectedIds.size} question{selectedIds.size === 1 ? "" : "s"} selected
            </Text>
            <View style={styles.formActions}>
              <OutlineButton label="Cancel" onPress={onClose} />
              <PrimaryButton
                label={importing ? "Importing..." : `Import selected (${selectedIds.size})`}
                icon={Database}
                disabled={!selectedIds.size || importing}
                loading={importing}
                onPress={handleImport}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  linkBtn: {
    height: 40,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
    overflow: "hidden",
  },
  stack: {
    gap: 16,
  },
  qMeta: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  qText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    color: Colors.primary,
  },
  options: {
    marginTop: 12,
    gap: 6,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  explanation: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: "italic",
    color: Colors.mutedForeground,
  },
  qActions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 16,
  },
  form: {
    gap: 16,
  },
  optionEditor: {
    gap: 10,
  },
  optionLegend: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  optionEditRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  optionInput: {
    flex: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 13,
  },
  radioOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    backgroundColor: Colors.card,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  modalSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  modalList: {
    maxHeight: 320,
  },
  modalEmpty: {
    paddingVertical: 32,
    textAlign: "center",
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  bankItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
  },
  bankItemOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  checkBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 2,
  },
  checkBoxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  bankItemText: {
    flex: 1,
  },
  bankMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.mutedForeground,
  },
  bankText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  modalFooter: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  modalCount: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
});
