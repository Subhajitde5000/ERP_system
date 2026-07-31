import type { InstitutionRole } from "./auth";

/**
 * Discussion Forum contracts — role_based_shared_pages.md PAGE 3.
 * Mirrors `discussion_threads` / `discussion_replies` / `discussion_votes`
 * in database_design_complete.md §7.5.
 */

/** `scope_type` (DB §7.5). */
export type ThreadScope = "CLASS" | "SUBJECT" | "DEPARTMENT";

export interface ThreadAuthor {
  id: string;
  name: string;
  role: InstitutionRole;
}

export interface DiscussionReply {
  id: string;
  body: string;
  author: ThreadAuthor;
  /** Teacher marks the solution (PAGE 3 — AcceptAnswerButton) */
  isAcceptedAnswer: boolean;
  upvoteCount: number;
  /** Whether the current viewer has upvoted */
  hasUpvoted: boolean;
  createdAt: string;
}

export interface DiscussionThread {
  id: string;
  title: string;
  body: string;
  author: ThreadAuthor;
  scopeType: ThreadScope;
  scopeId: string;
  /** Human label for the scope chip, e.g. "CS301" or "FY-A" */
  scopeName: string;
  tags: string[];
  isPinned: boolean;
  /** Locked threads accept no further replies (DB §7.5) */
  isLocked: boolean;
  isResolved: boolean;
  replyCount: number;
  upvoteCount: number;
  viewCount: number;
  hasUpvoted: boolean;
  createdAt: string;
  replies: DiscussionReply[];
}

/**
 * What a role may do in the forum — PAGE 3 matrix.
 *
 * `moderates` is deliberately granular: HOD moderates the whole department,
 * a Teacher only their own subject, a Mentor only their mentee group. Encoding
 * it as a predicate input rather than a boolean keeps that nuance.
 */
export type ModerationReach =
  | "NONE"
  | "ALL" // Principal / VP / Institution Admin
  | "DEPARTMENT" // HOD — any thread in own dept
  | "OWN_SUBJECT" // Teacher — own subject threads
  | "OWN_GROUP" // Mentor — mentee group threads
  | "EXAM"; // Exam Controller — exam-tagged threads

export interface DiscussionPermissions {
  /** Can open a new thread */
  canPost: boolean;
  /** Scopes whose threads are visible in the feed */
  visibleScopes: ThreadScope[];
  /** Restricts the feed to threads carrying this tag (Exam Controller) */
  tagFilter?: string;
  /** How far this role's pin/lock/delete rights extend */
  moderation: ModerationReach;
  /** Can mark a reply as the accepted answer (teachers, in own subject) */
  canAcceptAnswer: boolean;
  /** Scope options offered by the composer */
  postScopes: {
    scope: ThreadScope;
    label: string;
    targets: { id: string; name: string }[];
  }[];
  /** Shown in the view-only / limited-access banner */
  note?: string;
}
