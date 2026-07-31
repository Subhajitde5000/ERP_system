"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  Check,
  Download,
  Paperclip,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { SCOPE_LABELS, fileSize, isExpired, timeAgo } from "@/lib/notices";
import { Card, ProgressBar } from "@/components/dashboard/primitives";
import type { Notice } from "@/types/notice";

/**
 * Notice detail — Notice_Board_design.md §6.
 * Full body, attachment downloads (signed URL), read receipts for the author
 * or an admin, and a "Mark as read" action for everyone else.
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

/** Demo receipt rows — GET /api/v1/notices/:id/reads (§7). */
const RECENT_READS = [
  { name: "Aryan Mehta", role: "STUDENT", at: "12m ago" },
  { name: "Sneha Rao", role: "STUDENT", at: "48m ago" },
  { name: "Kavita Menon", role: "HOD", at: "1h ago" },
  { name: "Priya Sharma", role: "TEACHER", at: "2h ago" },
] as const;

export function NoticeDetail({
  notice,
  canModerate,
}: {
  notice: Notice;
  canModerate: boolean;
}) {
  const [read, setRead] = useState(notice.isRead);
  const [pinned, setPinned] = useState(notice.isPinned);

  const expired = isExpired(notice);
  const readPct = notice.audienceCount
    ? Math.round((notice.readCount / notice.audienceCount) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/notices"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Notice Board
      </Link>

      <Card
        className={cn(
          "p-6 lg:p-8",
          PRIORITY_EDGE[notice.priority],
          pinned && "border-t-2 border-t-accent",
        )}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white"
              aria-hidden="true"
            >
              {notice.author.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">
                {notice.author.name}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {roleChip(notice.author.role)} · {timeAgo(notice.publishedAt)}
              </p>
            </div>
          </div>

          {/* Moderation actions (§6) */}
          {canModerate && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                aria-pressed={pinned}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-field border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  pinned
                    ? "border-accent-border bg-accent-light text-accent"
                    : "border-border text-muted-foreground hover:border-accent hover:text-accent",
                )}
              >
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                {pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pinned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
              <Pin className="h-3 w-3" aria-hidden="true" />
              PINNED
            </span>
          )}
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
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-[#475569]">
            {SCOPE_LABELS[notice.targetScope]}
            {notice.targetName ? `: ${notice.targetName}` : ""}
          </span>
          {expired && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              EXPIRED
            </span>
          )}
        </div>

        {/* Full body — not clamped (§6) */}
        <h1 className="mt-4 font-display text-[20px] font-bold leading-tight text-foreground">
          {notice.title}
        </h1>
        <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#334155]">
          {notice.body}
        </p>

        {/* Attachments — signed URL, 15 min expiry (§8) */}
        {notice.attachments.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Attachments
            </h2>
            <ul className="space-y-2">
              {notice.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-field border border-border p-3"
                >
                  <Paperclip
                    className="h-4 w-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {a.fileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fileSize(a.fileSizeBytes)}
                    </p>
                  </div>
                  {/* TODO(Dev-B): GET /notices/:id/attachments/:attId/url */}
                  <button
                    type="button"
                    aria-label={`Download ${a.fileName}`}
                    className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mark as read — non-moderators (§6) */}
        {!canModerate && (
          <div className="mt-6 border-t border-border pt-5">
            <button
              type="button"
              onClick={() => setRead(true)}
              disabled={read}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-field px-4 text-[13px] font-semibold transition-colors",
                read
                  ? "cursor-default bg-success-light text-success"
                  : "bg-accent text-white shadow-accent hover:bg-accent-hover",
              )}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {read ? "Marked as read" : "Mark as read"}
            </button>
          </div>
        )}
      </Card>

      {/* Read receipts — author/admin only (§6) */}
      {canModerate && (
        <Card className="mt-4 p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Seen by {notice.readCount}/{notice.audienceCount}
            </h2>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light"
            >
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              Remind unread
            </button>
          </div>

          <ProgressBar value={notice.readCount} max={notice.audienceCount} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {readPct}% of the audience has opened this notice
          </p>

          <ul className="mt-4 divide-y divide-border border-t border-border">
            {RECENT_READS.map((r) => (
              <li key={r.name} className="flex items-center gap-3 py-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {r.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                  {r.name}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {roleChip(r.role)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {r.at}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
