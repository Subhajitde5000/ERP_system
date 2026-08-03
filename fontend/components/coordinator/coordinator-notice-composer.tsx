"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, Save, X } from "lucide-react";

import { Card, PageHeader } from "@/components/admin/ui";
import { useResource } from "@/hooks/use-resource";
import {
  createCoordinatorNotice,
  fetchCoordinatorNoticeTargets,
  type CoordinatorNoticeCreate,
  type CoordinatorNoticePriority,
  type CoordinatorTargetOption,
} from "@/lib/coordinator-api";

/** C-AC-08 — compose a class-scoped academic notice. */
export function CoordinatorNoticeComposerPage() {
  const targets = useResource(fetchCoordinatorNoticeTargets, []);
  const [form, setForm] = useState<CoordinatorNoticeCreate>({
    title: "",
    body: "",
    target_scope: "CLASS",
    target_id: "",
    priority: "NORMAL",
    is_pinned: false,
    expires_at: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classes = useMemo(
    () => targets.data?.classes ?? [],
    [targets.data?.classes],
  );
  const firstClassId = classes[0]?.id ?? "";

  useEffect(() => {
    if (!form.target_id && firstClassId) {
      setForm((current) => ({ ...current, target_id: firstClassId }));
    }
  }, [firstClassId, form.target_id]);

  const selectableClasses = useMemo(
    () => classes.filter((c) => c.id),
    [classes],
  );

  async function save() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.body.trim()) {
      setError("Body is required.");
      return;
    }
    if (!form.target_id) {
      setError("Pick a class to receive the notice.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await createCoordinatorNotice(form);
      setSaved("Notice published. The class will see it on their dashboard.");
      setForm({
        title: "",
        body: "",
        target_scope: "CLASS",
        target_id: firstClassId,
        priority: "NORMAL",
        is_pinned: false,
        expires_at: null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish notice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/coordinator/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
      </Link>

      <PageHeader
        title="Post academic notice"
        subtitle="Class-scoped announcements from the academic office."
      />

      {error ? (
        <p className="rounded-field border border-destructive-border bg-destructive-light/30 px-3 py-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-field border border-success-border bg-success-light/30 px-3 py-2 text-sm text-success-text">
          {saved}
        </p>
      ) : null}

      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class" className="sm:col-span-2">
              <select
                value={form.target_id}
                onChange={(e) => setForm({ ...form, target_id: e.target.value })}
                className="h-11 rounded-field border border-border bg-white px-3 text-sm"
              >
                {selectableClasses.length === 0 ? (
                  <option value="">No classes yet</option>
                ) : null}
                {selectableClasses.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                    {klass.department_name ? ` · ${klass.department_name}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" className="sm:col-span-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-11 rounded-field border border-border bg-white px-3 text-sm"
                placeholder="e.g. Mid-term timetable revised"
              />
              <span className="text-[11px] text-muted-foreground">
                Saved notices are auto-prefixed “(Academic) ”.
              </span>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as CoordinatorNoticePriority })
                }
                className="h-11 rounded-field border border-border bg-white px-3 text-sm"
              >
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </select>
            </Field>
            <Field label="Expires (optional)">
              <input
                type="datetime-local"
                value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="h-11 rounded-field border border-border bg-white px-3 text-sm"
              />
            </Field>
            <Field label="Pin to the top of the class feed" className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                Pin until it expires
              </label>
            </Field>
            <Field label="Body" className="sm:col-span-2">
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={6}
                className="w-full rounded-field border border-border bg-white px-3 py-2 text-sm"
                placeholder="Share the change, the date and what students should do."
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link
              href="/coordinator/dashboard"
              className="inline-flex h-11 items-center rounded-field border border-border bg-white px-4 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              <X className="mr-1 h-4 w-4" aria-hidden /> Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-1.5 rounded-field bg-accent px-5 text-sm font-semibold text-white shadow-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              <Megaphone className="h-4 w-4" aria-hidden />{" "}
              {saving ? "Publishing…" : "Publish notice"}
            </button>
          </div>
        </form>
      </Card>

      <p className="text-[12px] text-muted-foreground">
        Need to edit the title or pull a notice down? Open{" "}
        <Link href="/notices" className="font-semibold text-accent hover:underline">
          the notice board
        </Link>{" "}
        to manage what you have already posted.
      </p>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// Re-export the form save button and target option for any future nested
// components without making the file a barrel.
export type { CoordinatorTargetOption, CoordinatorNoticeCreate };
// keep `Save` referenced so the icon import is used if the form grows.
void Save;
