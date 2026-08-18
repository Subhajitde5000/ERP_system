/**
 * Question Bank — list, add, edit, delete, plus CSV import/export so the
 * website's Question Bank tools are present on the app.
 */

import { useState } from "react";
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { ActionError, OutlineButton, PrimaryButton, SearchField, StatusPill } from "@/components/teacher-ui";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { statusLabel } from "@/lib/format";
import {
  QUESTION_BANK_CSV_TEMPLATE,
  createQuestionBankItem,
  deleteQuestionBankItem,
  exportQuestionBankCsv,
  fetchQuestionBank,
  importQuestionBankText,
  updateQuestionBankItem,
  type QuestionBankImportResult,
  type QuestionBankItemIn,
  type QuestionBankItemOut,
  type TeacherDifficulty,
  type TeacherQuestionOptionIn,
  type TeacherQuestionType,
} from "@/lib/teacher";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

async function shareOrDownload(filename: string, body: string, mime = "text/csv") {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([body], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: body });
}

const OBJECTIVE: TeacherQuestionType[] = ["MCQ", "TRUE_FALSE"];

export default function TeacherQuestionBankPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [compose, setCompose] = useState<"add" | QuestionBankItemOut | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const resource = useResource(
    () =>
      fetchQuestionBank({
        search: search.trim() || undefined,
        question_type: typeFilter || undefined,
        difficulty: difficultyFilter || undefined,
        limit: 100,
      }),
    [search, typeFilter, difficultyFilter],
  );

  const items = resource.data?.items ?? [];

  return (
    <Screen>
      <PageHeader
        title="Question Bank"
        subtitle="Master repository of examination questions. Questions created in exams are automatically saved here for reuse."
        action={
          <View style={styles.headerActions}>
            <OutlineButton label="Import File" icon={Upload} onPress={() => setShowImport(true)} />
            <OutlineButton
              label={exporting ? "Exporting..." : "Export CSV"}
              icon={Download}
              disabled={exporting}
              onPress={async () => {
                setExporting(true);
                setExportError(null);
                try {
                  const file = await exportQuestionBankCsv({
                    question_type: typeFilter || undefined,
                    difficulty: difficultyFilter || undefined,
                    search: search.trim() || undefined,
                  });
                  await shareOrDownload(file.filename, file.csv);
                } catch (err) {
                  setExportError(err instanceof Error ? err.message : "Export failed.");
                } finally {
                  setExporting(false);
                }
              }}
            />
            <PrimaryButton label="Add Question" icon={Plus} onPress={() => setCompose("add")} />
          </View>
        }
      />
      <ActionError message={exportError} />
      <Card style={styles.filters} padded={false}>
        <View style={styles.filterInner}>
          <SearchField value={search} onChange={setSearch} placeholder="Search questions by text..." />
          <SelectField
            label="Question type"
            options={[
              { value: "", label: "All Question Types" },
              { value: "MCQ", label: "Multiple Choice" },
              { value: "TRUE_FALSE", label: "True / False" },
              { value: "SHORT_ANSWER", label: "Short Answer" },
              { value: "LONG_ANSWER", label: "Long Answer" },
              { value: "FILL_BLANK", label: "Fill in Blank" },
              { value: "MATCH", label: "Match Following" },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <SelectField
            label="Difficulty"
            options={[
              { value: "", label: "All Difficulties" },
              { value: "EASY", label: "Easy" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HARD", label: "Hard" },
            ]}
            value={difficultyFilter}
            onChange={setDifficultyFilter}
          />
        </View>
      </Card>
      {showImport ? (
        <ImportBankPanel
          onClose={() => setShowImport(false)}
          onImported={async () => {
            setShowImport(false);
            await resource.reload();
          }}
        />
      ) : null}
      {compose ? (
        <BankQuestionForm
          item={compose === "add" ? null : compose}
          onClose={() => setCompose(null)}
          onSaved={async () => {
            setCompose(null);
            await resource.reload();
          }}
        />
      ) : null}
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading Question Bank..."
      >
        {items.length ? (
          <View style={styles.list}>
            {items.map((item, index) => (
              <QuestionBankCard
                key={item.id}
                index={index + 1}
                item={item}
                onEdit={() => setCompose(item)}
                onDeleted={resource.reload}
              />
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState text="No questions in your Question Bank matching your filters." />
          </Card>
        )}
      </AsyncState>
    </Screen>
  );
}

function QuestionBankCard({
  index,
  item,
  onEdit,
  onDeleted,
}: {
  index: number;
  item: QuestionBankItemOut;
  onEdit: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    Alert.alert("Delete question", "Remove this question from the bank?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await deleteQuestionBankItem(item.id);
            await onDeleted();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Failed to delete.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <Card>
      <View style={styles.metaRow}>
        <Text style={styles.qMeta}>
          Q{index} · {statusLabel(item.question_type)} · {item.default_marks} marks
          {item.negative_marks ? ` · −${item.negative_marks} neg` : ""}
        </Text>
        {item.difficulty ? <StatusPill label={item.difficulty} tone="accent" /> : null}
      </View>
      {item.subject_name ? <Text style={styles.subject}>{item.subject_name}</Text> : null}
      <Text style={styles.qText}>{item.text}</Text>
      {item.options?.length ? (
        <View style={styles.options}>
          {item.options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <View style={[styles.dot, { backgroundColor: opt.is_correct ? Colors.success : Colors.border }]} />
              <Text style={[styles.optionText, opt.is_correct && styles.optionCorrect]}>
                {opt.text}
                {opt.is_correct ? "  (correct)" : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {item.explanation ? <Text style={styles.explanation}>Explanation: {item.explanation}</Text> : null}
      <Text style={styles.usage}>
        Used in {item.usage_count} exam{item.usage_count === 1 ? "" : "s"}
      </Text>
      <View style={styles.actions}>
        <OutlineButton label="Edit" icon={Pencil} onPress={onEdit} />
        <OutlineButton label={deleting ? "Removing..." : "Delete"} icon={Trash2} danger disabled={deleting} onPress={handleDelete} />
      </View>
      <ActionError message={error} />
    </Card>
  );
}

function ImportBankPanel({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionBankImportResult | null>(null);

  async function submit() {
    if (!payload.trim()) {
      setError("Paste a CSV or JSON file to import.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const looksJson = payload.trim().startsWith("[") || payload.trim().startsWith("{");
      const res = await importQuestionBankText(looksJson ? "import.json" : "import.csv", payload);
      setResult(res);
      if (res.imported > 0) await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.composer}>
      <Text style={styles.composerTitle}>Import Questions from File</Text>
      <Text style={styles.importHint}>
        Paste a CSV or JSON file. Need a template? Download one and fill it in, then paste it back here.
      </Text>
      <View style={styles.form}>
        <OutlineButton
          label="Download CSV template"
          icon={Download}
          onPress={() => shareOrDownload("question_bank_template.csv", QUESTION_BANK_CSV_TEMPLATE)}
        />
        <TextField
          label="CSV or JSON contents"
          value={payload}
          onChangeText={setPayload}
          multiline
          placeholder="text,question_type,..."
        />
        <ActionError message={error} />
        {result ? (
          <Text style={styles.importResult}>
            {result.imported} question{result.imported === 1 ? "" : "s"} imported
            {result.errors.length ? ` · ${result.errors.length} row(s) had errors` : ""}.
          </Text>
        ) : null}
        {result?.errors.length ? (
          <Text style={styles.importErrors}>{result.errors.slice(0, 8).join("\n")}</Text>
        ) : null}
        <View style={styles.actions}>
          {!result ? (
            <PrimaryButton
              label={busy ? "Importing..." : "Import Questions"}
              icon={Upload}
              loading={busy}
              onPress={submit}
            />
          ) : null}
          <OutlineButton label={result ? "Close" : "Cancel"} onPress={onClose} />
        </View>
      </View>
    </Card>
  );
}

function BankQuestionForm({
  item,
  onClose,
  onSaved,
}: {
  item: QuestionBankItemOut | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialType = ((item?.question_type as TeacherQuestionType) ?? "MCQ") as TeacherQuestionType;
  const [questionType, setQuestionType] = useState<TeacherQuestionType>(initialType);
  const [text, setText] = useState(item?.text ?? "");
  const [marks, setMarks] = useState(item ? String(item.default_marks) : "1");
  const [negativeMarks, setNegativeMarks] = useState(item ? String(item.negative_marks) : "0");
  const [difficulty, setDifficulty] = useState(item?.difficulty ?? "");
  const [explanation, setExplanation] = useState(item?.explanation ?? "");
  const [options, setOptions] = useState<TeacherQuestionOptionIn[]>(
    item?.options?.length
      ? item.options.map((o, i) => ({ text: o.text ?? "", is_correct: !!o.is_correct, sort_order: i }))
      : [
          { text: "", is_correct: true, sort_order: 0 },
          { text: "", is_correct: false, sort_order: 1 },
          { text: "", is_correct: false, sort_order: 2 },
          { text: "", is_correct: false, sort_order: 3 },
        ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objective = OBJECTIVE.includes(questionType);

  async function submit() {
    if (!text.trim()) {
      setError("Please write question text.");
      return;
    }
    let payloadOptions: TeacherQuestionOptionIn[] = [];
    if (objective) {
      payloadOptions = options
        .filter((o) => o.text.trim())
        .map((o, idx) => ({ text: o.text.trim(), is_correct: !!o.is_correct, sort_order: idx }));
      if (payloadOptions.length < 2) {
        setError("Objective questions need at least two options.");
        return;
      }
      if (!payloadOptions.some((o) => o.is_correct)) {
        setError("Please mark at least one option as correct.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const payload: QuestionBankItemIn = {
        text: text.trim(),
        question_type: questionType,
        default_marks: Number(marks),
        negative_marks: Number(negativeMarks),
        difficulty: (difficulty || null) as TeacherDifficulty | null,
        explanation: explanation.trim() || null,
        options: payloadOptions,
      };
      if (item) await updateQuestionBankItem(item.id, payload);
      else await createQuestionBankItem(payload);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save question to bank.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.composer}>
      <Text style={styles.composerTitle}>{item ? "Edit Question" : "Add Question to Bank"}</Text>
      <View style={styles.form}>
        <SelectField
          label="Question Type"
          options={[
            { value: "MCQ", label: "Multiple choice" },
            { value: "TRUE_FALSE", label: "True / False" },
            { value: "SHORT_ANSWER", label: "Short answer" },
            { value: "LONG_ANSWER", label: "Long answer" },
            { value: "FILL_BLANK", label: "Fill in blank" },
            { value: "MATCH", label: "Match following" },
          ]}
          value={questionType}
          onChange={(val) => {
            const typed = val as TeacherQuestionType;
            setQuestionType(typed);
            if (typed === "TRUE_FALSE") {
              setOptions([
                { text: "True", is_correct: true, sort_order: 0 },
                { text: "False", is_correct: false, sort_order: 1 },
              ]);
            }
          }}
        />
        <TextField label="Default Marks" value={marks} onChangeText={setMarks} keyboardType="numeric" />
        <TextField label="Negative Marks" value={negativeMarks} onChangeText={setNegativeMarks} keyboardType="numeric" />
        <TextField label="Question Text" value={text} onChangeText={setText} multiline />
        {objective ? (
          <View style={styles.optionEditor}>
            <Text style={styles.optionLegend}>Options (tap the circle for the correct answer)</Text>
            {options.map((opt, i) => (
              <View key={i} style={styles.optionEditRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!opt.is_correct }}
                  onPress={() =>
                    setOptions((current) => current.map((o, idx) => ({ ...o, is_correct: idx === i })))
                  }
                  style={[styles.radio, opt.is_correct && styles.radioOn]}
                />
                <View style={styles.optionInput}>
                  <TextField
                    label={`Option ${i + 1}`}
                    value={opt.text}
                    onChangeText={(value) =>
                      setOptions((current) => current.map((o, idx) => (idx === i ? { ...o, text: value } : o)))
                    }
                  />
                </View>
              </View>
            ))}
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
        <View style={styles.actions}>
          <PrimaryButton
            label={busy ? "Saving..." : item ? "Save Changes" : "Save Question"}
            loading={busy}
            onPress={submit}
          />
          <OutlineButton label="Cancel" onPress={onClose} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  importHint: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.mutedForeground,
  },
  importResult: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.successText,
  },
  importErrors: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.destructiveText,
  },
  filters: {
    marginBottom: 16,
    padding: 16,
  },
  filterInner: {
    gap: 16,
  },
  list: {
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  qMeta: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  subject: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.primary,
  },
  qText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    color: Colors.primary,
  },
  options: {
    marginTop: 10,
    gap: 4,
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
    marginTop: 5,
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.mutedForeground,
  },
  optionCorrect: {
    color: Colors.successText,
    fontWeight: "600",
  },
  explanation: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: "italic",
    color: Colors.mutedForeground,
  },
  usage: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  composer: {
    marginBottom: 16,
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
    gap: 8,
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
});
