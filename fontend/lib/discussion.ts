import type { InstitutionRole } from "@/types/auth";
import type {
  DiscussionPermissions,
  DiscussionThread,
  ModerationReach,
} from "@/types/discussion";

/**
 * Discussion Forum role logic — role_based_shared_pages.md PAGE 3,
 * reconciled with the permission matrix in role_based_system_design.md §6.
 *
 * Same pattern as the notice board: the matrix is data, so ThreadList,
 * ThreadCard and the composer stay free of role branching.
 *
 * TODO(Dev-B): the backend re-checks every rule — this is UX, not security.
 */

/* ── Demo scope data — replace with JWT `scopeIds` ──────────────────────── */

const OWN_DEPT = { id: "cse", name: "CSE" };
const DEPT_SUBJECTS = [
  { id: "cs301", name: "CS301 · Algorithms" },
  { id: "cs305", name: "CS305 · Databases" },
  { id: "cs307", name: "CS307 · Operating Systems" },
];
/** Subjects the signed-in teacher actually teaches. */
const OWN_SUBJECTS = [DEPT_SUBJECTS[0]!, DEPT_SUBJECTS[1]!];
const OWN_CLASSES = [
  { id: "fy-a", name: "FY-A" },
  { id: "sy-b", name: "SY-B" },
];
const MENTEE_GROUP = [{ id: "mentee-cse-3", name: "My Mentee Group" }];

/* ── Permission matrix ──────────────────────────────────────────────────── */

const post = {
  deptAndSubjects: () => [
    { scope: "DEPARTMENT" as const, label: "Department", targets: [OWN_DEPT] },
    { scope: "SUBJECT" as const, label: "Subject", targets: DEPT_SUBJECTS },
  ],
  ownSubjects: () => [
    { scope: "SUBJECT" as const, label: "My Subjects", targets: OWN_SUBJECTS },
    { scope: "CLASS" as const, label: "My Classes", targets: OWN_CLASSES },
  ],
  ownClass: () => [
    { scope: "CLASS" as const, label: "My Class", targets: [OWN_CLASSES[0]!] },
    { scope: "SUBJECT" as const, label: "My Subjects", targets: OWN_SUBJECTS },
  ],
  everything: () => [
    { scope: "DEPARTMENT" as const, label: "Department", targets: [OWN_DEPT] },
    { scope: "SUBJECT" as const, label: "Subject", targets: DEPT_SUBJECTS },
    { scope: "CLASS" as const, label: "Class", targets: OWN_CLASSES },
  ],
  menteeGroup: () => [
    { scope: "CLASS" as const, label: "Mentee Group", targets: MENTEE_GROUP },
  ],
};

/** Roles with no forum access at all (§6: Accountant, Librarian, Parent, …). */
function noAccess(note: string): DiscussionPermissions {
  return {
    canPost: false,
    visibleScopes: [],
    moderation: "NONE",
    canAcceptAnswer: false,
    postScopes: [],
    note,
  };
}

const PERMISSIONS: Record<InstitutionRole, DiscussionPermissions> = {
  /* ── PAGE 3 table — the 8 roles you specified ─────────────────────────── */

  // Principal / VP — all threads, full moderation
  PRINCIPAL: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    moderation: "ALL",
    canAcceptAnswer: false,
    postScopes: post.everything(),
  },
  VICE_PRINCIPAL: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    moderation: "ALL",
    canAcceptAnswer: false,
    postScopes: post.everything(),
  },

  // HOD — all dept threads, moderates anything in the department
  HOD: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    moderation: "DEPARTMENT",
    canAcceptAnswer: true,
    postScopes: post.deptAndSubjects(),
    note: "You moderate every thread in your department.",
  },

  // Teacher — own subject/class threads, moderates own subject only
  TEACHER: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT"],
    moderation: "OWN_SUBJECT",
    canAcceptAnswer: true,
    postScopes: post.ownSubjects(),
    note: "You moderate threads in the subjects you teach.",
  },

  // Student — own class + own subject threads, no moderation
  STUDENT: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT"],
    moderation: "NONE",
    canAcceptAnswer: false,
    postScopes: post.ownClass(),
  },

  // Exam Controller — exam-related threads only, moderates those
  EXAM_CONTROLLER: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    tagFilter: "exam",
    moderation: "EXAM",
    canAcceptAnswer: false,
    postScopes: post.everything(),
    note: "You see and moderate exam-related threads.",
  },

  // Academic Coordinator — academic threads, limited (no moderation)
  ACADEMIC_COORDINATOR: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    moderation: "NONE",
    canAcceptAnswer: false,
    postScopes: post.everything(),
    note: "You can post academic threads but not moderate them.",
  },

  // Mentor — mentee group threads, moderates own group
  MENTOR: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT"],
    moderation: "OWN_GROUP",
    canAcceptAnswer: true,
    postScopes: post.menteeGroup(),
    note: "You moderate your own mentee group threads.",
  },

  /* ── Reconciled from role_based_system_design.md §6 ───────────────────── */

  // §6 grants Institution Admin "full" on Discussion
  INSTITUTION_ADMIN: {
    canPost: true,
    visibleScopes: ["CLASS", "SUBJECT", "DEPARTMENT"],
    moderation: "ALL",
    canAcceptAnswer: false,
    postScopes: post.everything(),
  },

  // §6: no Discussion access
  ACCOUNTANT: noAccess("The discussion forum isn't part of your role."),
  LIBRARIAN: noAccess("The discussion forum isn't part of your role."),
  PARENT: noAccess("Discussion threads are for students and staff only."),
  HOSTEL_WARDEN: noAccess("The discussion forum isn't part of your role."),
  TRANSPORT_MANAGER: noAccess("The discussion forum isn't part of your role."),
  PLACEMENT_OFFICER: noAccess("The discussion forum isn't part of your role."),
  HR_MANAGER: noAccess("The discussion forum isn't part of your role."),
  ADMISSION_OFFICER: noAccess("The discussion forum isn't part of your role."),
  STORE_MANAGER: noAccess("The discussion forum isn't part of your role."),
};

