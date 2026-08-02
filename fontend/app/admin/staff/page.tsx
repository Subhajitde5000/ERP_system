"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UserPlus } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import { assignStaffRole, fetchStaff, inviteStaff, type StaffMember } from "@/lib/institution";

const INVITABLE_ROLES = [
  "TEACHER", "PRINCIPAL", "VICE_PRINCIPAL", "HOD", "MENTOR",
  "ACCOUNTANT", "LIBRARIAN", "HR_MANAGER", "ADMISSION_OFFICER",
];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "TEACHER" });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      setStaff(await fetchStaff());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setBusy(true);
    try {
      await inviteStaff(form);
      setForm({ name: "", email: "", phone: "", role: "TEACHER" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite the staff member.");
    } finally {
      setBusy(false);
    }
  }

  async function grantRole(s: StaffMember, role: string) {
    try {
      await assignStaffRole(s.id, role);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the role.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Staff & Users"
        subtitle="Invite staff — they get a set-password link by email. Assign additional roles below."
        action={
          <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover">
            <Plus className="h-4 w-4" aria-hidden="true" /> Invite
          </button>
        }
      />

      {showForm ? (
        <Card className="mb-6">
          <form onSubmit={invite} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full name</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Nair" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="priya@college.edu" />
            </div>
            <div>
              <label className={labelClass}>Phone (optional)</label>
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                <UserPlus className="h-4 w-4" aria-hidden="true" /> {busy ? "Inviting…" : "Send invite"}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {staff === null ? <Loading /> : staff.length === 0 ? <EmptyState text="No staff yet. Invite your first team member." /> : (
        <ul className="space-y-3">
          {staff.map((s) => (
            <li key={s.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-primary">
                      {s.name}
                      {!s.is_active ? <span className="ml-2 rounded-full bg-destructive-light px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-text">Inactive</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{s.email ?? "—"}{s.department_name ? ` · ${s.department_name}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.roles.map((r) => (
                      <span key={r} className="rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">{r.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Add role:</span>
                  {INVITABLE_ROLES.filter((r) => !s.roles.includes(r)).slice(0, 5).map((r) => (
                    <button key={r} type="button" onClick={() => grantRole(s, r)} className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-[#475569] transition hover:border-accent hover:text-accent">
                      + {r.replace(/_/g, " ").toLowerCase()}
                    </button>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
