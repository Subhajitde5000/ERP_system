import type { InstitutionRole } from "@/types/auth";
import type {
  Notice,
  NoticePermissions,
  NoticePriority,
  NoticeScope,
} from "@/types/notice";

/**
 * Notice Board role logic — Notice_Board_design.md §3.
 *
 * The permission matrix is data, not branching UI. Both the feed and the
 * composer read from `noticePermissions(role)`, so the rules live in exactly
 * one place and the components stay dumb.
 *
 * TODO(Dev-B): the backend re-validates every rule here in
 * `canPostScope()` (§5) — this is UX, never the security boundary.
 */

/* ── Demo scope data — replace with JWT `scopeIds` (§1) ─────────────────── */

const DEPARTMENTS = [
  { id: "cse", name: "CSE" },
  { id: "ece", name: "ECE" },
  { id: "me", name: "Mechanical" },
  { id: "civil", name: "Civil" },
];

const CLASSES = [
  { id: "fy-a", name: "FY-A" },
  { id: "fy-b", name: "FY-B" },
  { id: "sy-a", name: "SY-A" },
  { id: "sy-b", name: "SY-B" },
  { id: "ty-a", name: "TY-A" },
];

/** Classes inside the signed-in HOD's own department. */
const OWN_DEPT_CLASSES = [CLASSES[0]!, CLASSES[1]!, CLASSES[2]!];

/** The signed-in teacher's assigned classes — max 4 per §3. */
const OWN_CLASSES = [CLASSES[0]!, CLASSES[3]!];

const HOSTEL_BLOCKS = [
  { id: "block-a", name: "Block A · Boys" },
  { id: "block-b", name: "Block B · Boys" },
  { id: "block-c", name: "Block C · Girls" },
];

const TRANSPORT_ROUTES = [
  { id: "r1", name: "R1 · Station – Campus" },
  { id: "r2", name: "R2 · Airport Road" },
];

/** The signed-in HOD's own department (locked in the composer). */
const OWN_DEPT = DEPARTMENTS[0]!;

/* ── Scope helpers ──────────────────────────────────────────────────────── */

const INSTITUTION_ONLY: NoticeScope[] = ["INSTITUTION"];

const scope = {
  institution: (disabledReason?: string) => ({
    scope: "INSTITUTION" as const,
    label: "Institution-wide",
    targets: [],
    disabledReason,
  }),
  anyDept: () => ({
    scope: "DEPARTMENT" as const,
    label: "Department",
    targets: DEPARTMENTS,
  }),
  ownDept: () => ({
    scope: "DEPARTMENT" as const,
    label: "My Department",
    targets: [OWN_DEPT],
    locked: true,
  }),
  anyClass: () => ({
    scope: "CLASS" as const,
    label: "Class",
    targets: CLASSES,
  }),
  deptClasses: () => ({
    scope: "CLASS" as const,
    label: "My Department's Classes",
    targets: OWN_DEPT_CLASSES,
  }),
  ownClasses: () => ({
    scope: "CLASS" as const,
    label: "My Classes",
    targets: OWN_CLASSES,
  }),
  hostel: () => ({
    scope: "HOSTEL" as const,
    label: "Hostel",
    targets: HOSTEL_BLOCKS,
  }),
  transport: () => ({
    scope: "TRANSPORT" as const,
    label: "Transport Route",
    targets: TRANSPORT_ROUTES,
  }),
  placement: () => ({
    scope: "PLACEMENT" as const,
    label: "Placement-eligible Batches",
    targets: DEPARTMENTS,
  }),
  staff: () => ({
    scope: "STAFF" as const,
    label: "All Staff",
    targets: [],
  }),
};

/** View-only roles all share the same shape (§3). */
function viewOnly(note: string): NoticePermissions {
  return {
    canPost: false,
    postScopes: [],
    visibleScopes: INSTITUTION_ONLY,
    canModerate: false,
    defaultPriority: "NORMAL",
    note,
  };
}

/* ── The matrix — all 18 institution roles (§3) ─────────────────────────── */

