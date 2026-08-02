"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import { createDepartment, fetchDepartments, type Department } from "@/lib/institution";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const load = useCallback(async () => {
    try {
      setDepartments(await fetchDepartments());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load departments.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Departments" subtitle="Create departments; assign heads from the staff page." />

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
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
              <Plus className="h-4 w-4" aria-hidden="true" /> {busy ? "Adding…" : "Add department"}
            </button>
          </div>
        </form>
      </Card>

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {departments === null ? <Loading /> : departments.length === 0 ? <EmptyState text="No departments yet. Add your first one above." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {departments.map((d) => (
            <Card key={d.id} className="!p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-field bg-accent-light text-accent">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-primary">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.code} · Head: {d.hod_name ?? "Unassigned"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-field bg-[#F8FAFC] p-2">
                  <p className="font-display text-lg font-bold text-primary">{d.class_count}</p>
                  <p className="text-[11px] text-muted-foreground">classes</p>
                </div>
                <div className="rounded-field bg-[#F8FAFC] p-2">
                  <p className="font-display text-lg font-bold text-primary">{d.staff_count}</p>
                  <p className="text-[11px] text-muted-foreground">staff</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
