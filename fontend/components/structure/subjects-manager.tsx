"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Edit2, Filter, Plus, Search, Trash2, X } from "lucide-react";

import { Card, EmptyState, ErrorState, inputClass, labelClass, Loading, PageHeader } from "@/components/admin/ui";
import {
  createSubject,
  deleteSubject,
  fetchClasses,
  fetchSubjects,
  updateSubject,
  type ClassRecord,
  type SubjectRecord,
} from "@/lib/institution";

export function SubjectsManagerPage({ isCoordinator = false }: { isCoordinator?: boolean }) {
  const [subjects, setSubjects] = useState<SubjectRecord[] | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Create Form state
  const [form, setForm] = useState({
    name: "",
    code: "",
    class_id: "",
    subject_type: "THEORY",
    credits: "3",
    max_marks: "100",
    passing_marks: "35",
  });

  // Edit Modal state
  const [editing, setEditing] = useState<SubjectRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    subject_type: "THEORY",
    credits: "3",
    max_marks: "100",
    passing_marks: "35",
    is_active: true,
  });

  const load = useCallback(async () => {
    try {
      const [subjRows, classRows] = await Promise.all([fetchSubjects(), fetchClasses()]);
      setSubjects(subjRows);
      setClasses(classRows.filter((c) => c.is_active));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load subjects.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    return subjects.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        (s.class_name && s.class_name.toLowerCase().includes(search.toLowerCase()));

      const matchesClass = !classFilter || s.class_id === classFilter;
      const matchesType = !typeFilter || s.subject_type === typeFilter;

      return matchesSearch && matchesClass && matchesType;
    });
  }, [subjects, search, classFilter, typeFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.class_id) {
      setError("Please fill out subject name, code, and select a class.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createSubject({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        class_id: form.class_id,
        subject_type: form.subject_type,
        credits: form.credits ? Number(form.credits) : undefined,
        max_marks: Number(form.max_marks) || 100,
        passing_marks: Number(form.passing_marks) || 35,
      });
      setNotice(`✓ Subject ${created.code} (${created.name}) created successfully.`);
      setForm({
        name: "",
        code: "",
        class_id: form.class_id, // keep selected class for fast entry
        subject_type: "THEORY",
        credits: "3",
        max_marks: "100",
        passing_marks: "35",
      });
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create subject.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(subj: SubjectRecord) {
    setEditing(subj);
    setEditForm({
      name: subj.name,
      subject_type: subj.subject_type,
      credits: subj.credits !== null ? String(subj.credits) : "",
      max_marks: String(subj.max_marks),
      passing_marks: String(subj.passing_marks),
      is_active: subj.is_active,
    });
    setError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editForm.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateSubject(editing.id, {
        name: editForm.name.trim(),
        subject_type: editForm.subject_type,
        credits: editForm.credits ? Number(editForm.credits) : undefined,
        max_marks: Number(editForm.max_marks) || 100,
        passing_marks: Number(editForm.passing_marks) || 35,
        is_active: editForm.is_active,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update subject.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(subj: SubjectRecord) {
    if (!confirm(`Are you sure you want to delete ${subj.code} (${subj.name})?`)) return;
    setError(null);
    try {
      await deleteSubject(subj.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete subject.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Subject management"
        subtitle={
          isCoordinator
            ? "Create and manage class subjects, type (Theory/Practical/Elective), and marks criteria."
            : "Manage subjects attached to academic classes and sections."
        }
        action={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" /> Add subject
          </button>
        }
      />

      {/* Notice Banner */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-700">
          {notice}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      {/* Add Subject Form */}
      {adding && (
        <Card className="mb-6">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
            <h3 className="font-display font-bold text-primary">Create New Subject</h3>
            <button type="button" onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Class / Academic Group</label>
              <select required className={inputClass} value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Subject Name</label>
              <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Data Structures" />
            </div>
            <div>
              <label className={labelClass}>Subject Code</label>
              <input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CS201" />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={form.subject_type} onChange={(e) => setForm({ ...form, subject_type: e.target.value })}>
                <option value="THEORY">Theory</option>
                <option value="PRACTICAL">Practical</option>
                <option value="ELECTIVE">Elective</option>
                <option value="PROJECT">Project</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Credits (optional)</label>
              <input type="number" min="0" max="20" className={inputClass} value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Max Marks / Passing Marks</label>
              <div className="flex gap-2">
                <input type="number" min="1" className={inputClass} placeholder="Max 100" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} />
                <input type="number" min="0" className={inputClass} placeholder="Pass 35" value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: e.target.value })} />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
              <button disabled={busy} className="h-11 rounded-field bg-accent px-6 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60">
                {busy ? "Creating…" : "Save Subject"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by subject code, name, or class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-xs text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-accent"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-accent"
            >
              <option value="">All Types</option>
              <option value="THEORY">Theory</option>
              <option value="PRACTICAL">Practical</option>
              <option value="ELECTIVE">Elective</option>
              <option value="PROJECT">Project</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Subject List */}
      {subjects === null ? (
        <Loading />
      ) : subjects.length === 0 ? (
        <EmptyState text="No subjects created yet. Click 'Add subject' above." />
      ) : filteredSubjects.length === 0 ? (
        <Card className="p-8 text-center text-xs text-muted-foreground">
          No subjects match your search or filter selection.
        </Card>
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              <h2 className="font-display font-bold text-primary">
                Subjects ({filteredSubjects.length} of {subjects.length})
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Code & Subject</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Credits</th>
                  <th className="px-5 py-3">Marks (Pass / Max)</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold rounded bg-accent-light px-2 py-0.5 text-accent">
                          {s.code}
                        </span>
                        <span className="font-semibold text-primary">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-medium">
                      {s.class_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {s.subject_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {s.credits ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {s.passing_marks} / {s.max_marks}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Edit subject"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive-light hover:text-destructive-text transition-colors"
                          title="Delete subject"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Subject Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">Edit Subject ({editing.code})</h2>
                <p className="text-xs text-muted-foreground">{editing.class_name}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className={labelClass}>Subject Name</label>
                <input
                  required
                  className={inputClass}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className={labelClass}>Type</label>
                <select
                  className={inputClass}
                  value={editForm.subject_type}
                  onChange={(e) => setEditForm({ ...editForm, subject_type: e.target.value })}
                >
                  <option value="THEORY">Theory</option>
                  <option value="PRACTICAL">Practical</option>
                  <option value="ELECTIVE">Elective</option>
                  <option value="PROJECT">Project</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Credits</label>
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={editForm.credits}
                    onChange={(e) => setEditForm({ ...editForm, credits: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Max Marks</label>
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={editForm.max_marks}
                    onChange={(e) => setEditForm({ ...editForm, max_marks: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Passing Marks</label>
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={editForm.passing_marks}
                    onChange={(e) => setEditForm({ ...editForm, passing_marks: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-field border border-border px-4 text-xs font-semibold text-muted-foreground hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 rounded-field bg-accent px-5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
