"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Plus, Star, Trash2 } from "lucide-react";

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
  createAcademicYear,
  deleteAcademicYear,
  fetchAcademicYears,
  updateAcademicYear,
  type AcademicYear,
} from "@/lib/institution";
import { InstitutionAPIError } from "@/lib/institution";

export default function AcademicYearsPage() {
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_current: false });

  const load = useCallback(async () => {
    try {
      setYears(await fetchAcademicYears());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load academic years.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) return;
    setBusy(true);
    setError(null);
    try {
      await createAcademicYear(form);
      setForm({ name: "", start_date: "", end_date: "", is_current: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the academic year.");
    } finally {
      setBusy(false);
    }
  }

  async function setCurrent(y: AcademicYear) {
    try {
      await updateAcademicYear(y.id, { is_current: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the current year.");
    }
  }

  async function remove(y: AcademicYear) {
    if (!confirm(`Delete academic year "${y.name}"?`)) return;
    try {
      await deleteAcademicYear(y.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the year.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Academic Years" subtitle="Exactly one year should be current at any time." />

      <Card className="mb-6">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026-27" />
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>End date</label>
            <input type="date" className={inputClass} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked })} className="h-4 w-4 rounded border-[#CBD5E1] text-accent" />
            <span className="text-sm text-[#334155]">Set as current year</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
              <Plus className="h-4 w-4" aria-hidden="true" /> {busy ? "Adding…" : "Add year"}
            </button>
          </div>
        </form>
      </Card>

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {years === null ? <Loading /> : years.length === 0 ? <EmptyState text="No academic years yet. Add your first one above." /> : (
        <ul className="space-y-3">
          {years.map((y) => (
            <li key={y.id}>
              <Card className="flex items-center justify-between gap-4 !p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-field bg-accent-light text-accent">
                    <CalendarRange className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display font-bold text-primary">
                      {y.name}
                      {y.is_current ? (
                        <span className="ml-2 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold uppercase text-success-text">Current</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {y.start_date} → {y.end_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!y.is_current ? (
                    <button type="button" onClick={() => setCurrent(y)} title="Set as current" className="rounded-field p-2 text-muted-foreground hover:bg-muted hover:text-accent">
                      <Star className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => remove(y)} title="Delete" className="rounded-field p-2 text-muted-foreground hover:bg-destructive-light hover:text-destructive-text">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
