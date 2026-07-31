import type { InstitutionRole } from "@/types/auth";
import type {
  PublicationStage,
  ResultOutcome,
  ResultPermissions,
  ResultViewKind,
} from "@/types/result";
import type { Tone } from "@/types/dashboard";

/**
 * Results role logic — role_based_shared_pages.md PAGE 9.
 *
 * Same view-kind pattern as the other role-based pages. Note the publication
 * lever is deliberately split: the Exam Controller compiles and publishes, the
 * Principal approves — neither can do the whole cycle alone (§6: Principal
 * "approve", Exam Controller "compile").
 *
 * TODO(Dev-B): backend re-validates every action — this is UX, not security.
 */

const VIEWS: Record<InstitutionRole, ResultPermissions> = {
  // Teacher — own subject across classes; release subject results
  TEACHER: subjectView(),
  MENTOR: subjectView(),

  // Exam Controller — all results; compile, approve, publish
  // §4.6 "Compile and publish results" — approval belongs to the Principal
  // (§4.3 "View and approve results"), so the two-person control holds.
  EXAM_CONTROLLER: {
    view: "COMPILE",
    canReleaseSubject: false,
    canCompile: true,
    canApprove: false,
    canPublish: true,
    canExport: true,
    canDownloadGradeCard: true,
    note: "All results across the institution — compile and publish.",
  },

  // HOD — dept-wise summary: pass %, toppers; view + export
  HOD: {
    view: "DEPARTMENT",
    canReleaseSubject: false,
    canCompile: false,
    canApprove: false,
    canPublish: false,
    canExport: true,
    canDownloadGradeCard: false,
    note: "Department results by class — pass rates and toppers.",
  },

  // Principal / VP — institution summary; approve publication
  PRINCIPAL: institutionView(true),
  // §6 grants VP "view" on results, not "approve" — same screen, no lever
  VICE_PRINCIPAL: institutionView(false),
  // §6 gives Institution Admin full access
  INSTITUTION_ADMIN: institutionView(true),

  // Student — own breakdown, grade, rank; download grade card
  STUDENT: {
    view: "SELF",
    canReleaseSubject: false,
    canCompile: false,
    canApprove: false,
    canPublish: false,
    canExport: false,
    canDownloadGradeCard: true,
    note: "Your published results and grade cards.",
  },

  // Parent — child's results; download child's grade card
  PARENT: {
    view: "CHILD",
    canReleaseSubject: false,
    canCompile: false,
    canApprove: false,
    canPublish: false,
    canExport: false,
    canDownloadGradeCard: true,
    note: "Your child's published results and grade cards.",
  },

  // Not part of these roles (§6)
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

function subjectView(): ResultPermissions {
  return {
    view: "SUBJECT",
    canReleaseSubject: true,
    canCompile: false,
    canApprove: false,
    canPublish: false,
    canExport: false,
    canDownloadGradeCard: false,
    note: "Results for the subjects you teach, across your classes.",
  };
}

function institutionView(canApprove: boolean): ResultPermissions {
  return {
    view: "INSTITUTION",
    canReleaseSubject: false,
    canCompile: false,
    canApprove,
    canPublish: false,
    canExport: true,
    canDownloadGradeCard: false,
    note: canApprove
      ? "Institution-wide results — approve publications before release."
      : "Institution-wide results, read-only.",
  };
}

function noAccess(): ResultPermissions {
  return {
    view: "NONE",
    canReleaseSubject: false,
    canCompile: false,
    canApprove: false,
    canPublish: false,
    canExport: false,
    canDownloadGradeCard: false,
    note: "Results aren't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: ResultViewKind[] = [
  "NONE",
  "CHILD",
  "SELF",
  "SUBJECT",
  "DEPARTMENT",
  "INSTITUTION",
  "COMPILE",
];

export function resultPermissions(
  roles: InstitutionRole[],
): ResultPermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<ResultPermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canReleaseSubject: acc.canReleaseSubject || next.canReleaseSubject,
      canCompile: acc.canCompile || next.canCompile,
      canApprove: acc.canApprove || next.canApprove,
      canPublish: acc.canPublish || next.canPublish,
      canExport: acc.canExport || next.canExport,
      canDownloadGradeCard:
        acc.canDownloadGradeCard || next.canDownloadGradeCard,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const OUTCOME_LABELS: Record<ResultOutcome, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  WITHHELD: "Withheld",
  ABSENT: "Absent",
};

export const OUTCOME_TONE: Record<ResultOutcome, Tone> = {
  PASS: "success",
  FAIL: "danger",
  WITHHELD: "warning",
  ABSENT: "muted",
};

export const STAGE_LABELS: Record<PublicationStage, string> = {
  DRAFT: "Draft",
  COMPILED: "Awaiting approval",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

export const STAGE_TONE: Record<PublicationStage, Tone> = {
  DRAFT: "muted",
  COMPILED: "warning",
  APPROVED: "accent",
  PUBLISHED: "success",
};

/**
 * The single next step in the publication cycle, given who is looking.
 *
 * DRAFT → compile (controller) → approve (principal) → publish (controller).
 * Returning null means this role can see the stage but not advance it, which
 * is what keeps the two-person control intact.
 */
export function nextPublicationAction(
  stage: PublicationStage,
  perms: ResultPermissions,
): { label: string; kind: "COMPILE" | "APPROVE" | "PUBLISH" } | null {
  if (stage === "DRAFT" && perms.canCompile)
    return { label: "Compile results", kind: "COMPILE" };
  // Approval belongs to the principal; the controller waits at this stage
  if (stage === "COMPILED" && perms.canApprove)
    return { label: "Approve publication", kind: "APPROVE" };
  if (stage === "APPROVED" && perms.canPublish)
    return { label: "Publish to students", kind: "PUBLISH" };
  return null;
}

/** Grade band colour — shared with the exam score scale. */
export function gradeTone(percentage: number): Tone {
  if (percentage < 40) return "danger";
  if (percentage < 60) return "warning";
  if (percentage < 75) return "accent";
  return "success";
}

/** Pass-rate band for class/department roll-ups. */
export function passTone(passPercent: number): Tone {
  if (passPercent < 60) return "danger";
  if (passPercent < 80) return "warning";
  return "success";
}

/** "3rd of 32" — ordinal rank within the class. */
export function rankLabel(rank: number | null, classSize: number): string {
  if (rank === null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = rank % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0];
  return `${rank}${suffix} of ${classSize}`;
}

/** Date for publication rows, e.g. "12 Aug 2026". */
export function publishedOn(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
