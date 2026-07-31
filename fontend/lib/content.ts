import {
  FileArchive,
  FileImage,
  FileText,
  Link2,
  Music,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react";

import type { InstitutionRole } from "@/types/auth";
import type {
  ContentItem,
  ContentPermissions,
  ContentType,
  ContentViewKind,
  SubjectGroup,
} from "@/types/content";
import type { Tone } from "@/types/dashboard";

/**
 * Content role logic — role_based_shared_pages.md PAGE 8.
 *
 * Same view-kind pattern as attendance / examination / assignments: the role
 * decides whether you upload, browse or oversee, resolved server-side.
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, ContentPermissions> = {
  // Teacher — own uploads; upload, edit metadata, hide/unhide, delete
  TEACHER: manageView(),
  // Mentor is teacher-level with the same rights over own subjects
  MENTOR: manageView(),

  // HOD — all dept content across teachers; view only + flag inappropriate
  HOD: {
    view: "DEPARTMENT",
    canUpload: false,
    canEdit: false,
    canToggleVisibility: false,
    canDelete: false,
    canFlag: true,
    canDownload: true,
    note: "All study material in your department, across teachers.",
  },

  // Principal (+ VP / Admin) — all content institution-wide, read-only
  PRINCIPAL: institutionView(),
  VICE_PRINCIPAL: institutionView(),
  INSTITUTION_ADMIN: institutionView(),

  // Student — browse own subjects: chapter → type
  STUDENT: {
    view: "BROWSE",
    canUpload: false,
    canEdit: false,
    canToggleVisibility: false,
    canDelete: false,
    canFlag: false,
    canDownload: true,
    note: "Study material for your subjects, organised by chapter.",
  },

  // Parent — child's subject content, read-only browse
  PARENT: {
    view: "CHILD",
    canUpload: false,
    canEdit: false,
    canToggleVisibility: false,
    canDelete: false,
    canFlag: false,
    canDownload: true,
    note: "Study material for your child's subjects.",
  },

  // Not part of these roles (§6)
  EXAM_CONTROLLER: noAccess(),
  ACADEMIC_COORDINATOR: noAccess(),
  ACCOUNTANT: noAccess(),
  LIBRARIAN: noAccess(),
  HOSTEL_WARDEN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

function manageView(): ContentPermissions {
  return {
    view: "MANAGE",
    canUpload: true,
    canEdit: true,
    canToggleVisibility: true,
    canDelete: true,
    canFlag: false,
    canDownload: true,
    note: "Material you've uploaded, organised by subject and chapter.",
  };
}

function institutionView(): ContentPermissions {
  return {
    view: "INSTITUTION",
    canUpload: false,
    canEdit: false,
    canToggleVisibility: false,
    canDelete: false,
    canFlag: false,
    canDownload: true,
    note: "All study material across the institution.",
  };
}

function noAccess(): ContentPermissions {
  return {
    view: "NONE",
    canUpload: false,
    canEdit: false,
    canToggleVisibility: false,
    canDelete: false,
    canFlag: false,
    canDownload: false,
    note: "Study material isn't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: ContentViewKind[] = [
  "NONE",
  "CHILD",
  "BROWSE",
  "DEPARTMENT",
  "INSTITUTION",
  "MANAGE",
];

export function contentPermissions(
  roles: InstitutionRole[],
): ContentPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<ContentPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canUpload: acc.canUpload || next.canUpload,
      canEdit: acc.canEdit || next.canEdit,
      canToggleVisibility: acc.canToggleVisibility || next.canToggleVisibility,
      canDelete: acc.canDelete || next.canDelete,
      canFlag: acc.canFlag || next.canFlag,
      canDownload: acc.canDownload || next.canDownload,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const CONTENT_TYPE_ICON: Record<ContentType, LucideIcon> = {
  PDF: FileText,
  VIDEO: Video,
  SLIDE: Presentation,
  LINK: Link2,
  IMAGE: FileImage,
  AUDIO: Music,
  ZIP: FileArchive,
};

export const CONTENT_TYPE_TONE: Record<ContentType, Tone> = {
  PDF: "danger",
  VIDEO: "accent",
  SLIDE: "warning",
  LINK: "cyan",
  IMAGE: "success",
  AUDIO: "cyan",
  ZIP: "muted",
};

/** Verb on the primary action, per type (PAGE 8: view / stream / read). */
export function actionLabel(type: ContentType): string {
  if (type === "VIDEO") return "Watch";
  if (type === "AUDIO") return "Listen";
  if (type === "LINK") return "Open";
  if (type === "PDF") return "Read";
  return "View";
}

/** "12:45" from seconds — video/audio duration. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Group flat items into subject → chapter, preserving `sort_order`
 * within each chapter (DB §7.6).
 */
export function groupBySubject(items: ContentItem[]): SubjectGroup[] {
  const subjects = new Map<string, SubjectGroup>();

  for (const item of items) {
    let subject = subjects.get(item.subjectCode);
    if (!subject) {
      subject = {
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        teacherName: item.uploadedBy,
        itemCount: 0,
        chapters: [],
      };
      subjects.set(item.subjectCode, subject);
    }

    subject.itemCount += 1;

    let chapter = subject.chapters.find((c) => c.chapter === item.chapter);
    if (!chapter) {
      chapter = { chapter: item.chapter, items: [] };
      subject.chapters.push(chapter);
    }
    chapter.items.push(item);
  }

  for (const subject of subjects.values()) {
    for (const chapter of subject.chapters) {
      chapter.items.sort((a, b) => a.sortOrder - b.sortOrder);
    }
  }

  return [...subjects.values()];
}

/** Upload constraints — mirrors the presign rules in dev doc §11. */
export const CONTENT_UPLOAD = {
  maxBytes: 200 * 1024 * 1024,
  accept: ".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mp3,.jpg,.jpeg,.png,.zip",
} as const;
