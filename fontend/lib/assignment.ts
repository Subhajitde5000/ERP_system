import type { InstitutionRole } from "@/types/auth";
import type {
  AssignmentPermissions,
  AssignmentStatus,
  AssignmentViewKind,
  SubmissionStatus,
} from "@/types/assignment";
import type { Tone } from "@/types/dashboard";

/**
 * Assignment role logic — role_based_shared_pages.md PAGE 7.
 *
 * Same view-kind pattern as attendance and examination: each role has a
 * different job, so the mapping resolves server-side and the page dispatches.
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, AssignmentPermissions> = {
  // Teacher — own assignments; create, edit, close, review submissions
  TEACHER: authorView(),
  // Mentor is teacher-level with the same authoring rights over own subjects
  MENTOR: authorView(),

  // HOD — dept assignments with pending-review count per teacher, read-only
  HOD: {
    view: "DEPARTMENT",
    canAuthor: false,
    canManage: false,
    canReview: false,
    canSubmit: false,
    canExport: true,
    canEditMilestones: false,
    // PAGE 22: "Overview of submissions, completion rate | View only"
    canSeeProgress: true,
    note: "All assignments in your department, with review load per teacher.",
  },

  // Principal / VP / Admin — institution-wide summary, read-only
  PRINCIPAL: institutionView(),
  VICE_PRINCIPAL: institutionView(),
  INSTITUTION_ADMIN: institutionView(),

  // Student — own pending/submitted/approved; submit, resubmit, read feedback
  STUDENT: {
    view: "SUBMIT",
    canAuthor: false,
    canManage: false,
    canReview: false,
    canSubmit: true,
    canExport: false,
    canEditMilestones: false,
    canSeeProgress: false,
    note: "Your assignments — submit work and read teacher feedback.",
  },

  // Parent — child's status, read-only
  PARENT: {
    view: "CHILD",
    canAuthor: false,
    canManage: false,
    canReview: false,
    canSubmit: false,
    canExport: false,
    canEditMilestones: false,
    canSeeProgress: false,
    note: "Your child's assignment status.",
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

function authorView(): AssignmentPermissions {
  return {
    view: "AUTHOR",
    canAuthor: true,
    canManage: true,
    canReview: true,
    canSubmit: false,
    canExport: false,
    canEditMilestones: true,
    canSeeProgress: true,
    note: "Assignments you've created, with submissions awaiting review.",
  };
}

function institutionView(): AssignmentPermissions {
  return {
    view: "INSTITUTION",
    canAuthor: false,
    canManage: false,
    canReview: false,
    canSubmit: false,
    canExport: true,
    canEditMilestones: false,
    // PAGE 22 names only Teacher / Student / HOD, but §6 gives the Principal
    // "● view" on assignments — the same read-only roll-up the HOD sees.
    canSeeProgress: true,
    note: "Institution-wide assignment activity by department.",
  };
}

function noAccess(): AssignmentPermissions {
  return {
    view: "NONE",
    canAuthor: false,
    canManage: false,
    canReview: false,
    canSubmit: false,
    canExport: false,
    canEditMilestones: false,
    canSeeProgress: false,
    note: "Assignments aren't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: AssignmentViewKind[] = [
  "NONE",
  "CHILD",
  "SUBMIT",
  "DEPARTMENT",
  "INSTITUTION",
  "AUTHOR",
];

export function assignmentPermissions(
  roles: InstitutionRole[],
): AssignmentPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<AssignmentPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canAuthor: acc.canAuthor || next.canAuthor,
      canManage: acc.canManage || next.canManage,
      canReview: acc.canReview || next.canReview,
      canSubmit: acc.canSubmit || next.canSubmit,
      canExport: acc.canExport || next.canExport,
      canEditMilestones: acc.canEditMilestones || next.canEditMilestones,
      canSeeProgress: acc.canSeeProgress || next.canSeeProgress,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Open",
  CLOSED: "Closed",
};

export const ASSIGNMENT_STATUS_TONE: Record<AssignmentStatus, Tone> = {
  DRAFT: "muted",
  PUBLISHED: "accent",
  CLOSED: "cyan",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: "Not submitted",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESUBMIT_REQUESTED: "Resubmit requested",
};

export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus, Tone> = {
  NOT_SUBMITTED: "muted",
  SUBMITTED: "accent",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  RESUBMIT_REQUESTED: "warning",
};

/**
 * The single lifecycle action available next (DB §7.3 `assignment_status`).
 * DRAFT → publish · PUBLISHED → close.
 */
export function nextAssignmentAction(
  status: AssignmentStatus,
  perms: AssignmentPermissions,
): { label: string; kind: "PUBLISH" | "CLOSE" } | null {
  if (!perms.canManage) return null;
  if (status === "DRAFT") return { label: "Publish", kind: "PUBLISH" };
  if (status === "PUBLISHED") return { label: "Close", kind: "CLOSE" };
  return null;
}

/**
 * PAGE 22 gives the Teacher "Edit milestones", but §9.3 makes approving a
 * milestone unlock the next one — editing the chain after students have
 * started would invalidate work already approved. Structural edits are
 * therefore allowed only while nothing has been submitted.
 */
export function canEditMilestoneChain(
  assignment: { status: AssignmentStatus; submittedCount: number },
  perms: AssignmentPermissions,
): boolean {
  return (
    perms.canEditMilestones &&
    assignment.status !== "CLOSED" &&
    assignment.submittedCount === 0
  );
}

/** A student may act while the work is open or a resubmission was asked for. */
export function canStudentAct(status: SubmissionStatus): boolean {
  return (
    status === "NOT_SUBMITTED" ||
    status === "REJECTED" ||
    status === "RESUBMIT_REQUESTED"
  );
}

/** Fixed reference so server and client agree on "overdue". */
const NOW = Date.UTC(2026, 6, 29, 4, 30, 0);

/** Whole days until the due date; negative once overdue. */
export function daysToDue(iso: string, now = NOW): number {
  return Math.round((new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000));
}

export function isOverdue(iso: string, now = NOW): boolean {
  return new Date(iso).getTime() < now;
}

/** Human due-date label, e.g. "Due tomorrow" / "3 days overdue". */
export function dueLabel(iso: string): string {
  const days = daysToDue(iso);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

/** Date + time, e.g. "12 Aug, 23:59". */
export function dueDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(
    "en-IN",
    { hour: "2-digit", minute: "2-digit", hour12: false },
  )}`;
}

/** Review-load colour: amber past 5 pending, red past 15. */
export function loadTone(pending: number): Tone {
  if (pending >= 15) return "danger";
  if (pending >= 5) return "warning";
  return "success";
}
