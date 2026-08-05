"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FileSpreadsheet, Upload, X } from "lucide-react";

import { Card, PageHeader } from "@/components/admin/ui";

type ImportKind = "students" | "staff";
type CsvRow = Record<string, string>;

const REQUIRED_COLUMNS: Record<ImportKind, string[]> = {
  students: ["name", "roll_no", "class_code"],
  staff: ["name", "email", "role"],
};

const OPTIONAL_COLUMNS: Record<ImportKind, string[]> = {
  students: ["email", "gender", "date_of_birth"],
  staff: ["phone"],
};

/** Parses a normal CSV including quoted commas, without sending the local file
 * anywhere. The import API can use the accepted rows in a later submit step. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim()); value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/^\uFEFF/, "").trim().replace(/[\s-]+/g, "_");
}

export default function AdminImportPage() {
  const [kind, setKind] = useState<ImportKind>("students");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null); setRows([]); setHeaders([]); setMessage(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const changeKind = (next: ImportKind) => { setKind(next); reset(); };

  const selectFile = (file?: File) => {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a CSV file. Excel files should be saved as CSV before uploading.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The file is larger than 5 MB. Split it into smaller CSV files and try again.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("The selected file could not be read. Please try again.");
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 2) { setError("This CSV has no data rows to preview."); return; }
      const parsedHeaders = parsed[0].map(normaliseHeader);
      const missing = REQUIRED_COLUMNS[kind].filter((column) => !parsedHeaders.includes(column));
      if (missing.length) {
        setError(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
        return;
      }
      const records = parsed.slice(1).map((line) => Object.fromEntries(parsedHeaders.map((header, i) => [header, line[i] ?? ""])));
      setFileName(file.name); setHeaders(parsedHeaders); setRows(records);
      setMessage(`${records.length} ${kind === "students" ? "student" : "staff"} record${records.length === 1 ? "" : "s"} ready to review. Nothing has been imported yet.`);
    };
    reader.readAsText(file);
  };

  const visibleColumns = [...REQUIRED_COLUMNS[kind], ...OPTIONAL_COLUMNS[kind]].filter((column) => headers.includes(column));
  const previewRows = rows.slice(0, 10);

  return <div className="mx-auto max-w-6xl">
    <PageHeader title="Import people" subtitle="Upload a CSV and review every field before records are added to your institution." />

    <Card className="mb-6 !p-2">
      <div className="flex gap-2" role="tablist" aria-label="Import type">
        {(["students", "staff"] as const).map((option) => <button key={option} type="button" role="tab" aria-selected={kind === option} onClick={() => changeKind(option)} className={`flex-1 rounded-field px-4 py-2.5 text-sm font-semibold transition ${kind === option ? "bg-accent text-white shadow-accent" : "text-muted-foreground hover:bg-muted"}`}>
          Import {option === "students" ? "students" : "staff"}
        </button>)}
      </div>
    </Card>

    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">Upload {kind === "students" ? "student" : "staff"} CSV</h2>
          <p className="mt-1 text-sm text-muted-foreground">Required columns: <code className="font-semibold text-primary">{REQUIRED_COLUMNS[kind].join(", ")}</code>. Optional: {OPTIONAL_COLUMNS[kind].join(", ")}.</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent hover:bg-accent-hover"><Upload className="h-4 w-4" /> Choose CSV</button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
      </div>
      <div className="mt-5 rounded-field border border-dashed border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground"><FileSpreadsheet className="mr-2 inline h-4 w-4 text-accent" />Use a UTF-8 CSV file up to 5 MB. The file is read locally so you can preview it before any import is submitted.</div>
    </Card>

    {error && <div role="alert" className="mt-5 flex gap-3 rounded-field border border-destructive-border bg-destructive-light p-4 text-sm text-destructive-text"><AlertCircle className="h-5 w-5 shrink-0" /> <span>{error}</span></div>}

    {rows.length > 0 && <section className="mt-6" aria-labelledby="preview-heading">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div><h2 id="preview-heading" className="flex items-center gap-2 font-display text-lg font-bold text-primary"><Eye className="h-5 w-5 text-accent" /> Preview before import</h2><p className="mt-1 text-sm text-muted-foreground">{fileName} · showing the first {previewRows.length} of {rows.length} records</p></div>
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-destructive-text"><X className="h-4 w-4" /> Remove file</button>
        </div>
        {message && <p className="mt-4 flex items-center gap-2 rounded-field bg-success-light px-3 py-2.5 text-sm text-success-text"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</p>}
        <div className="mt-4 overflow-x-auto rounded-field border border-border"><table className="min-w-full text-left text-sm"><thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr>{visibleColumns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 font-semibold">{column.replace(/_/g, " ")}</th>)}</tr></thead><tbody className="divide-y divide-border bg-white">{previewRows.map((record, index) => <tr key={index}>{visibleColumns.map((column) => <td key={column} className="whitespace-nowrap px-4 py-3 text-primary">{record[column] || <span className="text-muted-foreground">—</span>}</td>)}</tr>)}</tbody></table></div>
        {rows.length > previewRows.length && <p className="mt-3 text-xs text-muted-foreground">Only the first 10 rows are displayed in this preview.</p>}
      </Card>
    </section>}
  </div>;
}
