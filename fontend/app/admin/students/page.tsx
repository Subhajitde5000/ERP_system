"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";

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
  type ClassRow,
  type Enrollment,
  type Student,
  type StudentCreate,
} from "@/lib/institution";

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();

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

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Students"
        subtitle="Create students and enrol them into classes for the current academic year."
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add student
          </button>
        }
      />

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