/** Highest-reach moderation wins when a user holds several roles. */
const REACH_RANK: ModerationReach[] = [
  "NONE",
  "EXAM",
  "OWN_GROUP",
  "OWN_SUBJECT",
  "DEPARTMENT",
  "ALL",
];

/** Permissions for a set of roles — multi-role users get the union. */
export function discussionPermissions(
  roles: InstitutionRole[],
): DiscussionPermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<DiscussionPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    const seen = new Set(acc.postScopes.map((s) => `${s.scope}:${s.label}`));

    return {
      canPost: acc.canPost || next.canPost,
      visibleScopes: [...new Set([...acc.visibleScopes, ...next.visibleScopes])],
      // A broader role lifts the exam-only restriction
      tagFilter: acc.tagFilter && next.tagFilter ? acc.tagFilter : undefined,
      moderation:
        REACH_RANK.indexOf(next.moderation) > REACH_RANK.indexOf(acc.moderation)
          ? next.moderation
          : acc.moderation,
      canAcceptAnswer: acc.canAcceptAnswer || next.canAcceptAnswer,
      postScopes: [
        ...acc.postScopes,
        ...next.postScopes.filter((s) => !seen.has(`${s.scope}:${s.label}`)),
      ],
      note: acc.canPost || next.canPost ? acc.note : undefined,
    };
  }, base);
}

/**
 * Can this role moderate *this* thread?
 * Reach is per-thread, not global — a Teacher only moderates their own
 * subject, a Mentor only their group (PAGE 3).
 */
export function canModerateThread(
  perms: DiscussionPermissions,
  thread: DiscussionThread,
  viewerId: string,
): boolean {
  switch (perms.moderation) {
    case "ALL":
      return true;
    case "DEPARTMENT":
      // HOD: any thread inside the department (incl. its subjects and classes)
      return true;
    case "OWN_SUBJECT":
      return (
        thread.scopeType === "SUBJECT" &&
        perms.postScopes.some((s) =>
          s.targets.some((t) => t.id === thread.scopeId),
        )
      );
    case "OWN_GROUP":
      return thread.author.id === viewerId || thread.scopeId === "mentee-cse-3";
    case "EXAM":
      return thread.tags.includes("exam");
    case "NONE":
    default:
      return false;
  }
}

/** Authors may always delete their own thread (soft delete). */
export function canDeleteThread(
  perms: DiscussionPermissions,
  thread: DiscussionThread,
  viewerId: string,
): boolean {
  return thread.author.id === viewerId || canModerateThread(perms, thread, viewerId);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const SCOPE_LABELS: Record<string, string> = {
  CLASS: "Class",
  SUBJECT: "Subject",
  DEPARTMENT: "Department",
};

/** Filter pills above the thread list (PAGE 3 — ThreadList scope filter). */
export function filtersFor(perms: DiscussionPermissions) {
  const pills: { key: string; label: string }[] = [{ key: "ALL", label: "All" }];

  if (perms.visibleScopes.includes("DEPARTMENT"))
    pills.push({ key: "DEPARTMENT", label: "Department" });
  if (perms.visibleScopes.includes("SUBJECT"))
    pills.push({ key: "SUBJECT", label: "Subjects" });
  if (perms.visibleScopes.includes("CLASS"))
    pills.push({ key: "CLASS", label: "Classes" });

  pills.push(
    { key: "UNANSWERED", label: "Unanswered" },
    { key: "RESOLVED", label: "Resolved" },
    { key: "PINNED", label: "Pinned" },
  );
  return pills;
}
