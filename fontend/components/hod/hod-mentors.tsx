"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Card, EmptyState, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { assignHodMentor, fetchHodMentors, removeHodMentor } from "@/lib/hod";
import { AsyncState, percent } from "@/components/principal/principal-ui";

/** C-HD-08 — canonical mentor assignments; a student can have one active mentor/year. */
export function HodMentorsPage() {
  const resource = useResource(fetchHodMentors, []);
  const [studentId, setStudentId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId || !mentorId) return;
    setBusy(true); setError(null);
    try {
      resource.setData(await assignHodMentor({ student_id: studentId, mentor_id: mentorId, notes: notes || undefined }));
      setStudentId(""); setMentorId(""); setNotes("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not assign the mentor."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(null);
    try { resource.setData(await removeHodMentor(id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove the mentor assignment."); }
    finally { setBusy(false); }
  }

  const assignableStudents = resource.data
    ? [
        ...resource.data.unassigned_students.map((student) => ({ ...student, mentorName: null })),
        ...resource.data.groups.flatMap((group) => group.mentees.map((student) => ({ ...student, mentorName: group.mentor_name }))),
      ].sort((left, right) => left.student_name.localeCompare(right.student_name))
    : [];

  return <div className="mx-auto max-w-6xl"><PageHeader title="Mentor assignments" subtitle="Assign or reassign one active mentor for each student in your departments." />
    <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading mentor assignments…">
      {resource.data ? <><Card className="mb-5"><form onSubmit={assign} className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Student</label><select className={inputClass} value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Select student</option>{assignableStudents.map((student) => <option key={student.student_id} value={student.student_id}>{student.student_name} · {student.class_name}{student.mentorName ? ` · currently ${student.mentorName}` : ""}</option>)}</select></div><div><label className={labelClass}>Mentor</label><select className={inputClass} value={mentorId} onChange={(event) => setMentorId(event.target.value)} required><option value="">Select mentor</option>{resource.data.eligible_teachers.filter((teacher) => teacher.is_mentor).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></div><div className="sm:col-span-2"><label className={labelClass}>Notes (optional)</label><input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></div><div className="sm:col-span-2"><button type="submit" disabled={busy || !resource.data.mentor_role_in_use} className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60"><UserPlus className="h-4 w-4" /> {busy ? "Saving…" : "Assign mentor"}</button></div></form>{!resource.data.mentor_role_in_use ? <p className="mt-3 text-sm text-warning-text">No eligible teacher in this department currently holds the Mentor role. An Institution Admin must grant it first.</p> : null}{error ? <p role="alert" className="mt-3 text-sm text-destructive-text">{error}</p> : null}</Card>
      {resource.data.groups.length ? <div className="grid gap-4 lg:grid-cols-2">{resource.data.groups.map((group) => <Card key={group.mentor_id}><div className="flex justify-between gap-3"><div><h2 className="font-display font-bold text-primary">{group.mentor_name}</h2><p className="text-sm text-muted-foreground">{group.designation ?? "Mentor"}</p></div><span className="text-sm font-semibold text-primary">{group.mentees.length} mentees</span></div>{group.mentees.length ? <ul className="mt-4 space-y-2 border-t border-border pt-3">{group.mentees.map((mentee) => <li key={mentee.student_id} className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-primary">{mentee.student_name}</span><span className="block text-xs text-muted-foreground">{mentee.roll_number ?? "—"} · {mentee.class_name}</span></span><span className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold text-primary">{percent(mentee.attendance_percentage)}</span>{mentee.mentor_assignment_id ? <button type="button" disabled={busy} onClick={() => remove(mentee.mentor_assignment_id!)} aria-label={`Remove mentor from ${mentee.student_name}`} className="rounded p-1 text-destructive-text hover:bg-destructive-light disabled:opacity-50"><X className="h-4 w-4" /></button> : null}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No mentees assigned.</p>}</Card>)}</div> : <EmptyState text="No active mentors are configured in your departments." />}</> : null}
    </AsyncState>
  </div>;
}
