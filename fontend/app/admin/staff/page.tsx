"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, Upload, UserPlus } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import {
  assignStaffRole,
  fetchDepartments,
  fetchStaff,
  inviteStaff,
  revokeStaffRole,
  uploadStaff,
  type BulkUploadResult,
  type Department,
  type StaffMember,
} from "@/lib/institution";
import { roleLabel, STAFF_INVITABLE_ROLES } from "@/lib/roles";

const TEMPLATE_CSV = [
  "name,email,phone,role,department_code",
  "Priya Nair,priya@college.edu,+91 98765 43210,TEACHER,CS",
  "Rahul Verma,rahul@college.edu,,ACADEMIC_COORDINATOR,",
].join("\n");

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
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

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

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "staff-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!bulkFile) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const result = await uploadStaff(bulkFile);
      setBulkResult(result);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      setBulkFile(null);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Could not upload the file.");
    } finally {
      setBulkBusy(false);
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
        subtitle="Invite staff one by one, or upload a CSV to import them in bulk."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowBulk((v) => !v)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-field border border-accent-border bg-white px-4 text-sm font-semibold text-accent transition hover:bg-accent-light"
            >
              <Upload className="h-4 w-4" aria-hidden="true" /> Bulk upload
            </button>
            <button type="button" onClick={() => setShowForm((v) => !v)} className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover">
              <Plus className="h-4 w-4" aria-hidden="true" /> Invite
            </button>
          </div>
        }
      />

      {showBulk ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">Import staff from CSV</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Headers: <code className="rounded bg-muted px-1 py-0.5">name</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">email</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">role</code> (required) —{" "}
                <code className="rounded bg-muted px-1 py-0.5">phone</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">department_code</code> (optional).
                Use the department <em>code</em> (e.g. CS) to scope the role. Valid roles:{" "}
                <span className="text-primary">{STAFF_INVITABLE_ROLES.map((r) => roleLabel(r)).join(", ")}</span>.
                Vice Principals must have a department code.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex h-9 items-center gap-2 rounded border border-border bg-white px-3 text-xs font-semibold text-primary transition hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download template
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={bulkInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              className="block w-full max-w-sm text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-accent-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-accent"
            />
            <button
              type="button"
              disabled={bulkBusy || !bulkFile}
              onClick={upload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" /> {bulkBusy ? "Importing…" : "Import"}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Each imported member receives the standard set-password invite email.
          </p>

          {bulkError ? <div className="mt-4"><ErrorState message={bulkError} /></div> : null}

          {bulkResult ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-field border border-border bg-muted/50 p-3 text-sm">
                <span className="font-bold text-primary">{bulkResult.created} of {bulkResult.total} staff imported</span>
                {bulkResult.errors.length ? <span className="text-destructive-text"> · {bulkResult.errors.length} row{bulkResult.errors.length === 1 ? "" : "s"} failed</span> : null}
                {bulkResult.warnings.length ? <span className="text-amber-600"> · {bulkResult.warnings.length} warning{bulkResult.warnings.length === 1 ? "" : "s"}</span> : null}
                {bulkResult.created === bulkResult.total ? <span className="ml-2 text-emerald-600">✓</span> : null}
              </div>
              {bulkResult.errors.length ? (
                <div className="rounded-field border border-destructive-border bg-destructive-light/40 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-destructive-text">Rows that were not imported</p>
                  <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-primary">
                    {bulkResult.errors.map((issue) => (
                      <li key={`e-${issue.row}`}>Row {issue.row}: <span className="text-destructive-text">{issue.message}</span></li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {bulkResult.warnings.length ? (
                <div className="rounded-field border border-amber-300 bg-amber-50 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">Imported, but not scoped to a department</p>
                  <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-primary">
                    {bulkResult.warnings.map((issue) => (
                      <li key={`w-${issue.row}`}>Row {issue.row}: {issue.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

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
