"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, Upload, UserPlus, X } from "lucide-react";

import {
  Card,
  EmptyState,
  ErrorState,
  inputClass,
  labelClass,
  Loading,
  PageHeader,
} from "@/components/admin/ui";
import {
  createEnrollment,
  createStudent,
  fetchClasses,
  fetchEnrollments,
  fetchStudents,
  uploadStudents,
  type BulkUploadResult,
  type ClassRow,
  type Enrollment,
  type Student,
  type StudentCreate,
} from "@/lib/institution";

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

const TEMPLATE_CSV = [
  "name,roll_no,email,gender,date_of_birth,class_code",
  "Aryan Rao,PHY001,aryan@college.edu,MALE,2006-04-12,PHY-1",
  "Meera Iyer,PHY002,meera@college.edu,FEMALE,2006-11-03,PHY-1",
].join("\n");

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    roll_no: "",
    email: "",
    gender: "",
    class_id: "",
  });
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollForm, setEnrollForm] = useState({ class_id: "", roll_number: "" });
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const activeClasses = classes.filter((c) => c.is_active);

  const load = useCallback(async () => {
    try {
      const [studentRows, classRows, enrollmentRows] = await Promise.all([
        fetchStudents(),
        fetchClasses(),
        fetchEnrollments(),
      ]);
      setStudents(studentRows);
      setClasses(classRows);
      setEnrollments(enrollmentRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load students.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.roll_no) return;
    setBusy(true);
    setError(null);
    try {
      await createStudent({
        name: form.name,
        roll_no: form.roll_no,
        email: form.email || undefined,
        gender: (form.gender as StudentCreate["gender"] | undefined) || undefined,
        class_id: form.class_id || undefined,
      });
      setForm({ name: "", roll_no: "", email: "", gender: "", class_id: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the student.");
    } finally {
      setBusy(false);
    }
  }

  async function enroll(studentId: string) {
    if (!enrollForm.class_id) return;
    setBusy(true);
    setError(null);
    try {
      await createEnrollment({
        student_id: studentId,
        class_id: enrollForm.class_id,
        roll_number: enrollForm.roll_number || undefined,
      });
      setEnrollingId(null);
      setEnrollForm({ class_id: "", roll_number: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enrol the student.");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "students-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!bulkFile) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const result = await uploadStudents(bulkFile);
      setBulkResult(result);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      setBulkFile(null);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Could not upload the file.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Students"
        subtitle="Add students one by one, or upload a CSV to import them in bulk."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowBulk((v) => !v)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-field border border-accent-border bg-white px-4 text-sm font-semibold text-accent transition hover:bg-accent-light"
            >
              <Upload className="h-4 w-4" aria-hidden="true" /> Bulk upload
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add student
            </button>
          </div>
        }
      />

      {showBulk ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">Import students from CSV</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Headers: <code className="rounded bg-muted px-1 py-0.5">name</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">roll_no</code> (required) —{" "}
                <code className="rounded bg-muted px-1 py-0.5">email</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">gender</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">date_of_birth</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">class_code</code> (optional).
                Use the class <em>code</em> (e.g. PHY-1) to enrol students automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex h-9 items-center gap-2 rounded border border-border bg-white px-3 text-xs font-semibold text-primary transition hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download template
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={bulkInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="block w-full max-w-sm text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-accent-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent"
            />
            <button
              type="button"
              disabled={bulkBusy || !bulkFile}
              onClick={upload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" /> {bulkBusy ? "Importing…" : "Import"}
            </button>
          </div>

          {bulkError ? <div className="mt-4"><ErrorState message={bulkError} /></div> : null}

          {bulkResult ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-field border border-border bg-muted/50 p-3 text-sm">
                <span className="font-bold text-primary">{bulkResult.created} of {bulkResult.total} students imported</span>
                {bulkResult.errors.length ? <span className="text-destructive-text"> · {bulkResult.errors.length} row{bulkResult.errors.length === 1 ? "" : "s"} failed</span> : null}
                {bulkResult.warnings.length ? <span className="text-amber-600"> · {bulkResult.warnings.length} warning{bulkResult.warnings.length === 1 ? "" : "s"}</span> : null}
                {bulkResult.created === bulkResult.total ? <span className="ml-2 text-emerald-600">✓</span> : null}
              </div>
              {bulkResult.errors.length ? (
                <div className="rounded-field border border-destructive-border bg-destructive-light/40 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-destructive-text">Rows that were not imported</p>
                  <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-primary">
                    {bulkResult.errors.map((issue) => (
                      <li key={`e-${issue.row}`}>Row {issue.row}: <span className="text-destructive-text">{issue.message}</span></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {bulkResult.warnings.length ? (
                <div className="rounded-field border border-amber-300 bg-amber-50 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">Imported, but not enrolled</p>
                  <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-primary">
                    {bulkResult.warnings.map((issue) => (
                      <li key={`w-${issue.row}`}>Row {issue.row}: {issue.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full name</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Aryan Rao"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Roll number</label>
              <input
                className={inputClass}
                value={form.roll_no}
                onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
                placeholder="PHY001"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Email (optional)</label>
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="aryan@college.edu"
              />
            </div>
            <div>
              <label className={labelClass}>Gender (optional)</label>
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Not specified</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{titleCase(g)}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Enrol into class (optional)</label>
              <select
                className={inputClass}
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Not enrolled yet</option>
                {activeClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.department_name ? ` · ${c.department_name}` : ""}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Needs one current academic year and a class to enrol into.
              </p>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" /> {busy ? "Saving…" : "Create student"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {students === null ? <Loading /> : students.length === 0 ? <EmptyState text="No students yet. Add your first student above." /> : (
        <ul className="space-y-3">
          {students.map((s) => (
            <li key={s.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-primary">
                      {s.name}
                      {!s.is_active ? <span className="ml-2 rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-text">Inactive</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.roll_no ?? "No roll number"}{s.email ? ` · ${s.email}` : ""}{s.gender ? ` · ${titleCase(s.gender)}` : ""}
                    </p>
                  </div>
                  {s.enrollment ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">
                      {s.enrollment.class_name}
                      {s.enrollment.roll_number ? <span className="text-accent/70">· {s.enrollment.roll_number}</span> : null}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEnrollingId(enrollingId === s.id ? null : s.id)}
                      className="rounded-full border border-accent-border px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent-light"
                    >
                      Enrol
                    </button>
                  )}
                </div>

                {enrollingId === s.id && !s.enrollment ? (
                  <div className="mt-3 grid gap-3 rounded-field bg-muted p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <select
                      className="h-9 rounded border border-border bg-white px-2 text-xs text-primary"
                      value={enrollForm.class_id}
                      onChange={(e) => setEnrollForm({ ...enrollForm, class_id: e.target.value })}
                    >
                      <option value="">Select class</option>
                      {activeClasses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.department_name ? ` · ${c.department_name}` : ""}</option>
                      ))}
                    </select>
                    <input
                      className="h-9 rounded border border-border bg-white px-2 text-xs text-primary"
                      value={enrollForm.roll_number}
                      onChange={(e) => setEnrollForm({ ...enrollForm, roll_number: e.target.value })}
                      placeholder="Roll number (optional)"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy || !enrollForm.class_id}
                        onClick={() => enroll(s.id)}
                        className="h-9 rounded bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEnrollingId(null); setEnrollForm({ class_id: "", roll_number: "" }); }}
                        className="h-9 rounded border border-border bg-white px-2 text-muted-foreground transition hover:bg-muted"
                        aria-label="Cancel enrolment"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {enrollments.length ? (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-primary">Enrolments</h2>
          <Card className="!p-0">
            <ul className="divide-y divide-border">
              {enrollments.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{e.student_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.class_name} · {e.academic_year_name}
                      {e.roll_number ? ` · Roll ${e.roll_number}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">{titleCase(e.status)}</span>
                    <span className="text-xs text-muted-foreground">{e.enrollment_date}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
