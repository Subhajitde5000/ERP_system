"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { ContentLibrary } from "./content-library";
import { UploadDialog } from "./upload-dialog";
import { FormAlert } from "@/components/auth/form-alert";
import type { ChildOption } from "@/types/attendance";
import type { ContentItem, ContentPermissions } from "@/types/content";

/**
 * Content page body — PAGE 8.
 *
 * Owns the two pieces of client state the library itself doesn't need: the
 * upload dialog (Teacher) and the child switcher (Parent). Everything else is
 * the shared library.
 */
export function ContentView({
  items,
  perms,
  showOwner = false,
  emptyHint,
  childOptions,
}: {
  items: ContentItem[];
  perms: ContentPermissions;
  showOwner?: boolean;
  emptyHint: string;
  /** Parent only — renders the child switcher above the library */
  childOptions?: ChildOption[];
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState(
    childOptions?.[0]?.id ?? "",
  );

  return (
    <div className="grid min-w-0 gap-4">
      {status && <FormAlert variant="info">{status}</FormAlert>}

      {perms.canUpload && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setUploading(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-field bg-accent px-4 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Upload material
          </button>
        </div>
      )}

      {childOptions && childOptions.length > 1 && (
        <div
          role="group"
          aria-label="Select child"
          className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
        >
          {childOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChildId(c.id)}
              aria-pressed={c.id === activeChildId}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition",
                c.id === activeChildId
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:border-accent",
              )}
            >
              {c.name}
              <span className="ml-1.5 opacity-70">{c.className}</span>
            </button>
          ))}
        </div>
      )}

      <ContentLibrary
        items={items}
        perms={perms}
        showOwner={showOwner}
        emptyHint={emptyHint}
      />

      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onUploaded={setStatus}
        />
      )}
    </div>
  );
}
