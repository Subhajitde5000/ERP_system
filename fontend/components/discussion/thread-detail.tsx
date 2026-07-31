"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigUp,
  ArrowLeft,
  CheckCircle2,
  Lock,
  LockOpen,
  Pin,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { roleChip } from "@/lib/roles";
import { timeAgo } from "@/lib/notices";
import { SCOPE_LABELS } from "@/lib/discussion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/dashboard/primitives";
import type { DiscussionThread } from "@/types/discussion";

/**
 * Thread detail — PAGE 3.
 * Moderation bar (pin / lock / delete) and `<AcceptAnswerButton>` appear only
 * for roles whose reach covers this thread — resolved server-side and passed
 * in, so the client never re-derives permissions.
 */
export function ThreadDetail({
  thread,
  canModerate,
  canAcceptAnswer,
  canReply,
}: {
  thread: DiscussionThread;
  canModerate: boolean;
  canAcceptAnswer: boolean;
  canReply: boolean;
}) {
  const [pinned, setPinned] = useState(thread.isPinned);
  const [locked, setLocked] = useState(thread.isLocked);
  const [accepted, setAccepted] = useState(
    thread.replies.find((r) => r.isAcceptedAnswer)?.id ?? null,
  );
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);

  const toggleVote = (id: string) =>
    setVotes((v) => ({ ...v, [id]: !v[id] }));

  // Accepted answer floats to the top (PAGE 3)
  const replies = [...thread.replies].sort((a, b) => {
    const aAcc = a.id === accepted ? 1 : 0;
    const bAcc = b.id === accepted ? 1 : 0;
    if (aAcc !== bAcc) return bAcc - aAcc;
    return +new Date(a.createdAt) - +new Date(b.createdAt);
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/discussion"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Discussion
      </Link>

      {/* Thread */}
      <Card className={cn("p-6 lg:p-8", pinned && "border-t-2 border-t-accent")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {pinned && (
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
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" />
                LOCKED
              </span>
            )}
          </div>

          {/* Moderation bar */}
          {canModerate && (
            <div className="flex flex-wrap gap-1.5">
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
                onClick={() => setLocked((v) => !v)}
                aria-pressed={locked}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-field border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  locked
                    ? "border-accent-border bg-accent-light text-accent"
                    : "border-border text-muted-foreground hover:border-accent hover:text-accent",
                )}
              >
                {locked ? (
                  <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {locked ? "Unlock" : "Lock"}
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

        <h1 className="mt-3 font-display text-[20px] font-bold leading-tight text-foreground">
          {thread.title}
        </h1>

        <div className="mt-3 flex gap-4">
          <button
            type="button"
            onClick={() => toggleVote(thread.id)}
            aria-pressed={votes[thread.id] ?? thread.hasUpvoted}
            aria-label={`Upvote thread (${thread.upvoteCount + ((votes[thread.id] ?? thread.hasUpvoted) ? 1 : 0)})`}
            className={cn(
              "flex h-fit w-11 shrink-0 flex-col items-center rounded-field border py-1.5 transition-colors",
              (votes[thread.id] ?? thread.hasUpvoted)
                ? "border-accent-border bg-accent-light text-accent"
                : "border-border text-muted-foreground hover:border-accent hover:text-accent",
            )}
          >
            <ArrowBigUp
              className={cn(
                "h-4 w-4",
                (votes[thread.id] ?? thread.hasUpvoted) && "fill-current",
              )}
              aria-hidden="true"
            />
            <span className="text-[12px] font-semibold tabular-nums">
              {thread.upvoteCount +
                ((votes[thread.id] ?? thread.hasUpvoted) ? 1 : 0)}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-line text-[14px] leading-7 text-[#334155]">
              {thread.body}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
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
            </div>

            <p className="mt-3 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {thread.author.name}
              </span>{" "}
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px]">
                {roleChip(thread.author.role)}
              </span>{" "}
              · {timeAgo(thread.createdAt)} · {thread.viewCount} views
            </p>
          </div>
        </div>
      </Card>

      {/* Replies */}
      <h2 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
      </h2>

      {replies.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            No replies yet — be the first to answer.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {replies.map((reply) => {
            const isAccepted = reply.id === accepted;
            const upvoted = votes[reply.id] ?? reply.hasUpvoted;

            return (
              <li key={reply.id}>
                <Card
                  className={cn(
                    "p-5",
                    isAccepted && "border-success bg-success-light/40",
                  )}
                >
                  {isAccepted && (
                    <p className="mb-2.5 inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-success-light px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ACCEPTED ANSWER
                    </p>
                  )}

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => toggleVote(reply.id)}
                      aria-pressed={upvoted}
                      aria-label={`Upvote reply by ${reply.author.name}`}
                      className={cn(
                        "flex h-fit w-11 shrink-0 flex-col items-center rounded-field border py-1.5 transition-colors",
                        upvoted
                          ? "border-accent-border bg-accent-light text-accent"
                          : "border-border text-muted-foreground hover:border-accent hover:text-accent",
                      )}
                    >
                      <ArrowBigUp
                        className={cn("h-4 w-4", upvoted && "fill-current")}
                        aria-hidden="true"
                      />
                      <span className="text-[12px] font-semibold tabular-nums">
                        {reply.upvoteCount + (upvoted ? 1 : 0)}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-line text-[13px] leading-6 text-[#334155]">
                        {reply.body}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12px] text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {reply.author.name}
                          </span>{" "}
                          <span className="rounded-full bg-muted px-1.5 py-px text-[10px]">
                            {roleChip(reply.author.role)}
                          </span>{" "}
                          · {timeAgo(reply.createdAt)}
                        </p>

                        {/* AcceptAnswerButton — teacher, own subject (PAGE 3) */}
                        {canAcceptAnswer && (
                          <button
                            type="button"
                            onClick={() =>
                              setAccepted(isAccepted ? null : reply.id)
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-field border px-2.5 py-1 text-[12px] font-medium transition-colors",
                              isAccepted
                                ? "border-success bg-success-light text-success"
                                : "border-border text-muted-foreground hover:border-success hover:text-success",
                            )}
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {isAccepted ? "Accepted" : "Accept answer"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Reply composer */}
      {locked ? (
        <Card className="mt-4 flex items-center gap-2.5 p-5">
          <Lock
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-[13px] text-muted-foreground">
            This thread is locked. No further replies can be posted.
          </p>
        </Card>
      ) : (
        canReply && (
          <Card className="mt-4 p-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPosting(true);
                // TODO(Dev-B): POST /api/v1/discussion/threads/:id/replies
                await new Promise((r) => setTimeout(r, 700));
                setPosting(false);
              }}
            >
              <label
                htmlFor="reply-body"
                className="text-[13px] font-medium text-[#334155]"
              >
                Your reply
              </label>
              <textarea
                id="reply-body"
                rows={3}
                placeholder="Write a reply…"
                className="mt-1.5 min-h-[84px] w-full rounded-field border border-border bg-white px-3.5 py-2.5 text-[14px] leading-6 transition placeholder:text-[#94A3B8] focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  type="submit"
                  loading={posting}
                  loadingText="Posting…"
                  className="sm:w-32"
                >
                  Reply
                </Button>
              </div>
            </form>
          </Card>
        )
      )}
    </div>
  );
}
