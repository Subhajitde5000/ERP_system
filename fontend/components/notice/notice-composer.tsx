"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Paperclip, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { UPLOAD, fileSize } from "@/lib/notices";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import type { NoticePermissions, NoticePriority } from "@/types/notice";

/**
 * Notice composer — Notice_Board_design.md §5.
 *
 * The scope selector is the important part: options come entirely from the
 * role's `postScopes`, so a Teacher only ever sees their own classes and a HOD
 * cannot switch departments. Disabled options keep their tooltip reason
 * (VP + institution-wide) rather than being hidden, per the spec.
 */

const PRIORITIES: { value: NoticePriority; label: string; hint: string }[] = [
  { value: "NORMAL", label: "Normal", hint: "No badge" },
  { value: "IMPORTANT", label: "Important", hint: "Amber badge" },
  { value: "URGENT", label: "Urgent", hint: "Red badge + email" },
];

export function NoticeComposer({ perms }: { perms: NoticePermissions }) {
  const router = useRouter();

  const [scopeIndex, setScopeIndex] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [priority, setPriority] = useState<NoticePriority>(perms.defaultPriority);
  const [pinned, setPinned] = useState(false);
  const [staffOnly, setStaffOnly] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    body?: string;
    target?: string;
  }>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () => perms.postScopes.filter((s) => !s.disabledReason),
    [perms.postScopes],
  );
  const active = perms.postScopes[scopeIndex] ?? selectable[0];
  const needsTarget = (active?.targets.length ?? 0) > 0;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= UPLOAD.maxFiles) {
        setError(`Maximum ${UPLOAD.maxFiles} files per notice.`);
        break;
      }
      if (f.size > UPLOAD.maxBytes) {
        setError(`"${f.name}" exceeds the 10 MB limit.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const title = titleRef.current?.value.trim() ?? "";
    const body = bodyRef.current?.value.trim() ?? "";

    const errors: typeof fieldErrors = {};
    if (!title) errors.title = "Enter a title";
    if (!body) errors.body = "Enter the notice body";
    if (needsTarget && !targetId) errors.target = "Choose a target";

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      (errors.title ? titleRef : bodyRef).current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);

    // TODO(Dev-B): presign + PUT each file to S3 (§8), then
    // POST /api/v1/notices { title, body, target_scope, target_id, priority,
    //                        is_pinned, expires_at, attachments: [{...}] }
    await new Promise((r) => setTimeout(r, 900));

    setSubmitting(false);
    setError(
      "Notice API not connected yet — see lib/notice-data.ts (Dev-B, B-44…B-49).",
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-[22px] font-bold text-foreground">
          Post a Notice
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {perms.note ?? "Choose who should receive this notice."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-card border border-border bg-white p-6 shadow-card lg:p-8"
      >
        {error && (
          <FormAlert variant="error" className="mb-5">
            {error}
          </FormAlert>
        )}

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label
              htmlFor="notice-title"
              className="text-[13px] font-medium text-[#334155]"
            >
              Title
            </label>
            {perms.titlePrefix && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Auto-prefixed with{" "}
                <span className="font-medium text-accent">
                  {perms.titlePrefix.trim()}
                </span>
              </p>
            )}
            <input
              id="notice-title"
              ref={titleRef}
              type="text"
              placeholder="e.g., Holiday on 15th Aug"
              aria-invalid={fieldErrors.title ? true : undefined}
              aria-describedby={fieldErrors.title ? "notice-title-error" : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, title: undefined }))}
              className={cn(
                "mt-1.5 h-11 w-full rounded-field border bg-white px-3.5 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                fieldErrors.title
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-accent focus:ring-accent/15",
              )}
            />
            {fieldErrors.title && (
              <p
                id="notice-title-error"
                className="mt-1.5 text-[12px] font-medium text-destructive"
              >
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="notice-body"
              className="text-[13px] font-medium text-[#334155]"
            >
              Body
            </label>
            <textarea
              id="notice-body"
              ref={bodyRef}
              rows={5}
              placeholder="Write the notice…"
              aria-invalid={fieldErrors.body ? true : undefined}
              aria-describedby={fieldErrors.body ? "notice-body-error" : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, body: undefined }))}
              className={cn(
                "mt-1.5 min-h-[120px] w-full rounded-field border bg-white px-3.5 py-2.5 text-[14px] leading-6 transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                fieldErrors.body
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-accent focus:ring-accent/15",
              )}
            />
            {fieldErrors.body && (
              <p
                id="notice-body-error"
                className="mt-1.5 text-[12px] font-medium text-destructive"
              >
                {fieldErrors.body}
              </p>
            )}
          </div>

          {/* Priority radio cards */}
          <fieldset>
            <legend className="text-[13px] font-medium text-[#334155]">
              Priority
            </legend>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PRIORITIES.map((p) => {
                const on = priority === p.value;
                return (
                  <label
                    key={p.value}
                    className={cn(
                      "cursor-pointer rounded-field border p-3 transition",
                      on
                        ? p.value === "URGENT"
                          ? "border-destructive bg-destructive-light ring-3 ring-destructive/15"
                          : p.value === "IMPORTANT"
                            ? "border-warning bg-warning-light ring-3 ring-warning/15"
                            : "border-accent bg-accent-light ring-3 ring-accent/15"
                        : "border-border hover:border-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p.value}
                      checked={on}
                      onChange={() => setPriority(p.value)}
                      className="sr-only"
                    />
                    <span className="block text-[13px] font-semibold text-foreground">
                      {p.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {p.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Role-aware target scope — the core logic (§5) */}
          <div>
            <label
              htmlFor="notice-scope"
              className="text-[13px] font-medium text-[#334155]"
            >
              Send to
            </label>
            <select
              id="notice-scope"
              value={scopeIndex}
              onChange={(e) => {
                setScopeIndex(Number(e.target.value));
                setTargetId("");
                setFieldErrors((p) => ({ ...p, target: undefined }));
              }}
              className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3 text-[14px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              {perms.postScopes.map((s, i) => (
                <option key={s.scope} value={i} disabled={!!s.disabledReason}>
                  {s.label}
                  {s.disabledReason ? " — not permitted" : ""}
                </option>
              ))}
            </select>

            {active?.disabledReason && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-warning">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {active.disabledReason}
              </p>
            )}

            {/* Target picker — locked when the role has a single fixed target */}
            {needsTarget && (
              <>
                <select
                  aria-label="Target"
                  value={active!.locked ? active!.targets[0]!.id : targetId}
                  disabled={active!.locked}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setFieldErrors((p) => ({ ...p, target: undefined }));
                  }}
                  className={cn(
                    "mt-2 h-11 w-full rounded-field border bg-white px-3 text-[14px] transition focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                    fieldErrors.target
                      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                      : "border-border focus:border-accent focus:ring-accent/15",
                  )}
                >
                  {!active!.locked && <option value="">Choose…</option>}
                  {active!.targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                {active!.locked && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                    Locked to your own scope.
                  </p>
                )}
                {fieldErrors.target && (
                  <p className="mt-1.5 text-[12px] font-medium text-destructive">
                    {fieldErrors.target}
                  </p>
                )}
              </>
            )}

            {perms.autoTag && (
              <p className="mt-2 inline-flex items-center rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
                {perms.autoTag} tag added automatically
              </p>
            )}
          </div>

          {/* Attachments — drag & drop (§5, §8) */}
          <div>
            <span className="text-[13px] font-medium text-[#334155]">
              Attachments
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "mt-1.5 rounded-field border border-dashed p-5 text-center transition",
                dragging
                  ? "border-accent bg-accent-light"
                  : "border-[#CBD5E1] bg-background",
              )}
            >
              <Upload
                className="mx-auto h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-2 text-[13px] text-muted-foreground">
                Drag files here or{" "}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded font-medium text-accent hover:text-accent-hover"
                >
                  browse
                </button>
              </p>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                PDF, DOC, JPG, PNG, ZIP · up to 10 MB · max {UPLOAD.maxFiles} files
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={UPLOAD.accept}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="sr-only"
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-field border border-border px-3 py-2"
                  >
                    <Paperclip
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {f.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fileSize(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2.5 border-t border-border pt-5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] accent-accent"
              />
              <span className="text-[13px] text-[#475569]">
                Pin this notice to the top
              </span>
            </label>

            {perms.staffToggle && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={staffOnly}
                  onChange={(e) => setStaffOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5E1] accent-accent"
                />
                <span className="text-[13px] text-[#475569]">
                  Staff only — exclude students and parents
                </span>
              </label>
            )}

            <div>
              <label
                htmlFor="notice-expiry"
                className="text-[13px] text-[#475569]"
              >
                Expires at{" "}
                <span className="text-muted-foreground">
                  (optional — blank never expires)
                </span>
              </label>
              <input
                id="notice-expiry"
                type="date"
                className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3.5 text-[14px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/notices"
            className="inline-flex h-11 items-center justify-center rounded-field border border-border px-5 text-[14px] font-semibold text-[#475569] transition-colors hover:bg-background"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            loading={submitting}
            loadingText="Posting…"
            className="sm:w-40"
          >
            Post Notice
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => router.back()}
        className="mt-4 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        ← Back
      </button>
    </div>
  );
}
