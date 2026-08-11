"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { AsyncState, statusLabel } from "@/components/principal/principal-ui";
import { useResource } from "@/hooks/use-resource";
import {
  createQuestionBankItem,
  deleteQuestionBankItem,
  exportQuestionBank,
  fetchQuestionBank,
  importQuestionBankFile,
  updateQuestionBankItem,
  type QuestionBankImportResult,
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFmt, setExportFmt] = useState<"csv" | "pdf">("csv");
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

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      if (exportFmt === "pdf") {
        printQuestionBankPdf(items);
      } else {
        await exportQuestionBank({
          fmt: "csv",
          question_type: typeFilter || undefined,
          difficulty: difficultyFilter || undefined,
          search: search.trim() || undefined,
        });
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Question Bank"
        subtitle="Master repository of examination questions. Questions created in exams are automatically saved here for reuse."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Import */}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-field border border-border bg-card px-4 text-sm font-semibold text-primary shadow-sm transition hover:border-accent hover:text-accent"
            >
              <Upload className="h-4 w-4" /> Import File
            </button>

            {/* Export */}
            <div className="flex items-center gap-1">
              <select
                value={exportFmt}
                onChange={(e) => setExportFmt(e.target.value as "csv" | "pdf")}
                className="h-10 rounded-l-field border border-r-0 border-border bg-card px-2 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex h-10 items-center gap-1.5 rounded-r-field border border-border bg-card px-3 text-sm font-semibold text-primary shadow-sm transition hover:border-accent hover:text-accent disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting..." : "Export"}
              </button>
            </div>

            {/* Add */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" /> Add Question
            </button>
          </div>
        }
      />

      {exportError ? (
        <p role="alert" className="text-xs text-destructive-text">{exportError}</p>
      ) : null}

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
                onEdited={async () => resource.reload()}
                onDeleted={async () => resource.reload()}
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

      {showImportModal ? (
        <ImportBankModal
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            setShowImportModal(false);
            await resource.reload();
          }}
        />
      ) : null}
    </div>
  );
}

// ── PDF export (browser print-to-PDF) ───────────────────────────────────────

