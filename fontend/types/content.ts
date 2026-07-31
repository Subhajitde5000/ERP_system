/**
 * Content / Study Material contracts — role_based_shared_pages.md PAGE 8
 * (C-RB-08). Mirrors `content_items`, `content_tags` and
 * `content_access_logs` in database_design_complete.md §7.6.
 */

/** `content_type` enum (DB §7.6). */
export type ContentType =
  | "PDF"
  | "VIDEO"
  | "SLIDE"
  | "LINK"
  | "IMAGE"
  | "AUDIO"
  | "ZIP";

/** PAGE 8: upload vs. browse, plus the oversight variants. */
export type ContentViewKind =
  | "MANAGE" // Teacher — own uploads, upload/edit/hide/delete
  | "DEPARTMENT" // HOD — all dept content, flag inappropriate
  | "INSTITUTION" // Principal — all content, read-only
  | "BROWSE" // Student — own subjects, chapter → type
  | "CHILD" // Parent — child's subject content, read-only
  | "NONE";

export interface ContentPermissions {
  view: ContentViewKind;
  /** Upload new material */
  canUpload: boolean;
  /** Edit metadata, reorder */
  canEdit: boolean;
  /** Toggle `is_visible` */
  canToggleVisibility: boolean;
  canDelete: boolean;
  /** HOD — flag inappropriate content (PAGE 8) */
  canFlag: boolean;
  /** Stream / read / download the file itself */
  canDownload: boolean;
  note: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  subjectCode: string;
  subjectName: string;
  className: string;
  departmentName: string;
  uploadedBy: string;
  contentType: ContentType;
  /** Present for LINK items instead of a file */
  externalUrl: string | null;
  fileSizeBytes: number | null;
  /** VIDEO / AUDIO only */
  durationSeconds: number | null;
  /** Chapter / unit label — the grouping key for the browse view */
  chapter: string;
  sortOrder: number;
  /** Hidden items stay listed for the owner, not for students */
  isVisible: boolean;
  downloadCount: number;
  viewCount: number;
  tags: string[];
  createdAt: string;
  /** Set by a HOD flag (PAGE 8) */
  isFlagged: boolean;
}

/** Chapter grouping used by the browse view: chapter → items. */
export interface ChapterGroup {
  chapter: string;
  items: ContentItem[];
}

/** Subject grouping for the student/parent browse tree: subject → chapters. */
export interface SubjectGroup {
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  itemCount: number;
  chapters: ChapterGroup[];
}
