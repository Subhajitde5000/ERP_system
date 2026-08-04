"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, UserPlus } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import {
  assignStaffRole,
  fetchDepartments,
  fetchStaff,
  inviteStaff,
  revokeStaffRole,
  type Department,
  type StaffMember,
} from "@/lib/institution";
import { roleLabel, STAFF_INVITABLE_ROLES } from "@/lib/roles";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "TEACHER",
    departmentId: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [vpDepartments, setVpDepartments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [staffRows, departmentRows] = await Promise.all([fetchStaff(), fetchDepartments()]);
      setStaff(staffRows);
      setDepartments(departmentRows.filter((department) => department.is_active));
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
    if (form.role === "VICE_PRINCIPAL" && !form.departmentId) {
      setError("Select the department delegated to this Vice Principal.");
      return;
    }
    setBusy(true);
    try {
      await inviteStaff({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        departmentId: form.role === "VICE_PRINCIPAL" ? form.departmentId : undefined,
      });
      setForm({ name: "", email: "", phone: "", role: "TEACHER", departmentId: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite the staff member.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeVpScope(s: StaffMember, departmentId?: string) {
    if (!departmentId) {
      setError("Select the delegated department to revoke.");
      return;
    }
    try {
      await revokeStaffRole(s.id, "VICE_PRINCIPAL", departmentId);
      setVpDepartments((current) => ({ ...current, [s.id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the Vice Principal delegation.");
    }
  }

  async function grantRole(s: StaffMember, role: string, departmentId?: string) {
    if (role === "VICE_PRINCIPAL" && !departmentId) {
      setError("Select a delegated department before assigning the Vice Principal role.");
      return;
    }
    try {
      await assignStaffRole(s.id, role, departmentId);
      if (role === "VICE_PRINCIPAL") {
        setVpDepartments((current) => ({ ...current, [s.id]: "" }));
      }
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
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, departmentId: "" })}>
                {STAFF_INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
            {form.role === "VICE_PRINCIPAL" ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>Delegated department</label>
                <select
                  className={inputClass}
                  value={form.departmentId}
                  onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
                  required
                >
                  <option value="">Select a department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vice Principals can view and post only within their delegated department and its classes.
                </p>
              </div>
            ) : null}
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
                    {s.roles.map((r, idx) => (
                      <span key={`${r}-${idx}`} className="rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent">{r.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Add role:</span>
                  {STAFF_INVITABLE_ROLES.filter((r) => r !== "VICE_PRINCIPAL" && !s.roles.includes(r)).slice(0, 5).map((r) => (
                    <button key={r} type="button" onClick={() => grantRole(s, r)} className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-[#475569] transition hover:border-accent hover:text-accent">
                      + {roleLabel(r).toLowerCase()}
                    </button>
                  ))}
                </div>
                {departments.length ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-field bg-muted p-2.5">
                    <label htmlFor={`vp-department-${s.id}`} className="text-xs font-semibold text-primary">
                      Delegate VP department
                    </label>
                    <select
                      id={`vp-department-${s.id}`}
                      className="h-8 min-w-44 rounded border border-border bg-white px-2 text-xs text-primary"
                      value={vpDepartments[s.id] ?? ""}
                      onChange={(event) => setVpDepartments({ ...vpDepartments, [s.id]: event.target.value })}
                    >
                      <option value="">Select department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!vpDepartments[s.id]}
                      onClick={() => grantRole(s, "VICE_PRINCIPAL", vpDepartments[s.id])}
                      className="h-8 rounded border border-accent-border bg-white px-2.5 text-xs font-semibold text-accent transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {s.roles.includes("VICE_PRINCIPAL") ? "Add department" : "Assign VP role"}
                    </button>
                    {s.roles.includes("VICE_PRINCIPAL") ? (
                      <button
                        type="button"
                        disabled={!vpDepartments[s.id]}
                        onClick={() => revokeVpScope(s, vpDepartments[s.id])}
                        className="h-8 rounded border border-destructive-border bg-white px-2.5 text-xs font-semibold text-destructive-text transition hover:bg-destructive-light disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Revoke selected scope
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
