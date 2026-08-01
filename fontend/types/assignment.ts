/**
 * Assignment contracts — role_based_shared_pages.md PAGE 7 (C-RB-07).
 * Mirrors `assignments`, `milestones`, `submissions` and `submission_files`
 * in database_design_complete.md §7.3.
 */

/** `assignment_status` enum (DB §7.3). */
export type AssignmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

/** `assignment_type` enum (DB §7.3). */
export type AssignmentType = "REGULAR" | "MILESTONE" | "GROUP";

/** `submission_status` enum (DB §7.3). */
export type SubmissionStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RESUBMIT_REQUESTED";

/** PAGE 7 gives each role a different job: create, review, submit or oversee. */
export type AssignmentViewKind =
  | "AUTHOR" // Teacher — own assignments, create/edit/close/review
  | "DEPARTMENT" // HOD — dept assignments + pending review per teacher
  | "INSTITUTION" // Principal / VP — institution-wide summary
  | "SUBMIT" // Student — pending/submitted/approved, submit & resubmit
  | "CHILD" // Parent — child's status, read-only
  | "NONE";

export interface AssignmentPermissions {
  view: AssignmentViewKind;
  canAuthor: boolean;
  /** Publish a draft, close an open assignment */
  canManage: boolean;
  /** Grade and give feedback on submissions */
  canReview: boolean;
  canSubmit: boolean;
  canExport: boolean;
  /**
   * PAGE 22 — "Edit milestones". Separate from `canAuthor` because the
   * milestone chain drives submission unlocking (§9.3): editing it after
   * students have started would invalidate work already approved.
   */
  canEditMilestones: boolean;
  /**
   * PAGE 22 — see the completion roll-up. The Teacher and HOD get it; a
   * student must never receive the whole class's numbers.
   */
  canSeeProgress: boolean;
  note: string;
}

export interface SubmissionFile {
  id: string;
  fileName: string;
  fileSizeBytes: number;
}

/** Teacher-facing row — one assignment they created. */
export interface AssignmentSummary {
  id: string;
  title: string;
  description: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  departmentName: string;
  teacherName: string;
  type: AssignmentType;
  totalMarks: number;
  passingMarks: number;
  dueDate: string;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  status: AssignmentStatus;
  /** Progress across the class */
  enrolledCount: number;
  submittedCount: number;
  reviewedCount: number;
  /** Awaiting the teacher's review — the actionable number */
  pendingReview: number;
  /** MILESTONE assignments only */
  milestoneCount: number;
}

/** A stage inside a milestone assignment (DB §7.3). */
export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  marks: number;
  dueDate: string | null;
  /** Locked until the previous milestone is approved (dev doc §9.3) */
  isLocked: boolean;
  status: SubmissionStatus;
}

/** Student-facing row — the same assignment from the submitter's side. */
export interface StudentAssignment {
  id: string;
  title: string;
  description: string;
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  type: AssignmentType;
  totalMarks: number;
  passingMarks: number;
  dueDate: string;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  status: SubmissionStatus;
  /** Set once reviewed */
  score: number | null;
  grade: string | null;
  feedback: string | null;
  isLate: boolean;
  /** Increments on each resubmission (DB §7.3 `version`) */
  version: number;
  files: SubmissionFile[];
  milestones: Milestone[];
}

/* ── Assignment detail (PAGE 22, C-RB-22) ───────────────────────────────── */

/**
 * One student's row in the Teacher's submission table.
 * Mirrors `submissions` joined to the student (DB §7.3).
 */
export interface SubmissionRow {
  submissionId: string | null;
  studentId: string;
  studentName: string;
  rollNo: string;
  /** Null for a MILESTONE assignment row that targets a specific stage */
  milestoneId: string | null;
  status: SubmissionStatus;
  submittedAt: string | null;
  isLate: boolean;
  lateByMinutes: number | null;
  score: number | null;
  grade: string | null;
  feedback: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  /** Increments on each resubmission (DB §7.3 `version`) */
  version: number;
  textResponse: string | null;
  files: SubmissionFile[];
}

/**
 * One submission on its own page — C-TC-16.
 * "View one submission, files, add feedback, set score"
 *
 * The row is the same `SubmissionRow` the review table (C-TC-15) already
 * renders; what this adds is the **context** a reviewer needs when they
 * arrive by deep link rather than from the assignment they were just
 * looking at — which assignment this is, what it is marked out of, and where
 * the student sits in the queue.
 *
 * `previousVersions` exists because `submissions` is UNIQUE on
 * `(assignment_id, milestone_id, student_id, version)` (§7.3) — a
 * resubmission is a *new row*, not an edit. A reviewer looking at v2 needs to
 * see what they asked for on v1, or the feedback loop is invisible.
 */
export interface SubmissionDetail {
  submission: SubmissionRow;
  /** The assignment it belongs to, for the header and the score cap */
  assignment: AssignmentSummary;
  /** Set only for a MILESTONE assignment — which stage this covers (§7.3) */
  milestone: Milestone | null;
  /** Earlier versions of the same student's work, newest first */
  previousVersions: {
    version: number;
    status: SubmissionStatus;
    submittedAt: string | null;
    score: number | null;
    feedback: string | null;
    reviewedByName: string | null;
  }[];
  /** Position in the reviewable queue, for "next to review" navigation */
  queue: {
    /** 1-based position among submissions still awaiting a decision */
    position: number;
    total: number;
    /** Submission id of the next one needing review, null when this is last */
    nextId: string | null;
  };
}

/**
 * Completion roll-up for one assignment — PAGE 22 gives the Teacher a
 * "submission table" and the HOD an "overview of submissions, completion
 * rate". Both read these numbers, derived from the submission rows.
 */
export interface AssignmentProgress {
  enrolled: number;
  notSubmitted: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  resubmitRequested: number;
  late: number;
  /** Percentage of the class that has submitted anything */
  submissionRate: number;
  /** Percentage of the class approved — PAGE 22's "completion rate" */
  completionRate: number;
  /** Awaiting the teacher, the actionable number */
  pendingReview: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
}

/**
 * Upload rules from `assignments` (DB §7.3) — shown to the student beside the
 * file picker and enforced by the same values client-side.
 */
export interface UploadPolicy {
  maxFileSizeMb: number;
  allowedFileTypes: string[];
}

/** Everything the detail page may render for one assignment. */
export interface AssignmentDetail {
  summary: AssignmentSummary;
  milestones: Milestone[];
  uploadPolicy: UploadPolicy;
  /** Teacher only — the per-student submission table */
  submissions?: SubmissionRow[];
  /** Teacher + HOD — completion roll-up */
  progress?: AssignmentProgress;
  /** Student only — their own view of this assignment */
  own?: StudentAssignment;
}

/** HOD view — pending review load per teacher. */
export interface TeacherLoad {
  teacherId: string;
  teacherName: string;
  subjectCodes: string[];
  assignmentCount: number;
  pendingReview: number;
  /** Oldest pending submission, in days */
  oldestPendingDays: number;
}

/** Principal / VP — institution-wide roll-up. */
export interface DepartmentAssignmentSummary {
  departmentId: string;
  departmentName: string;
  assignmentCount: number;
  submissionRate: number;
  pendingReview: number;
  overdueCount: number;
}
