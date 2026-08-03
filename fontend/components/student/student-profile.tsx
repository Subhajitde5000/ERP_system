"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Card, PageHeader, inputClass, labelClass } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import { fetchStudentProfile, updateStudentProfile } from "@/lib/student";
import { AsyncState, dateOnly, statusLabel } from "@/components/principal/principal-ui";

/** C-ST-02 — read-only institute data + editable name/phone/avatar (C-RB-04). */
export function StudentProfilePage() {
  const resource = useResource(fetchStudentProfile, []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", avatar_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = resource.data;

  function startEdit() {
    if (!profile) return;
    setForm({ name: profile.name, phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
    setError(null);
    setEditing(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await updateStudentProfile({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      });
      resource.setData(updated);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My profile"
        subtitle="Your student record. Only your name, phone and photo are editable — the rest is managed by the institution."
        action={
          profile && !editing ? (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover"
            >
              <Pencil className="h-4 w-4" /> Edit profile
            </button>
          ) : undefined
        }
      />
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} loadingLabel="Loading your profile…">
        {profile ? (
          <div className="space-y-5">
            {editing ? (
              <Card>
                <form onSubmit={save} className="space-y-4">
                  <div>
                    <label htmlFor="profile-name" className={labelClass}>Full name</label>
                    <input id="profile-name" className={inputClass} minLength={2} maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                  </div>
                  <div>
                    <label htmlFor="profile-phone" className={labelClass}>Phone</label>
                    <input id="profile-phone" className={inputClass} maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="profile-avatar" className={labelClass}>Photo URL</label>
                    <input id="profile-avatar" type="url" className={inputClass} value={form.avatar_url} onChange={(event) => setForm({ ...form, avatar_url: event.target.value })} placeholder="https://…" />
                  </div>
                  {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={busy} className="inline-flex h-11 items-center rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60">
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="inline-flex h-11 items-center rounded-field border border-border px-5 text-sm font-semibold text-muted-foreground hover:border-accent hover:text-accent">
                      Cancel
                    </button>
                  </div>
                </form>
              </Card>
            ) : null}
            <Card>
              <div className="flex items-center gap-4">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full border border-border object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light font-display text-xl font-bold text-accent">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h2 className="font-display text-xl font-bold text-primary">{profile.name}</h2>
                  <p className="text-sm text-muted-foreground">{profile.email ?? "No email on record"}</p>
                </div>
              </div>
              <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Roll number" value={profile.class_info.roll_number ?? profile.student_roll_no ?? "—"} />
                <Row label="Class" value={profile.class_info.class_name ?? "—"} />
                <Row label="Department" value={profile.class_info.department_name ?? "—"} />
                <Row label="Academic year" value={profile.class_info.academic_year ?? "—"} />
                <Row label="Class teacher" value={profile.class_teacher_name ?? "Not assigned"} />
                <Row label="Phone" value={profile.phone ?? "—"} />
                <Row label="Date of birth" value={profile.date_of_birth ? dateOnly(profile.date_of_birth) : "—"} />
                <Row label="Gender" value={profile.gender ? statusLabel(profile.gender) : "—"} />
              </dl>
            </Card>
          </div>
        ) : null}
      </AsyncState>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border pb-2.5">
      <dt className="w-32 shrink-0 font-medium text-muted-foreground">{label}</dt>
      <dd className="font-medium text-primary">{value}</dd>
    </div>
  );
}
