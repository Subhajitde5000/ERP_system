import Link from "next/link";
import { Eye, Paperclip, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { SCOPE_LABELS, fileSize, isExpired, timeAgo } from "@/lib/notices";
import type { Notice } from "@/types/notice";
import { ProgressBar } from "@/components/dashboard/primitives";

/**
 * Notice card — Notice_Board_design.md §4.
 *
 * URGENT    → left border 4px #EF4444 + red badge
 * IMPORTANT → left border 4px #F59E0B + amber badge
 * PINNED    → top border 2px #4F46E5 + indigo chip
 */

const PRIORITY_BADGE = {
  URGENT: "bg-destructive-light text-[#DC2626] border-destructive-border",
  IMPORTANT: "bg-warning-light text-[#D97706] border-[#FDE68A]",
  NORMAL: "",
} as const;

const PRIORITY_EDGE = {
  URGENT: "border-l-4 border-l-destructive",
  IMPORTANT: "border-l-4 border-l-warning",
  NORMAL: "",
} as const;

export function NoticeCard({
  notice,
  /** Author or admin — reveals read receipts and moderation actions (§4, §6) */
  canModerate = false,
}: {
  notice: Notice;
  canModerate?: boolean;
}) {
  const expired = isExpired(notice);
  const readPct = notice.audienceCount
    ? Math.round((notice.readCount / notice.audienceCount) * 100)
    : 0;

  return (
    <article
      className={cn(
        "rounded-card border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]",
        PRIORITY_EDGE[notice.priority],
        notice.isPinned && "border-t-2 border-t-accent",
        expired && "opacity-60",
      )}
    >
      {notice.isPinned && (
        <p className="mb-3 inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
          <Pin className="h-3 w-3" aria-hidden="true" />
          PINNED
        </p>
      )}

      <div className="flex gap-3">
        {/* Author avatar — initial, matching the sidebar treatment */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-white"
          aria-hidden="true"
        >
          {notice.author.name.charAt(0)}
        </span>

        <div className="min-w-0 flex-1">
          {/* Author line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold text-foreground">
              {notice.author.name}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {roleChip(notice.author.role)}
            </span>
            <span className="text-[12px] text-[#94A3B8]">
              · {timeAgo(notice.publishedAt)}
            </span>

            {notice.priority !== "NORMAL" && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  PRIORITY_BADGE[notice.priority],
                )}
              >
                {notice.priority}
              </span>
            )}

            {expired && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                EXPIRED
              </span>
            )}

            {/* Unread dot (§3 — students/parents) */}
            {!notice.isRead && !expired && (
              <span
                className="h-2 w-2 rounded-full bg-accent"
                aria-label="Unread"
              />
            )}
          </div>

          {/* Title + body */}
          <h3 className="mt-2 text-[15px] font-semibold leading-5 text-foreground">
            <Link
              href={`/notices/${notice.id}`}
              className="rounded transition-colors hover:text-accent"
            >
              {notice.title}
            </Link>
          </h3>
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-6 text-[#475569]">
            {notice.body}
          </p>

          {/* Scope tag + attachment count */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-[#475569]">
              {SCOPE_LABELS[notice.targetScope]}
              {notice.targetName ? `: ${notice.targetName}` : ""}
            </span>

            {notice.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" aria-hidden="true" />
                {notice.attachments.length}{" "}
                {notice.attachments.length === 1 ? "file" : "files"}
                {notice.attachments.length === 1 &&
                  ` · ${fileSize(notice.attachments[0]!.fileSizeBytes)}`}
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {notice.readCount} read
            </span>
          </div>

          {/* Read receipt bar — author/admin only (§4) */}
          {canModerate && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Seen by {notice.readCount}/{notice.audienceCount}
                </span>
                <span className="text-[11px] font-semibold text-accent">
                  {readPct}%
                </span>
              </div>
              <ProgressBar value={notice.readCount} max={notice.audienceCount} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
