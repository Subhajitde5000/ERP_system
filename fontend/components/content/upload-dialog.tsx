"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fileSize } from "@/lib/notices";
import { CONTENT_UPLOAD } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-alert";

/**
 * Upload dialog — PAGE 8 (Teacher).
 * Follows the presign flow in dev doc §11.1: presign → PUT direct to S3 →
 * POST the record with the returned fileKey.
 */
export function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isLink, setIsLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    source?: string;
    chapter?: string;
  }>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const chapterRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function pickFile(list: FileList | null) {
    const chosen = list?.[0];
    if (!chosen) return;
    if (chosen.size > CONTENT_UPLOAD.maxBytes) {
      setError(`"${chosen.name}" exceeds the 200 MB limit.`);
      return;
    }
    setError(null);
    setFile(chosen);
    setFieldErrors((p) => ({ ...p, source: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const title = titleRef.current?.value.trim() ?? "";
    const chapter = chapterRef.current?.value.trim() ?? "";
    const url = urlRef.current?.value.trim() ?? "";

    const errors: typeof fieldErrors = {};
    if (!title) errors.title = "Enter a title";
    if (!chapter) errors.chapter = "Enter a chapter or unit";
    if (isLink ? !url : !file)
      errors.source = isLink ? "Enter a URL" : "Choose a file";

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      titleRef.current?.focus();
      return;
    }

    setBusy(true);
    // TODO(Dev-B): POST /storage/presign → PUT to S3 → POST /content/items
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    onClose();
    onUploaded(
      "Upload API not connected yet — see lib/content-data.ts (Dev-B, §11.1).",
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-heading"
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
              id="upload-heading"
              className="font-display text-[18px] font-bold text-foreground"
            >
              Upload material
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Files go straight to secure storage — students get time-limited
              links.
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
              htmlFor="content-title"
              className="text-[13px] font-medium text-[#334155]"
            >
              Title
            </label>
            <input
              id="content-title"
              ref={titleRef}
              type="text"
              placeholder="e.g., AVL Tree Rotations — annotated notes"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="content-subject"
                className="text-[13px] font-medium text-[#334155]"
              >
                Subject
              </label>
              <select
                id="content-subject"
                className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3 text-[14px] transition focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              >
                <option>CS301 · Algorithms</option>
                <option>CS305 · Databases</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="content-chapter"
                className="text-[13px] font-medium text-[#334155]"
              >
                Chapter / unit
              </label>
              <input
                id="content-chapter"
                ref={chapterRef}
                type="text"
                placeholder="Unit 3 — Balanced Trees"
                aria-invalid={fieldErrors.chapter ? true : undefined}
                onChange={() =>
                  setFieldErrors((p) => ({ ...p, chapter: undefined }))
                }
                className={cn(
                  "mt-1.5 h-11 w-full rounded-field border bg-white px-3.5 text-[14px] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-3",
                  fieldErrors.chapter
                    ? "border-destructive focus:border-destructive focus:ring-destructive/15"
                    : "border-border focus:border-accent focus:ring-accent/15",
                )}
              />
              {fieldErrors.chapter && (
                <p className="mt-1.5 text-[12px] font-medium text-destructive">
                  {fieldErrors.chapter}
                </p>
              )}
            </div>
          </div>

          {/* File or external link */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#334155]">
                Source
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isLink}
                  onChange={(e) => {
                    setIsLink(e.target.checked);
                    setFieldErrors((p) => ({ ...p, source: undefined }));
                  }}
                  className="h-3.5 w-3.5 rounded border-[#CBD5E1] accent-accent"
                />
                External link instead
              </label>
            </div>

            {isLink ? (
              <input
                ref={urlRef}
                type="url"
                placeholder="https://…"
                aria-label="External URL"
                onChange={() =>
                  setFieldErrors((p) => ({ ...p, source: undefined }))
                }
                className="mt-1.5 h-11 w-full rounded-field border border-border bg-white px-3.5 text-[14px] transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 flex w-full flex-col items-center rounded-field border border-dashed border-[#CBD5E1] bg-background p-5 text-center transition hover:border-accent hover:bg-accent-light"
                >
                  <Upload
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="mt-1.5 text-[13px] text-muted-foreground">
                    Click to choose a file
                  </span>
                  <span className="mt-0.5 text-[11px] text-[#94A3B8]">
                    PDF, slides, video, audio, ZIP · up to 200 MB
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={CONTENT_UPLOAD.accept}
                  onChange={(e) => {
                    pickFile(e.target.files);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />

                {file && (
                  <p className="mt-2 flex items-center gap-2 rounded-field border border-border px-3 py-2">
                    <Paperclip
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      aria-label="Remove file"
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </p>
                )}
              </>
            )}

            {fieldErrors.source && (
              <p className="mt-1.5 text-[12px] font-medium text-destructive">
                {fieldErrors.source}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-4">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[#CBD5E1] accent-accent"
            />
            <span className="text-[13px] text-[#475569]">
              Visible to students immediately
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-field border border-border px-5 text-[14px] font-semibold text-[#475569] transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={busy}
              loadingText="Uploading…"
              className="sm:w-36"
            >
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
