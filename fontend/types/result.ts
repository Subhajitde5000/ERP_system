/**
 * Results contracts — role_based_shared_pages.md PAGE 9 (C-RB-09).
 * Mirrors `result_publications`, `student_results` and `grade_cards`
 * in database_design_complete.md §7.7.
 */

/** `result_outcome` enum (DB §7.7). */
export type ResultOutcome = "PASS" | "FAIL" | "WITHHELD" | "ABSENT";

/**
 * Publication lifecycle (DB §7.7 + dev doc §9.2):
 * compiled → approved by the principal → visible to students.
 */
export type PublicationStage = "DRAFT" | "COMPILED" | "APPROVED" | "PUBLISHED";

/** PAGE 9: each role sees a different slice and holds a different lever. */
export type ResultViewKind =
  | "SUBJECT" // Teacher — own subject across classes, release subject results
  | "COMPILE" // Exam Controller — all results, compile / approve / publish
  | "DEPARTMENT" // HOD — dept summary, pass %, toppers, export
  | "INSTITUTION" // Principal / VP — institution summary, approve publication
  | "SELF" // Student — own breakdown, grade, rank, grade card
  | "CHILD" // Parent — child's results, grade card
  | "NONE";

export interface ResultPermissions {
  view: ResultViewKind;
  /** Teacher — release results for their own subject */
  canReleaseSubject: boolean;
  /** Exam Controller — compile across exams */
  canCompile: boolean;
  /** Principal / VP — approve a compiled publication */
  canApprove: boolean;
  /** Exam Controller — push an approved publication to students */
  canPublish: boolean;
  canExport: boolean;
  /** Download the grade card PDF */
  canDownloadGradeCard: boolean;
  note: string;
}

/** One subject's marks inside a student result (`subject_scores` JSONB). */
export interface SubjectScore {
  subjectCode: string;
  subjectName: string;
  marksObtained: number;
  marksPossible: number;
  grade: string;
  outcome: ResultOutcome;
}

/** A publication event awaiting compile / approval / release. */
export interface Publication {
  id: string;
  title: string;
  className: string | null;
  academicYear: string;
  examCount: number;
  stage: PublicationStage;
  isVisibleToStudents: boolean;
  publishedBy: string | null;
  publishedAt: string | null;
  /** Compilation progress */
  studentCount: number;
  compiledCount: number;
  /** Roll-up once compiled */
  passPercent: number | null;
  averagePercent: number | null;
  withheldCount: number;
}

/** Teacher's per-class view of their own subject. */
export interface SubjectClassResult {
  classId: string;
  className: string;
  subjectCode: string;
  subjectName: string;
  studentCount: number;
  gradedCount: number;
  averagePercent: number;
  passPercent: number;
  highestPercent: number;
  /** Whether this subject's marks have been released into the publication */
  isReleased: boolean;
}

/** Class or department roll-up used by the HOD and Principal views. */
export interface ResultGroupSummary {
  id: string;
  name: string;
  studentCount: number;
  passPercent: number;
  averagePercent: number;
  distinctionCount: number;
  failCount: number;
  /** Top performers — PAGE 9 asks for toppers */
  toppers: { name: string; rollNo: string; percentage: number }[];
}

/** Student / parent view of a single published result. */
export interface StudentResult {
  publicationId: string;
  title: string;
  academicYear: string;
  studentName: string;
  className: string;
  rollNo: string;
  totalObtained: number;
  totalPossible: number;
  percentage: number;
  grade: string;
  /** Rank within class — null while withheld */
  rank: number | null;
  classSize: number;
  outcome: ResultOutcome;
  subjects: SubjectScore[];
  remarks: string | null;
  /** A generated grade card exists in S3 (DB §7.7 `grade_cards`) */
  gradeCardReady: boolean;
  publishedAt: string;
}
