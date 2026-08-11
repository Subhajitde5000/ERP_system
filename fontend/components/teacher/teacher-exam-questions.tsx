"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
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
import { AsyncState, statusLabel } from "@/components/principal/principal-ui";

const OBJECTIVE: TeacherQuestionType[] = ["MCQ", "TRUE_FALSE"];

interface OptionDraft extends TeacherQuestionOptionIn {
  key: number;
}

let optionKey = 0;

function newOption(isCorrect = false): OptionDraft {
  optionKey += 1;
  return { key: optionKey, text: "", is_correct: isCorrect, sort_order: optionKey };
}

/** C-TC-10 — add MCQ / descriptive / true-false questions with options. */
export function TeacherExamQuestionsPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const resource = useResource(() => fetchTeacherExam(examId), [examId]);
  const [editing, setEditing] = useState<TeacherQuestionOut | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const data = resource.data;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={resource.data ? `Questions — ${resource.data.title}` : "Questions"}
        subtitle="Objective questions are auto-graded; descriptive ones are graded from the Results screen."
        action={
          <div className="flex flex-wrap gap-2">
            {data && data.status === "DRAFT" ? (
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
              >
                <Database className="h-4 w-4" /> Import from Question Bank
              </button>
            ) : null}
            <Link href={`/teacher/examinations/${examId}`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
              Exam detail
            </Link>
            <Link href={`/teacher/examinations/${examId}/results`} className="inline-flex h-10 items-center rounded-field border border-border px-4 text-sm font-semibold text-primary hover:border-accent hover:text-accent">
              Results
            </Link>
          </div>
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading questions…">
        {data ? (
          <div className="space-y-5">
            {data.status !== "DRAFT" ? (
              <p className="rounded-field border border-warning-border bg-warning-light px-4 py-2.5 text-sm text-warning-text">
                This exam is {statusLabel(data.status).toLowerCase()} — questions can no longer be edited.
              </p>
            ) : null}
            {data.questions.length ? (
              <ol className="space-y-3">
                {data.questions.map((question, index) => (
                  <Card key={question.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          Q{index + 1} · {statusLabel(question.question_type)} · {question.marks} marks
                          {question.negative_marks ? ` · −${question.negative_marks} negative` : ""}
                          {question.difficulty ? ` · ${statusLabel(question.difficulty)}` : ""}
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold text-primary">{question.text}</p>
                        {question.options.length ? (
                          <ul className="mt-3 space-y-1.5">
                            {question.options.map((option) => (
                              <li key={option.id} className={`flex items-center gap-2 text-sm ${option.is_correct ? "font-semibold text-success-text" : "text-muted-foreground"}`}>
                                <span className={`inline-block h-2 w-2 rounded-full ${option.is_correct ? "bg-success" : "bg-border"}`} />
                                {option.text}
                                {option.is_correct ? <span className="text-[10px] font-bold uppercase">(correct)</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {question.explanation ? <p className="mt-2 text-xs italic text-muted-foreground">Explanation: {question.explanation}</p> : null}
                      </div>
                      {data.status === "DRAFT" ? (
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(question);
                              document.getElementById("question-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-field border border-border px-2.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <RemoveQuestionButton
                            examId={examId}
                            questionId={question.id}
                            onRemoved={(detail) => {
                              if (editing?.id === question.id) setEditing(null);
                              resource.setData({ ...data, ...detail });
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </ol>
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
            {showImportModal && data ? (
              <ImportFromBankModal
                examId={examId}
                subjectId={data.subject_id}
                onClose={() => setShowImportModal(false)}
                onImported={async () => {
                  await resource.reload();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </AsyncState>
    </div>
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
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
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
        className="inline-flex h-8 items-center gap-1 rounded-field border border-destructive-border px-2.5 text-xs font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" /> {busy ? "Removing…" : "Remove"}
      </button>
      {error ? <p role="alert" className="mt-1 max-w-48 text-[11px] text-destructive-text">{error}</p> : null}
    </div>
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

  /* Entering/leaving edit mode (or switching rows) re-seeds the form. */
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        // question_type is immutable once created — the server validates the
        // new options against the existing type, so it is never sent.
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
      <div id="question-composer" className="scroll-mt-24">
        <h2 className="font-display text-base font-bold text-primary">
          {editing ? "Edit question" : "Add a question"}
        </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="q-type" className={labelClass}>Question type</label>
            <select
              id="q-type"
              className={inputClass}
              disabled={!!editing}
              value={questionType}
              onChange={(event) => {
                const next = event.target.value as TeacherQuestionType;
                setQuestionType(next);
                if (next === "TRUE_FALSE") {
                  setOptions([
                    { ...newOption(true), text: "True" },
                    { ...newOption(), text: "False" },
                  ]);
                } else if (next === "MCQ") {
                  setOptions([newOption(true), newOption(), newOption(), newOption()]);
                }
              }}
            >
              <option value="MCQ">Multiple choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short answer</option>
              <option value="LONG_ANSWER">Long answer</option>
              <option value="FILL_BLANK">Fill in the blank</option>
              <option value="MATCH">Match the following</option>
            </select>
          </div>
          <div>
            <label htmlFor="q-marks" className={labelClass}>Marks</label>
            <input id="q-marks" type="number" min={0.5} max={1000} step={0.5} className={inputClass} value={marks} onChange={(event) => setMarks(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="q-negative" className={labelClass}>Negative marks</label>
            <input id="q-negative" type="number" min={0} max={1000} step={0.5} className={inputClass} value={negativeMarks} onChange={(event) => setNegativeMarks(event.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="q-text" className={labelClass}>Question</label>
          <textarea id="q-text" className={`${inputClass} min-h-24 py-3`} maxLength={20000} value={text} onChange={(event) => setText(event.target.value)} required />
        </div>
        {objective ? (
          <fieldset>
            <legend className={labelClass}>Options — tick the correct answer</legend>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    aria-label={`Option ${index + 1} is correct`}
                    checked={!!option.is_correct}
                    onChange={() => setOptions((current) => current.map((item) => ({ ...item, is_correct: item.key === option.key })))}
                    className="h-4 w-4 accent-accent"
                  />
                  <input
                    className={inputClass}
                    aria-label={`Option ${index + 1} text`}
                    value={option.text}
                    maxLength={2000}
                    onChange={(event) =>
                      setOptions((current) => current.map((item) => (item.key === option.key ? { ...item, text: event.target.value } : item)))
                    }
                    disabled={questionType === "TRUE_FALSE"}
                  />
                  {questionType === "MCQ" && options.length > 2 ? (
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => setOptions((current) => current.filter((item) => item.key !== option.key))}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-field border border-border text-muted-foreground hover:border-destructive-border hover:text-destructive-text"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {questionType === "MCQ" && options.length < 8 ? (
              <button
                type="button"
                onClick={() => setOptions((current) => [...current, newOption()])}
                className="mt-2 inline-flex h-8 items-center gap-1 rounded-field border border-border px-2.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </button>
            ) : null}
          </fieldset>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="q-difficulty" className={labelClass}>Difficulty (optional)</label>
            <select id="q-difficulty" className={inputClass} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="">Not set</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label htmlFor="q-explanation" className={labelClass}>Explanation (optional)</label>
            <input id="q-explanation" className={inputClass} maxLength={5000} value={explanation} onChange={(event) => setExplanation(event.target.value)} />
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {busy ? (editing ? "Saving…" : "Adding…") : editing ? "Save changes" : "Add question"}
          </button>
          {editing ? (
            <button
              type="button"
              disabled={busy}
              onClick={onCancelEdit}
              className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-primary hover:border-accent hover:text-accent disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      </div>
    </Card>
  );
}

function ImportFromBankModal({
  examId,
  subjectId,
  onClose,
  onImported,
}: {
  examId: string;
  subjectId?: string;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [items, setItems] = useState<QuestionBankItemOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBank = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchQuestionBank({ subject_id: subjectId, search: search.trim() || undefined, limit: 100 });
      setItems(res.items);
    } catch {
      setError("Failed to load question bank items.");
    } finally {
      setLoading(false);
    }
  }, [subjectId, search]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!selectedIds.size) return;
    setImporting(true);
    setError(null);
    try {
      await importQuestionsFromBank(examId, Array.from(selectedIds));
      await onImported();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to import questions.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Import from Question Bank</h2>
            <p className="text-xs text-muted-foreground">Select saved questions to import directly into this examination.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-field p-1 text-muted-foreground hover:bg-muted hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="my-4">
          <input
            type="text"
            placeholder="Search saved questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading Question Bank...</p>
          ) : items.length ? (
            items.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  selectedIds.has(item.id)
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-1 h-4 w-4 rounded accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{statusLabel(item.question_type)}</span>
                    <span>{item.default_marks} marks</span>
                    {item.difficulty ? (
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">{item.difficulty}</span>
                    ) : null}
                    {item.subject_name ? <span className="text-primary font-medium">· {item.subject_name}</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-primary">{item.text}</p>
                </div>
              </label>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No questions found in Question Bank matching your filter.
            </p>
          )}
        </div>

        {error ? <p role="alert" className="mt-2 text-xs text-destructive-text">{error}</p> : null}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedIds.size} question{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-field border border-border px-4 text-xs font-semibold text-primary hover:border-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedIds.size || importing}
              onClick={handleImport}
              className="inline-flex h-9 items-center gap-1.5 rounded-field bg-accent px-4 text-xs font-semibold text-white shadow-accent disabled:opacity-50"
            >
              <Database className="h-3.5 w-3.5" />
              {importing ? "Importing..." : `Import Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
