import type { InstitutionRole } from "./auth";

/**
 * Notice Board contracts — Notice_Board_design.md §1, §3, §7
 * Mirrors the `notices` / `notice_attachments` / `notice_reads` tables
 * in database_design_complete.md §7.4.
 */

/**
 * `notice_scope` enum (DB §7.4) plus the two extensions the design calls for:
 * PLACEMENT (§3, Placement Officer) and STAFF (§3, HR Manager "Staff Only").
 */
export type NoticeScope =
  | "INSTITUTION"
  | "DEPARTMENT"
  | "CLASS"
  | "HOSTEL"
  | "TRANSPORT"
  | "PLACEMENT"
  | "STAFF";

/** `notice_priority` enum (DB §7.4). */
export type NoticePriority = "NORMAL" | "IMPORTANT" | "URGENT";

export interface NoticeAttachment {
  id: string;
  fileName: string;
  /** S3 key — never exposed raw; downloads go through a signed URL (§8) */
  fileKey: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface NoticeAuthor {
  id: string;
  name: string;
  role: InstitutionRole;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  author: NoticeAuthor;
  targetScope: NoticeScope;
  /** dept_id / class_id / null for INSTITUTION */
  targetId: string | null;
  /** Human label for the scope chip, e.g. "CSE Dept" or "FY-A" */
  targetName: string | null;
  priority: NoticePriority;
  isPinned: boolean;
  publishedAt: string;
  /** null = never expires (§10) */
  expiresAt: string | null;
  attachments: NoticeAttachment[];
  /** Read receipts — authors and admins see the ratio (§6) */
  readCount: number;
  audienceCount: number;
  /** Whether the current viewer has read it (drives the unread dot, §3) */
  isRead: boolean;
}

/** A scope the current role is allowed to post to, with its selectable targets. */
export interface PostScopeOption {
  scope: NoticeScope;
  label: string;
  /** Selectable targets; empty for INSTITUTION (target_id = null) */
  targets: { id: string; name: string }[];
  /** Rendered but not selectable, with a reason (e.g. VP + institution-wide) */
  disabledReason?: string;
  /** Target is fixed and cannot be changed (HOD → own dept) */
  locked?: boolean;
}

/** Everything the UI needs to know about a role's notice permissions (§3). */
export interface NoticePermissions {
  canPost: boolean;
  /** Scope options for the composer, in display order */
  postScopes: PostScopeOption[];
  /** Scopes whose notices this role can see in the feed */
  visibleScopes: NoticeScope[];
  /** Author/admin-only: read receipts, pin, delete on any notice */
  canModerate: boolean;
  /** Default priority for the composer (Exam Controller → IMPORTANT) */
  defaultPriority: NoticePriority;
  /** Auto-prefix applied to the title (Academic Coordinator) */
  titlePrefix?: string;
  /** Auto-applied tag chip (Exam Controller → "EXAM") */
  autoTag?: string;
  /** HR Manager gets a "Staff only" toggle */
  staffToggle?: boolean;
  /** Shown in the view-only banner / composer helper text */
  note?: string;
}
