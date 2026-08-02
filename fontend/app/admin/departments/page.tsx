"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import { createDepartment, fetchDepartments, fetchStaff, updateDepartment, type Department, type StaffMember } from "@/lib/institution";

/**
 * Live institution department administration. Selecting a department HOD also
 * creates the matching scoped HOD role assignment in the backend.
 */
export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const load = useCallback(async () => {
    try {
      const [departmentRows, staffRows] = await Promise.all([fetchDepartments(), fetchStaff()]);
      setDepartments(departmentRows);
      setStaff(staffRows.filter((member) => member.is_active));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load departments.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.code) return;
    setBusy(true);
    try {
      await createDepartment({ name: form.name, code: form.code, description: form.description || undefined });
      setForm({ name: "", code: "", description: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the department.");
    } finally { setBusy(false); }
  }

  async function setHod(department: Department, hodId: string) {
    setUpdating(department.id); setError(null);
    try {
      await updateDepartment(department.id, { hod_id: hodId || null });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the department HOD.");
    } finally { setUpdating(null); }
  }

  return <div className="mx-auto max-w-4xl"><PageHeader title="Departments" subtitle="Create departments and assign a department HOD with a live, scoped role." />
    <Card className="mb-6"><form onSubmit={create} className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Name</label><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science & Engineering" /></div><div><label className={labelClass}>Code</label><input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CSE" /></div><div className="sm:col-span-2"><label className={labelClass}>Description (optional)</label><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="sm:col-span-2"><button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"><Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add department"}</button></div></form></Card>
    {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
    {departments === null ? <Loading /> : departments.length === 0 ? <EmptyState text="No departments yet. Add your first one above." /> : <div className="grid gap-3 sm:grid-cols-2">{departments.map((department) => <Card key={department.id} className="!p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-field bg-accent-light text-accent"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-display font-bold text-primary">{department.name}</p><p className="text-xs text-muted-foreground">{department.code}</p></div></div><div className="mt-4"><label htmlFor={`hod-${department.id}`} className={labelClass}>Department HOD</label><select id={`hod-${department.id}`} className={inputClass} value={department.hod_id ?? ""} disabled={updating === department.id} onChange={(event) => setHod(department, event.target.value)}><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}{member.department_name ? ` · ${member.department_name}` : ""}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Assigning an HOD creates their scoped HOD role for this department.</p></div><div className="mt-4 grid grid-cols-2 gap-3 text-center"><div className="rounded-field bg-[#F8FAFC] p-2"><p className="font-display text-lg font-bold text-primary">{department.class_count}</p><p className="text-[11px] text-muted-foreground">classes</p></div><div className="rounded-field bg-[#F8FAFC] p-2"><p className="font-display text-lg font-bold text-primary">{department.staff_count}</p><p className="text-[11px] text-muted-foreground">staff</p></div></div></Card>)}</div>}
  </div>;
}
