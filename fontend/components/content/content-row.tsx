"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  Flag,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fileSize, timeAgo } from "@/lib/notices";
import {
  CONTENT_TYPE_ICON,
  CONTENT_TYPE_TONE,
  actionLabel,
  formatDuration,
} from "@/lib/content";
import { TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import type { ContentItem, ContentPermissions } from "@/types/content";

/**
 * Content row — shared by every PAGE 8 view.
 *
 * Actions come from `perms`: the teacher gets edit/hide/delete, the HOD gets
 * flag, everyone else gets the open/download action. One row, five roles.
 */
export function ContentRow({
  item,
  perms,
  /** Show uploader + department — HOD and institution views */
  showOwner = false,
  onAction,
}: {
  item: ContentItem;
  perms: ContentPermissions;
  showOwner?: boolean;
  onAction: (message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(!item.isVisible);
  const [flagged, setFlagged] = useState(item.isFlagged);

  // Escape closes the row menu — without this the invisible click-catcher
  // stays over the page and swallows every subsequent click.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const Icon = CONTENT_TYPE_ICON[item.contentType];
  const tone = CONTENT_TYPE_TONE[item.contentType];
  const duration = formatDuration(item.durationSeconds);
  const hasMenu = perms.canEdit || perms.canToggleVisibility || perms.canDelete;

  return (
    <li
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-3 py-3",
        hidden && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-field",
          TONE_BG[tone],
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">
            {item.title}
          </span>
          {hidden && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
              HIDDEN
            </span>
          )}
          {flagged && (
            <span className="shrink-0 rounded-full bg-destructive-light px-1.5 py-px text-[10px] font-semibold text-destructive">
              FLAGGED
            </span>
          )}
        </p>

        <p className="truncate text-[11px] text-muted-foreground">
          {item.contentType}
          {item.fileSizeBytes !== null && ` · ${fileSize(item.fileSizeBytes)}`}
          {duration && ` · ${duration}`}
          {showOwner && ` · ${item.uploadedBy}`}
          {` · ${timeAgo(item.createdAt)}`}
        </p>
      </div>

      {/* Usage counts — meaningful to the uploader and to oversight roles */}
      {showOwner || perms.canEdit ? (
        <span className="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" aria-hidden="true" />
            {item.viewCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            {item.downloadCount}
          </span>
        </span>
      ) : null}

      {/* Primary action — signed URL, 15 min (dev doc §11.3) */}
      {perms.canDownload && (
        <button
          type="button"
          onClick={() =>
            onAction(
              "Content API not connected yet — see lib/content-data.ts (Dev-B, §11).",
            )
          }
          className="shrink-0 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
        >
          {actionLabel(item.contentType)}
        </button>
      )}

      {/* HOD — flag inappropriate content (PAGE 8) */}
      {perms.canFlag && (
        <button
          type="button"
          onClick={() => {
            setFlagged((v) => !v);
            onAction(
              flagged
                ? "Flag cleared — POST /content/items/:id/flag (Dev-B)."
                : "Content flagged for review — POST /content/items/:id/flag (Dev-B).",
            );
          }}
          aria-pressed={flagged}
          aria-label={flagged ? "Clear flag" : "Flag as inappropriate"}
          className={cn(
            "shrink-0 rounded-field border p-1.5 transition-colors",
            flagged
              ? "border-destructive bg-destructive-light text-destructive"
              : "border-border text-muted-foreground hover:border-destructive hover:text-destructive",
          )}
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Owner menu — edit, hide/unhide, delete */}
      {hasMenu && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={`Actions for ${item.title}`}
            className="rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-field border border-border bg-white py-1 shadow-card">
                {perms.canEdit && (
                  <MenuItem
                    icon={Pencil}
                    label="Edit metadata"
                    onClick={() => {
                      setMenuOpen(false);
                      onAction("PATCH /content/items/:id — Dev-B.");
                    }}
                  />
                )}
                {perms.canToggleVisibility && (
                  <MenuItem
                    icon={hidden ? Eye : EyeOff}
                    label={hidden ? "Unhide" : "Hide from students"}
                    onClick={() => {
                      setHidden((v) => !v);
                      setMenuOpen(false);
                      onAction(
                        "PATCH /content/items/:id/visibility — Dev-B.",
                      );
                    }}
                  />
                )}
                {perms.canDelete && (
                  <MenuItem
                    icon={Trash2}
                    label="Delete"
                    destructive
                    onClick={() => {
                      setMenuOpen(false);
                      onAction("DELETE /content/items/:id (soft) — Dev-B.");
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function MenuItem({
  icon: Icon,
  label,
  destructive = false,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive-light"
          : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}
