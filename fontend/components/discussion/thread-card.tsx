import Link from "next/link";
import {
  ArrowBigUp,
  CheckCircle2,
  Eye,
  Lock,
  MessageSquare,
  Pin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { timeAgo } from "@/lib/notices";
import { SCOPE_LABELS } from "@/lib/discussion";
import type { DiscussionThread } from "@/types/discussion";

/**
 * Thread card — role_based_shared_pages.md PAGE 3 (`<ThreadCard>`).
 * Moderation controls live on the detail page; the card surfaces state only.
 */
export function ThreadCard({ thread }: { thread: DiscussionThread }) {
  return (
    <article
      className={cn(
        "rounded-card border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]",
        thread.isPinned && "border-t-2 border-t-accent",
      )}
    >
      <div className="flex gap-4">
        {/* Vote + reply gutter */}
        <div className="flex w-11 shrink-0 flex-col items-center gap-2">
          <div
            className={cn(
              "flex w-full flex-col items-center rounded-field border py-1.5",
              thread.hasUpvoted
                ? "border-accent-border bg-accent-light text-accent"
                : "border-border text-muted-foreground",
            )}
          >
            <ArrowBigUp
              className={cn("h-4 w-4", thread.hasUpvoted && "fill-current")}
              aria-hidden="true"
            />
            <span className="text-[12px] font-semibold tabular-nums">
              {thread.upvoteCount}
            </span>
          </div>
          <span className="sr-only">{thread.upvoteCount} upvotes</span>

          <div
            className={cn(
              "flex flex-col items-center text-[11px]",
              thread.isResolved ? "text-success" : "text-muted-foreground",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">{thread.replyCount}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Status badges */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {thread.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
                <Pin className="h-3 w-3" aria-hidden="true" />
                PINNED
              </span>
            )}
            {thread.isResolved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                RESOLVED
              </span>
            )}
            {thread.isLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" />
                LOCKED
              </span>
            )}
          </div>

          <h3 className="text-[15px] font-semibold leading-5 text-foreground">
            <Link
              href={`/discussion/${thread.id}`}
              className="rounded transition-colors hover:text-accent"
            >
              {thread.title}
            </Link>
          </h3>

          <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-[#475569]">
            {thread.body}
          </p>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-[#475569]">
              {SCOPE_LABELS[thread.scopeType]}: {thread.scopeName}
            </span>

            {thread.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}

            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" aria-hidden="true" />
              {thread.viewCount}
            </span>
          </div>

          <p className="mt-2 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {thread.author.name}
            </span>{" "}
            <span className="rounded-full bg-muted px-1.5 py-px text-[10px]">
              {roleChip(thread.author.role)}
            </span>{" "}
            · {timeAgo(thread.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
