"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import { createStudent, fetchClasses, fetchStudents, type ClassRecord, type StudentRecord } from "@/lib/institution";

/** The same protected surface is used by the Academic Coordinator and Admin.
 * Authorization remains server-side: only those two roles can read or write. */
export function StudentRecordsPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const [students, setStudents] = useState<StudentRecord[] | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", roll_no: "", email: "", gender: "", class_id: "" });

  const load = useCallback(async () => {
    try {
      const [studentRows, classRows] = await Promise.all([fetchStudents(), fetchClasses()]);
      setStudents(studentRows); setClasses(classRows.filter((row) => row.is_active)); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load student records."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.roll_no) return;
    setBusy(true); setError(null);
    try {
      await createStudent({ name: form.name, roll_no: form.roll_no, email: form.email || undefined, gender: form.gender || undefined, class_id: form.class_id || undefined });
      setForm({ name: "", roll_no: "", email: "", gender: "", class_id: "" }); setAdding(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add the student."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl">
    <PageHeader title="Student records" subtitle={isAdmin ? "Academic records are normally managed by the Academic Coordinator. Use this fallback only when needed." : "Add students and assign their academic class. Teachers, HODs and admission staff cannot manage these records."} action={<button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent hover:bg-accent-hover"><Plus className="h-4 w-4" /> Add student</button>} />
    {adding && <Card className="mb-6"><form onSubmit={addStudent} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div><label className={labelClass}>Full name</label><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><label className={labelClass}>Roll number</label><input required className={inputClass} value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} /></div><div><label className={labelClass}>Email (optional)</label><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><label className={labelClass}>Gender (optional)</label><select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Not specified</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div><div><label className={labelClass}>Class / section</label><select className={inputClass} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}><option value="">Assign later</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</select></div><div className="flex items-end"><button disabled={busy} className="h-11 rounded-field bg-accent px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save student"}</button></div></form></Card>}
    {error && <div className="mb-4"><ErrorState message={error} /></div>}
    {students === null ? <Loading /> : students.length === 0 ? <EmptyState text="No student records yet. Add the first student." /> : <Card className="overflow-hidden !p-0"><div className="flex items-center gap-2 border-b border-border px-5 py-4"><Users className="h-5 w-5 text-accent" /><h2 className="font-display font-bold text-primary">Students ({students.length})</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Roll no.</th><th className="px-5 py-3">Class / section</th><th className="px-5 py-3">Academic year</th></tr></thead><tbody className="divide-y divide-border">{students.map((student) => <tr key={student.id}><td className="px-5 py-3"><p className="font-semibold text-primary">{student.name}</p><p className="text-xs text-muted-foreground">{student.email ?? "No email"}</p></td><td className="px-5 py-3 font-mono text-primary">{student.roll_no ?? "—"}</td><td className="px-5 py-3 text-muted-foreground">{student.enrollment?.class_name ?? "Not assigned"}</td><td className="px-5 py-3 text-muted-foreground">{student.enrollment?.academic_year_name ?? "—"}</td></tr>)}</tbody></table></div></Card>}
  </div>;
}
