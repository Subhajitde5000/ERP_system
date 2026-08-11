"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Plus, Search, Trash2 } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  fetchQuestionBank,
  type QuestionBankItemIn,
  type QuestionBankItemOut,
  type TeacherDifficulty,
  type TeacherQuestionOptionIn,
  type TeacherQuestionType,
} from "@/lib/teacher";

const OBJECTIVE: TeacherQuestionType[] = ["MCQ", "TRUE_FALSE"];

export function TeacherQuestionBankPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Question Bank"
        subtitle="Master repository of examination questions. Questions created in exams are automatically saved here for reuse."
        action={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" /> Add Question to Bank
          </button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search questions by text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="w-40">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">All Question Types</option>
              <option value="MCQ">Multiple Choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short Answer</option>
              <option value="LONG_ANSWER">Long Answer</option>
              <option value="FILL_BLANK">Fill in Blank</option>
              <option value="MATCH">Match Following</option>
            </select>
          </div>
          <div className="w-36">
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>
      </Card>

      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading Question Bank...">
        {items.length ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <QuestionBankCard
                key={item.id}
                index={index + 1}
                item={item}
                onDeleted={async () => {
                  await resource.reload();
                }}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState text="No questions in your Question Bank matching your filters." />
          </Card>
        )}
      </AsyncState>

      {showAddModal ? (
        <CreateBankQuestionModal
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            setShowAddModal(false);
            await resource.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function QuestionBankCard({
  index,
  item,
  onDeleted,
}: {
  index: number;
  item: QuestionBankItemOut;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
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
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Q{index}</span>
            <span>·</span>
            <span>{statusLabel(item.question_type)}</span>
            <span>·</span>
            <span>{item.default_marks} marks</span>
            {item.negative_marks ? <span>· −{item.negative_marks} neg</span> : null}
            {item.difficulty ? (
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">{item.difficulty}</span>
            ) : null}
            {item.subject_name ? <span className="text-primary">· {item.subject_name}</span> : null}
            <span className="ml-auto text-xs font-semibold text-muted-foreground">
              Used in {item.usage_count} exam{item.usage_count === 1 ? "" : "s"}
            </span>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-primary">{item.text}</p>

          {item.options && item.options.length ? (
            <ul className="mt-3 space-y-1">
              {item.options.map((opt, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-xs ${
                    opt.is_correct ? "font-semibold text-success-text" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      opt.is_correct ? "bg-success" : "bg-border"
                    }`}
                  />
                  {opt.text}
                  {opt.is_correct ? <span className="text-[10px] uppercase font-bold">(correct)</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {item.explanation ? (
            <p className="mt-2 text-xs italic text-muted-foreground">Explanation: {item.explanation}</p>
          ) : null}
        </div>

        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="inline-flex h-8 items-center gap-1 rounded-field border border-destructive-border px-2.5 text-xs font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Removing..." : "Delete"}
        </button>
      </div>

      {error ? <p role="alert" className="mt-2 text-xs text-destructive-text">{error}</p> : null}
    </Card>
  );
}

function CreateBankQuestionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [questionType, setQuestionType] = useState<TeacherQuestionType>("MCQ");
  const [text, setText] = useState("");
  const [marks, setMarks] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [difficulty, setDifficulty] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<TeacherQuestionOptionIn[]>([
    { text: "", is_correct: true, sort_order: 0 },
    { text: "", is_correct: false, sort_order: 1 },
    { text: "", is_correct: false, sort_order: 2 },
    { text: "", is_correct: false, sort_order: 3 },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objective = OBJECTIVE.includes(questionType);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await createQuestionBankItem(payload);
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save question to bank.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-display text-lg font-bold text-primary">Add Question to Bank</h2>
          <button type="button" onClick={onClose} className="rounded-field p-1 text-muted-foreground hover:bg-muted">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Question Type</label>
              <select
                className={inputClass}
                value={questionType}
                onChange={(e) => {
                  const val = e.target.value as TeacherQuestionType;
                  setQuestionType(val);
                  if (val === "TRUE_FALSE") {
                    setOptions([
                      { text: "True", is_correct: true, sort_order: 0 },
                      { text: "False", is_correct: false, sort_order: 1 },
                    ]);
                  }
                }}
              >
                <option value="MCQ">Multiple choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_ANSWER">Short answer</option>
                <option value="LONG_ANSWER">Long answer</option>
                <option value="FILL_BLANK">Fill in blank</option>
                <option value="MATCH">Match following</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Default Marks</label>
              <input
                type="number"
                min={0.5}
                max={100}
                step={0.5}
                className={inputClass}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Negative Marks</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className={inputClass}
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Question Text</label>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>

          {objective ? (
            <div className="space-y-2">
              <label className={labelClass}>Options (tick the correct answer)</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="modal-correct"
                    checked={!!opt.is_correct}
                    onChange={() =>
                      setOptions((current) =>
                        current.map((item, idx) => ({ ...item, is_correct: idx === i })),
                      )
                    }
                    className="h-4 w-4 accent-accent"
                  />
                  <input
                    className={inputClass}
                    value={opt.text}
                    onChange={(e) =>
                      setOptions((current) =>
                        current.map((item, idx) => (idx === i ? { ...item, text: e.target.value } : item)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Difficulty (optional)</label>
              <select className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Not set</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Explanation (optional)</label>
              <input className={inputClass} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </div>
          </div>

          {error ? <p role="alert" className="text-xs text-destructive-text">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-field border border-border px-4 text-xs font-semibold text-primary hover:border-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-5 text-xs font-semibold text-white shadow-accent disabled:opacity-50"
            >
              <Database className="h-4 w-4" />
              {busy ? "Saving..." : "Save Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
