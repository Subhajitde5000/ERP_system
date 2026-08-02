"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { assignHodTeacherSubject, fetchHodTeachers, removeHodTeacherSubject } from "@/lib/hod";
import { AsyncState, statusLabel } from "@/components/principal/principal-ui";

/** C-HD-07 — teacher load and scoped subject staffing. */
export function HodTeachersPage() {
  const resource = useResource(fetchHodTeachers, []);
  const [form, setForm] = useState({ teacherId: "", subjectId: "", role: "TEACHER" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!form.teacherId || !form.subjectId) return;
    setBusy(true);
    setError(null);
    try {
      resource.setData(await assignHodTeacherSubject({ teacher_id: form.teacherId, subject_id: form.subjectId, role_in_subject: form.role }));
      setForm({ teacherId: "", subjectId: "", role: "TEACHER" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign the subject.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      resource.setData(await removeHodTeacherSubject(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the subject assignment.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-6xl"><PageHeader title="Department teachers" subtitle="Teaching loads and subject assignments for your departments." />
    <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading department teachers…">
      {resource.data ? <><Card className="mb-5"><form onSubmit={assign} className="grid gap-4 sm:grid-cols-3"><div><label className={labelClass}>Teacher</label><select className={inputClass} value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })} required><option value="">Select teacher</option>{resource.data.teachers.filter((teacher) => teacher.is_active).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.department_name}</option>)}</select></div><div><label className={labelClass}>Subject</label><select className={inputClass} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} required><option value="">Select subject</option>{resource.data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.class_name} · {subject.code} · {subject.name}</option>)}</select></div><div><label className={labelClass}>Teaching role</label><select className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="TEACHER">Teacher</option><option value="CO_TEACHER">Co-teacher</option><option value="LAB_ASSISTANT">Lab assistant</option></select></div><div className="sm:col-span-3"><button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" /> {busy ? "Saving…" : "Assign subject"}</button></div></form>{error ? <p role="alert" className="mt-3 text-sm text-destructive-text">{error}</p> : null}</Card>
      {resource.data.unstaffed_subjects.length ? <Card className="mb-5 border-warning-border"><h2 className="font-display text-base font-bold text-primary">Unstaffed subjects</h2><p className="mt-1 text-sm text-muted-foreground">Assign a teacher before attendance and marks depend on these subjects.</p><div className="mt-3 flex flex-wrap gap-2">{resource.data.unstaffed_subjects.map((subject) => <span key={subject.id} className="rounded-full bg-warning-light px-2.5 py-1 text-xs font-semibold text-warning-text">{subject.class_name} · {subject.code}</span>)}</div></Card> : null}
      {resource.data.teachers.length ? <div className="grid gap-4 lg:grid-cols-2">{resource.data.teachers.map((teacher) => <Card key={teacher.id}><div className="flex justify-between gap-3"><div><h2 className="font-display font-bold text-primary">{teacher.name}</h2><p className="text-sm text-muted-foreground">{teacher.designation ?? "Teaching staff"} · {teacher.department_name}</p></div><span className={teacher.is_active ? "text-xs font-semibold text-success-text" : "text-xs font-semibold text-destructive-text"}>{teacher.is_active ? "Active" : "Inactive"}</span></div><dl className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center"><Metric label="Subjects" value={teacher.total_subject_count} /><Metric label="Lead" value={teacher.primary_subject_count} /><Metric label="Classes" value={teacher.class_count} /><Metric label="Mentees" value={teacher.mentor_count} /></dl>{teacher.subjects.length ? <ul className="mt-4 space-y-2 border-t border-border pt-3">{teacher.subjects.map((subject) => <li key={subject.teacher_subject_id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0"><strong className="font-mono text-primary">{subject.subject_code}</strong><span className="ml-2 text-muted-foreground">{subject.class_name} · {statusLabel(subject.role_in_subject)}</span></span><button type="button" disabled={busy} onClick={() => remove(subject.teacher_subject_id)} aria-label={`Remove ${subject.subject_code}`} className="rounded p-1 text-destructive-text hover:bg-destructive-light disabled:opacity-50"><X className="h-4 w-4" /></button></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No subjects assigned.</p>}</Card>)}</div> : <EmptyState text="No teaching staff are assigned to your departments." />}</> : null}
    </AsyncState>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div><dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-lg font-bold text-primary">{value}</dd></div>; }