const PERMISSIONS: Record<InstitutionRole, NoticePermissions> = {
  INSTITUTION_ADMIN: {
    canPost: true,
    postScopes: [
      scope.institution(),
      scope.anyDept(),
      scope.anyClass(),
      scope.hostel(),
      scope.transport(),
    ],
    visibleScopes: [
      "INSTITUTION",
      "DEPARTMENT",
      "CLASS",
      "HOSTEL",
      "TRANSPORT",
      "PLACEMENT",
      "STAFF",
    ],
    canModerate: true,
    defaultPriority: "NORMAL",
  },

  PRINCIPAL: {
    canPost: true,
    postScopes: [scope.institution(), scope.anyDept(), scope.anyClass()],
    visibleScopes: [
      "INSTITUTION",
      "DEPARTMENT",
      "CLASS",
      "HOSTEL",
      "TRANSPORT",
      "PLACEMENT",
      "STAFF",
    ],
    canModerate: true,
    defaultPriority: "NORMAL",
  },

  // Sees everything, but cannot post institution-wide (§3)
  VICE_PRINCIPAL: {
    canPost: true,
    postScopes: [
      scope.institution("Only the Principal can post institution-wide"),
      scope.anyDept(),
      scope.anyClass(),
    ],
    visibleScopes: [
      "INSTITUTION",
      "DEPARTMENT",
      "CLASS",
      "HOSTEL",
      "TRANSPORT",
      "PLACEMENT",
      "STAFF",
    ],
    canModerate: false,
    defaultPriority: "NORMAL",
  },

  // Own department only — dept is locked, classes limited to that dept
  HOD: {
    canPost: true,
    postScopes: [scope.ownDept(), scope.deptClasses()],
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
    canModerate: false,
    defaultPriority: "NORMAL",
    note: "You can post to your own department and its classes.",
  },

  // Own assigned classes only
  TEACHER: {
    canPost: true,
    postScopes: [scope.ownClasses()],
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
    canModerate: false,
    defaultPriority: "NORMAL",
    note: "You can post to the classes you teach.",
  },

  // Mentor reads the same feed as a teacher but has no posting rights of its own
  MENTOR: {
    canPost: false,
    postScopes: [],
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
    canModerate: false,
    defaultPriority: "NORMAL",
    note: "Mentors have view-only access to the notice board.",
  },

  // Auto-tagged EXAM, defaults to IMPORTANT (§3)
  EXAM_CONTROLLER: {
    canPost: true,
    postScopes: [scope.institution(), scope.anyClass()],
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
    canModerate: false,
    defaultPriority: "IMPORTANT",
    autoTag: "EXAM",
  },

  // Title auto-prefixed "(Academic)" (§3)
  ACADEMIC_COORDINATOR: {
    canPost: true,
    postScopes: [scope.anyClass()],
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
    canModerate: false,
    defaultPriority: "NORMAL",
    titlePrefix: "(Academic) ",
  },

  // Hostel residents only, cyan scope badge (§3)
  HOSTEL_WARDEN: {
    canPost: true,
    postScopes: [scope.hostel()],
    visibleScopes: ["INSTITUTION", "HOSTEL"],
    canModerate: false,
    defaultPriority: "NORMAL",
  },

  PLACEMENT_OFFICER: {
    canPost: true,
    postScopes: [scope.placement(), scope.institution()],
    visibleScopes: ["INSTITUTION", "PLACEMENT"],
    canModerate: false,
    defaultPriority: "NORMAL",
  },

  // "Staff Only" toggle (§3)
  HR_MANAGER: {
    canPost: true,
    postScopes: [scope.staff(), scope.institution()],
    visibleScopes: ["INSTITUTION", "STAFF"],
    canModerate: false,
    defaultPriority: "NORMAL",
    staffToggle: true,
  },

  // ── View-only roles ──────────────────────────────────────────────────
  STUDENT: {
    ...viewOnly("Notices from your institution, department and class."),
    visibleScopes: ["INSTITUTION", "DEPARTMENT", "CLASS"],
  },
  PARENT: {
    ...viewOnly("Notices for your institution and your child's class."),
    visibleScopes: ["INSTITUTION", "CLASS"],
  },
  ACCOUNTANT: viewOnly("You have view-only access to institution notices."),
  LIBRARIAN: viewOnly("You have view-only access to institution notices."),
  TRANSPORT_MANAGER: {
    ...viewOnly("You have view-only access to institution notices."),
    visibleScopes: ["INSTITUTION", "TRANSPORT"],
  },
  ADMISSION_OFFICER: viewOnly("You have view-only access to institution notices."),
  STORE_MANAGER: viewOnly("You have view-only access to institution notices."),
};

