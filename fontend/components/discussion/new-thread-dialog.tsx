"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";
import type { DiscussionPermissions } from "@/types/discussion";

/**
 * New thread composer — PAGE 3 (`<NewThreadButton>`).
 *
 * Scope options come from the role's `postScopes`, so a Student can only open
 * a thread in their own class/subjects and a Mentor only in their group.
 * Rendered as a modal so the list keeps its filter and scroll position.
 */
export function NewThreadDialog({
  perms,
  onClose,
}: {
  perms: DiscussionPermissions;
  onClose: () => void;
}) {
  const [scopeIndex, setScopeIndex] = useState(0);
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    body?: string;
    target?: string;
  }>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const active = perms.postScopes[scopeIndex];

  // Focus the first field, and close on Escape
  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const title = titleRef.current?.value.trim() ?? "";
    const body = bodyRef.current?.value.trim() ?? "";

    const errors: typeof fieldErrors = {};
    if (!title) errors.title = "Enter a question or topic";
    if (!body) errors.body = "Add some detail";
    if ((active?.targets.length ?? 0) > 0 && !targetId)
      errors.target = "Choose where to post";

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      (errors.title ? titleRef : bodyRef).current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);

    // TODO(Dev-B): POST /api/v1/discussion/threads
    //   { title, body, scope_type, scope_id, tags }
    await new Promise((r) => setTimeout(r, 800));

    setSubmitting(false);
    setError(
      "Discussion API not connected yet — see lib/discussion-data.ts (Dev-B, C-RB-03).",
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-thread-heading"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-primary/50 backdrop-blur-sm"
      />

      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-white p-6 shadow-2xl sm:rounded-card">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2
              id="new-thread-heading"
              className="font-display text-[18px] font-bold text-foreground"
            >
              Start a thread
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Ask a question or start a discussion.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <FormAlert variant="error" className="mb-5">
            {error}
          </FormAlert>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="thread-title"
              className="text-[13px] font-medium text-[#334155]"
            >
              Title
            </label>
            <input
              id="thread-title"
              ref={titleRef}
              type="text"
              placeholder="e.g., Why does quicksort degrade on sorted input?"
              aria-invalid={fieldErrors.title ? true : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, title: undefined }))}
              className={cn(
                "mt-1.5 h-11 w-full rounded-field border bg-white px-3.5 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                fieldErrors.title
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-accent focus:ring-accent/15",
              )}
            />
            {fieldErrors.title && (
              <p className="mt-1.5 text-[12px] font-medium text-destructive">
                {fieldErrors.title}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="thread-body"
              className="text-[13px] font-medium text-[#334155]"
            >
              Details
            </label>
            <textarea
              id="thread-body"
              ref={bodyRef}
              rows={5}
              placeholder="Explain what you've tried and where you're stuck…"
              aria-invalid={fieldErrors.body ? true : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, body: undefined }))}
              className={cn(
                "mt-1.5 min-h-[110px] w-full rounded-field border bg-white px-3.5 py-2.5 text-[14px] leading-6 transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                fieldErrors.body
                  ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                  : "border-border focus:border-accent focus:ring-accent/15",
              )}
            />
            {fieldErrors.body && (
              <p className="mt-1.5 text-[12px] font-medium text-destructive">
                {fieldErrors.body}
              </p>
            )}
          </div>

          {/* Role-scoped target */}
          <div>
            <label
              htmlFor="thread-scope"
              className="text-[13px] font-medium text-[#334155]"
            >
              Post in
            </label>
            <select
              id="thread-scope"
              value={scopeIndex}
              onChange={(e) => {
                setScopeIndex(Number(e.target.value));
                setTargetId("");
              }}
              className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3 text-[14px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            >
              {perms.postScopes.map((s, i) => (
                <option key={`${s.scope}-${s.label}`} value={i}>
                  {s.label}
                </option>
              ))}
            </select>

            {(active?.targets.length ?? 0) > 0 && (
              <>
                <select
                  aria-label="Target"
                  value={targetId}
                  onChange={(e) => {
                    setTargetId(e.target.value);
                    setFieldErrors((p) => ({ ...p, target: undefined }));
                  }}
                  className={cn(
                    "mt-2 h-11 w-full rounded-field border bg-white px-3 text-[14px] transition focus:outline-none focus:ring-3",
                    fieldErrors.target
                      ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                      : "border-border focus:border-accent focus:ring-accent/15",
                  )}
                >
                  <option value="">Choose…</option>
                  {active!.targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.target && (
                  <p className="mt-1.5 text-[12px] font-medium text-destructive">
                    {fieldErrors.target}
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label
              htmlFor="thread-tags"
              className="text-[13px] font-medium text-[#334155]"
            >
              Tags{" "}
              <span className="font-normal text-muted-foreground">
                (optional, comma separated)
              </span>
            </label>
            <input
              id="thread-tags"
              type="text"
              placeholder="sorting, complexity"
              className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3.5 text-[14px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-field border border-border px-5 text-[14px] font-semibold text-[#475569] transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={submitting}
              loadingText="Posting…"
              className="sm:w-36"
            >
              Post Thread
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