function printQuestionBankPdf(items: QuestionBankItemOut[]) {
  const typeLabel: Record<string, string> = {
    MCQ: "Multiple Choice",
    TRUE_FALSE: "True / False",
    SHORT_ANSWER: "Short Answer",
    LONG_ANSWER: "Long Answer",
    FILL_BLANK: "Fill in Blank",
    MATCH: "Match Following",
  };

  const diffColor: Record<string, string> = {
    EASY: "#16a34a",
    MEDIUM: "#d97706",
    HARD: "#dc2626",
  };

  const questionRows = items
    .map((q, i) => {
      const diff = q.difficulty ?? "";
      const diffBadge = diff
        ? `<span style="background:${diffColor[diff] ?? "#64748b"}20;color:${diffColor[diff] ?? "#64748b"};border:1px solid ${diffColor[diff] ?? "#64748b"}40;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.05em;">${diff}</span>`
        : "";

      const optionsHtml =
        q.options && q.options.length
          ? `<ol style="margin:10px 0 0 0;padding-left:20px;list-style-type:upper-alpha;">
              ${q.options
                .map(
                  (o) =>
                    `<li style="margin:4px 0;font-size:12px;${o.is_correct ? "font-weight:700;color:#16a34a;" : "color:#374151;"}">${o.text}${o.is_correct ? " <span style='font-size:10px;'>(✓)</span>" : ""}</li>`,
                )
                .join("")}
            </ol>`
          : "";

      const explanationHtml = q.explanation
        ? `<p style="margin:8px 0 0 0;font-size:11px;color:#6b7280;font-style:italic;">Explanation: ${q.explanation}</p>`
        : "";

      return `
        <div style="page-break-inside:avoid;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:14px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <span style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.05em;">Q${i + 1}</span>
              <span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">${typeLabel[q.question_type] ?? q.question_type}</span>
              ${diffBadge}
            </div>
            <div style="text-align:right;white-space:nowrap;">
              <span style="font-size:11px;color:#6b7280;font-weight:600;">${q.default_marks} mark${q.default_marks !== 1 ? "s" : ""}${q.negative_marks ? ` · −${q.negative_marks} neg` : ""}</span>
            </div>
          </div>
          <p style="margin:0;font-size:13px;font-weight:600;color:#111827;line-height:1.5;">${q.text}</p>
          ${optionsHtml}
          ${explanationHtml}
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Question Bank Export</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9fafb; margin:0; padding:0; }
    .header { background: linear-gradient(135deg,#1e40af,#6d28d9); color:#fff; padding:24px 28px; border-radius:10px; margin-bottom:24px; }
    .header h1 { margin:0 0 4px 0; font-size:22px; font-weight:800; letter-spacing:-.02em; }
    .header p  { margin:0; font-size:12px; opacity:.8; }
    .meta { display:flex; gap:18px; margin-bottom:20px; }
    .meta-chip { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:6px 14px; font-size:11px; font-weight:600; color:#374151; }
    @media print {
      body { background:#fff; }
      .header { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📚 Question Bank</h1>
    <p>Exported on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · Teacher copy</p>
  </div>
  <div class="meta">
    <div class="meta-chip">Total Questions: <strong>${items.length}</strong></div>
  </div>
  ${questionRows}
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback if print fails
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}

function QuestionBankCard({
  index,
  item,
  onEdited,
  onDeleted,
}: {

  index: number;
  item: QuestionBankItemOut;
  onEdited: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
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
    <>
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

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="inline-flex h-8 items-center gap-1 rounded-field border border-border px-2.5 text-xs font-semibold text-primary hover:border-accent hover:text-accent"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="inline-flex h-8 items-center gap-1 rounded-field border border-destructive-border px-2.5 text-xs font-semibold text-destructive-text hover:bg-destructive-light disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Removing..." : "Delete"}
            </button>
          </div>
        </div>

        {error ? <p role="alert" className="mt-2 text-xs text-destructive-text">{error}</p> : null}
      </Card>

      {showEdit ? (
        <EditBankQuestionModal
          item={item}
          onClose={() => setShowEdit(false)}
          onSaved={async () => {
            setShowEdit(false);
            await onEdited();
          }}
        />
      ) : null}
    </>
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

// ── Import from file modal ───────────────────────────────────────────────────

function ImportBankModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuestionBankImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV or JSON file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await importQuestionBankFile(file);
      setResult(res);
      if (res.imported > 0) {
        await onImported();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  /** Generate and download a blank CSV template */
  const downloadTemplate = () => {
    const header = "text,question_type,difficulty,default_marks,negative_marks,explanation,options_json,tags,subject_id,class_id";
    const example =
      '"What is 2+2?",MCQ,EASY,1,0,"Basic arithmetic","[{""text"":""4"",""is_correct"":true},{""text"":""3"",""is_correct"":false}]",,,"';
    const blob = new Blob([header + "\n" + example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Import Questions from File</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Upload a CSV or JSON file to bulk-add questions to your bank.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-field p-1 text-muted-foreground hover:bg-muted">
            ✕
          </button>
        </div>

        {/* Template download hint */}
        <div className="flex items-center justify-between rounded-field border border-dashed border-border bg-muted/40 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Need a template?</span>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download CSV template
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File picker */}
          <div>
            <label className={labelClass}>Select file (.csv or .json)</label>
            <div
              className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-field border-2 border-dashed border-border p-6 transition hover:border-accent"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              {file ? (
                <span className="text-sm font-semibold text-primary">{file.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Click to choose a file</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>

          {error ? <p role="alert" className="text-xs text-destructive-text">{error}</p> : null}

          {result ? (
            <div className={`rounded-field border px-4 py-3 text-sm space-y-1 ${result.imported > 0 ? "border-success bg-success/10" : "border-border bg-muted/40"}`}>
              <p className="font-semibold text-primary">
                ✓ {result.imported} question{result.imported !== 1 ? "s" : ""} imported successfully.
              </p>
              {result.errors.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-destructive-text">
                    {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} had errors
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-field border border-border px-4 text-xs font-semibold text-primary hover:border-accent"
            >
              {result ? "Close" : "Cancel"}
            </button>
            {!result ? (
              <button
                type="submit"
                disabled={busy || !file}
                className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-5 text-xs font-semibold text-white shadow-accent disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {busy ? "Importing..." : "Import Questions"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit question bank item modal ────────────────────────────────────────────

function EditBankQuestionModal({
  item,
  onClose,
  onSaved,
}: {
  item: QuestionBankItemOut;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialType = (item.question_type as TeacherQuestionType) ?? "MCQ";
  const [questionType, setQuestionType] = useState<TeacherQuestionType>(initialType);
  const [text, setText] = useState(item.text);
  const [marks, setMarks] = useState(String(item.default_marks));
  const [negativeMarks, setNegativeMarks] = useState(String(item.negative_marks));
  const [difficulty, setDifficulty] = useState(item.difficulty ?? "");
  const [explanation, setExplanation] = useState(item.explanation ?? "");
  const [options, setOptions] = useState<TeacherQuestionOptionIn[]>(
    item.options?.length
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Question text is required.");
      return;
    }
    let payloadOptions: TeacherQuestionOptionIn[] | undefined;
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
      await updateQuestionBankItem(item.id, {
        text: text.trim(),
        question_type: questionType,
        default_marks: Number(marks),
        negative_marks: Number(negativeMarks),
        difficulty: (difficulty || null) as TeacherDifficulty | null,
        explanation: explanation.trim() || null,
        options: payloadOptions,
      });
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Edit Question</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Changes are saved back to your Question Bank.</p>
          </div>
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
                    name="edit-modal-correct"
                    checked={!!opt.is_correct}
                    onChange={() =>
                      setOptions((cur) => cur.map((o, idx) => ({ ...o, is_correct: idx === i })))
                    }
                    className="h-4 w-4 accent-accent"
                  />
                  <input
                    className={inputClass}
                    value={opt.text}
                    onChange={(e) =>
                      setOptions((cur) =>
                        cur.map((o, idx) => (idx === i ? { ...o, text: e.target.value } : o)),
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
              <Pencil className="h-4 w-4" />
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
