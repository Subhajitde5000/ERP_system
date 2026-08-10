"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Edit2, Plus, Trash2, X, Check } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import { createDepartment, deleteDepartment, fetchDepartments, fetchStaff, updateDepartment, type Department, type StaffMember } from "@/lib/institution";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", description: "" });
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
    setError(null);
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

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditForm({ name: dept.name, code: dept.code, description: dept.description || "" });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(deptId: string) {
    if (!editForm.name.trim() || !editForm.code.trim()) return;
    setUpdating(deptId);
    setError(null);
    try {
      await updateDepartment(deptId, {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        description: editForm.description.trim() || undefined,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the department.");
    } finally { setUpdating(null); }
  }

  async function handleDelete(dept: Department) {
    setError(null);
    setDeletingId(dept.id);
    try {
      await deleteDepartment(dept.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete department.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Departments" subtitle="Manage academic departments, edit information, delete empty departments, and assign department HODs." />

      {/* Add Department Form */}
      <Card className="mb-6">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science & Engineering" />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CSE" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Description (optional)</label>
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Department description..." />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
              <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add department"}
            </button>
          </div>
        </form>
      </Card>

      {/* Error alert banner */}
      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {/* Department Cards Grid */}
      {departments === null ? (
        <Loading />
      ) : departments.length === 0 ? (
        <EmptyState text="No departments yet. Add your first one above." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {departments.map((department) => {
            const isEditing = editingId === department.id;
            const isDeleting = deletingId === department.id;

            return (
              <Card key={department.id} className="!p-5 flex flex-col justify-between">
                <div>
                  {isEditing ? (
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className={labelClass}>Name</label>
                        <input
                          className={inputClass}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Code</label>
                        <input
                          className={inputClass}
                          value={editForm.code}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <input
                          className={inputClass}
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(department.id)}
                          disabled={updating === department.id}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/40"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-accent-light text-accent">
                          <Building2 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-display font-bold text-primary">{department.name}</p>
                          <p className="text-xs font-mono font-semibold text-muted-foreground">{department.code}</p>
                          {department.description && (
                            <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-1">{department.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(department)}
                          aria-label={`Edit ${department.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(department)}
                          disabled={isDeleting}
                          aria-label={`Delete ${department.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-light hover:text-destructive-text transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="mt-2">
                      <label htmlFor={`hod-${department.id}`} className={labelClass}>Department HOD</label>
                      <select
                        id={`hod-${department.id}`}
                        className={inputClass}
                        value={department.hod_id ?? ""}
                        disabled={updating === department.id}
                        onChange={(event) => setHod(department, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}{member.department_name ? ` · ${member.department_name}` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">Assigning an HOD creates their scoped HOD role for this department.</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-center border-t border-border/50 pt-3">
                  <div className="rounded-field bg-[#F8FAFC] p-2">
                    <p className="font-display text-lg font-bold text-primary">{department.class_count}</p>
                    <p className="text-[11px] text-muted-foreground">classes</p>
                  </div>
                  <div className="rounded-field bg-[#F8FAFC] p-2">
                    <p className="font-display text-lg font-bold text-primary">{department.staff_count}</p>
                    <p className="text-[11px] text-muted-foreground">staff</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