/**
 * Notice permissions for a set of roles.
 * Multi-role users get the **union** (§10): merged post scopes and visibility.
 */
export function noticePermissions(roles: InstitutionRole[]): NoticePermissions {
  const [first, ...rest] = roles;
  const base = PERMISSIONS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<NoticePermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    // Dedupe on scope *and* label: a Teacher's "My Classes" and a HOD's
    // "My Department's Classes" are both CLASS but target different sets,
    // so collapsing them by scope alone would silently drop permissions.
    const seen = new Set(acc.postScopes.map((s) => `${s.scope}:${s.label}`));

    return {
      canPost: acc.canPost || next.canPost,
      postScopes: [
        ...acc.postScopes,
        ...next.postScopes.filter((s) => !seen.has(`${s.scope}:${s.label}`)),
      ],
      visibleScopes: [...new Set([...acc.visibleScopes, ...next.visibleScopes])],
      canModerate: acc.canModerate || next.canModerate,
      defaultPriority: acc.defaultPriority,
      titlePrefix: acc.titlePrefix ?? next.titlePrefix,
      autoTag: acc.autoTag ?? next.autoTag,
      staffToggle: acc.staffToggle || next.staffToggle,
      note: acc.canPost || next.canPost ? undefined : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const SCOPE_LABELS: Record<NoticeScope, string> = {
  INSTITUTION: "Institution",
  DEPARTMENT: "Department",
  CLASS: "Class",
  HOSTEL: "Hostel",
  TRANSPORT: "Transport",
  PLACEMENT: "Placement",
  STAFF: "Staff",
};

/** Filter pills shown above the feed (§4, §7) — scope-aware per role. */
export function filtersFor(perms: NoticePermissions) {
  const pills: { key: string; label: string }[] = [{ key: "ALL", label: "All" }];

  if (perms.visibleScopes.includes("INSTITUTION"))
    pills.push({ key: "INSTITUTION", label: "Institution" });
  if (perms.visibleScopes.includes("DEPARTMENT"))
    pills.push({ key: "DEPARTMENT", label: "My Dept" });
  if (perms.visibleScopes.includes("CLASS"))
    pills.push({ key: "CLASS", label: "My Classes" });
  if (perms.visibleScopes.includes("HOSTEL"))
    pills.push({ key: "HOSTEL", label: "Hostel" });
  if (perms.visibleScopes.includes("PLACEMENT"))
    pills.push({ key: "PLACEMENT", label: "Placement" });
  if (perms.visibleScopes.includes("STAFF"))
    pills.push({ key: "STAFF", label: "Staff" });

  pills.push({ key: "PINNED", label: "Pinned" }, { key: "URGENT", label: "Urgent" });
  return pills;
}

/** Relative timestamp, e.g. "2h ago" (§4). */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  const date = new Date(iso);
  // Include the year once the date leaves the current one — without it a 2019
  // contract renders as "15 Jun" and reads as this year (found on PAGE 20,
  // where staff documents go back to the date of joining).
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  });
}

/** Human file size for attachment chips (§4). */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** A notice is expired when `expires_at` is in the past (§10). */
export function isExpired(notice: Notice, now = Date.now()): boolean {
  return notice.expiresAt !== null && new Date(notice.expiresAt).getTime() < now;
}

export const PRIORITY_ORDER: NoticePriority[] = ["NORMAL", "IMPORTANT", "URGENT"];

/** Upload constraints from §8 — enforced client-side and re-checked on presign. */
export const UPLOAD = {
  maxFiles: 5,
  maxBytes: 10 * 1024 * 1024,
  accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip",
} as const;
