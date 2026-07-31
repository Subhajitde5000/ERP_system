/**
 * Examination contracts — role_based_shared_pages.md PAGE 6 (C-RB-06).
 * Mirrors `exams`, `questions`, `question_options`, `exam_attempts`,
 * `exam_hall_allocations` and `malpractice_logs` in
 * database_design_complete.md §7.2.
 */

/** `exam_status` enum (DB §7.2) — drives the lifecycle in dev doc §9.2. */
export type ExamStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ONGOING"
  | "COMPLETED"
  | "RESULTS_RELEASED"
  | "CANCELLED";

export type ExamType = "MCQ" | "DESCRIPTIVE" | "MIXED" | "QUIZ";
export type ExamMode = "ONLINE" | "OFFLINE";

/** `attempt_status` enum (DB §7.2). */
export type AttemptStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "GRADED"
  | "MALPRACTICE";

export type QuestionType =
  | "MCQ"
  | "SHORT_ANSWER"
  | "LONG_ANSWER"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCH";

/**
 * PAGE 6 gives each role a different job: create, monitor, schedule or attempt.
 * Resolved once server-side, like the attendance view kind.
 */
export type ExamViewKind =
  | "AUTHOR" // Teacher — own exams, create/edit/publish/release
  | "CONTROL" // Exam Controller — all exams, schedule, halls, compile
  | "DEPARTMENT" // HOD — dept exams, read-only
  | "INSTITUTION" // Principal / VP — institution-wide, read-only
  | "TIMETABLE" // Academic Coordinator — dates × classes schedule
  | "TAKE" // Student — upcoming/past, attempt, view results
  | "CHILD" // Parent — child's exams, read-only
  | "NONE";

export interface ExamPermissions {
  view: ExamViewKind;
  /** Create and edit exams */
  canAuthor: boolean;
  /** Publish a draft, release results */
  canPublish: boolean;
  /** Schedule + allocate halls (Exam Controller) */
  canSchedule: boolean;
  /** Compile results across the institution */
  canCompile: boolean;
  /** Start an attempt */
  canAttempt: boolean;
  /** Download the schedule/report shown in this view */
  canExport: boolean;
  /**
   * PAGE 21 — grade descriptive answers. Separate from `canAuthor` because
   * an Exam Controller may author and publish but does not mark papers
   * (§4.6 is "compile and publish"; marking belongs to the subject teacher).
   */
  canGrade: boolean;
  /** PAGE 21 — allocate halls for an offline exam (Exam Controller) */
  canAllocateHalls: boolean;
  /** PAGE 21 — resolve a malpractice flag (Exam Controller) */
  canResolveMalpractice: boolean;
  note: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  departmentName: string;
  examType: ExamType;
  mode: ExamMode;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number;
  scheduledAt: string;
  status: ExamStatus;
  /** Author display name */
  createdBy: string;
  questionCount: number;
  /** Live/aggregate counts for monitoring views */
  enrolledCount: number;
  submittedCount: number;
  gradedCount: number;
  malpracticeFlags: number;
  /** Offline exams only */
  hallsAllocated: number;
  hallsRequired: number;
}

/** Student / parent row — the same exam seen from the taker's side. */
export interface StudentExam {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  examType: ExamType;
  mode: ExamMode;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number;
  scheduledAt: string;
  status: ExamStatus;
  attemptStatus: AttemptStatus;
  /** Present once graded and released */
  score: number | null;
  percentage: number | null;
  grade: string | null;
  /** Whether the student may review answers after submitting */
  allowReview: boolean;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  questionType: QuestionType;
  marks: number;
  negativeMarks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  options: QuestionOption[];
  explanation: string | null;
  /** `questions.section_id` — null when the exam has no sections */
  sectionId: string | null;
  sortOrder: number;
}

/** `exam_sections` (DB §7.2) — optional grouping shown in the editor. */
export interface ExamSection {
  id: string;
  title: string;
  description: string | null;
  maxMarks: number;
  sortOrder: number;
}

/**
 * Settings block on `exams` that the Teacher edits while DRAFT (PAGE 21
 * "exam settings"). Kept separate from ExamSummary so the editor form and the
 * PATCH body are the same shape.
 */
export interface ExamSettings {
  instructions: string | null;
  windowEndAt: string | null;
  resultsReleaseAt: string | null;
  allowReview: boolean;
  shuffleQuestions: boolean;
  showScoreImmediately: boolean;
}

/**
 * Submission + grading roll-up for one exam (PAGE 21 "submission stats" for
 * the Teacher, "submission summary" for HOD/Principal).
 * Derived from `exam_attempts`, never stored.
 */
export interface SubmissionStats {
  enrolled: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  graded: number;
  malpractice: number;
  /** Descriptive answers still awaiting a human grade */
  pendingDescriptive: number;
  /** Null until at least one attempt is graded */
  averagePercentage: number | null;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  passCount: number;
  failCount: number;
}

/** One band of the result summary histogram (PAGE 21 "result summary"). */
export interface GradeBand {
  grade: string;
  count: number;
}

/**
 * A descriptive answer waiting for the Teacher to grade
 * (`answers` + `exam_attempts`, DB §7.2). MCQ answers auto-grade, so only
 * SHORT/LONG/FILL reach this queue — dev doc §9.2.
 */
export interface DescriptiveAnswer {
  answerId: string;
  attemptId: string;
  studentName: string;
  rollNo: string;
  questionId: string;
  questionText: string;
  maxMarks: number;
  textAnswer: string;
  /** null until graded */
  score: number | null;
  feedback: string | null;
  gradedByName: string | null;
}

/** `exam_hall_allocations` (DB §7.2) — offline exams only. */
export interface HallAllocation {
  id: string;
  roomNo: string;
  invigilatorName: string | null;
  capacity: number;
  seatedCount: number;
}

/** `malpractice_logs` (DB §7.2) — the Exam Controller's review queue. */
export type MalpracticeType =
  | "TAB_SWITCH"
  | "COPY_PASTE"
  | "MULTIPLE_IP"
  | "REPORTED";

export type MalpracticeAction = "WARNED" | "DISQUALIFIED" | "IGNORED";

export interface MalpracticeLog {
  id: string;
  attemptId: string;
  studentName: string;
  rollNo: string;
  type: MalpracticeType;
  description: string | null;
  loggedAt: string;
  /** null while the case is still open */
  actionTaken: MalpracticeAction | null;
  handledByName: string | null;
}

/**
 * A student's own answer during an attempt (`answers`, DB §7.2).
 * `selectedOptionId` for MCQ/TRUE_FALSE, `textAnswer` for descriptive.
 */
export interface AttemptAnswer {
  questionId: string;
  selectedOptionId: string | null;
  textAnswer: string | null;
}

/**
 * Everything the student's attempt screen needs. The correct answers are
 * **not** part of this shape — the attempt payload must never carry them.
 */
export interface AttemptSession {
  attemptId: string;
  examId: string;
  startedAt: string;
  /** Server-authoritative deadline (Redis TTL, dev doc §9.2) */
  expiresAt: string;
  questions: Question[];
  answers: AttemptAnswer[];
  tabSwitchCount: number;
}

/**
 * A graded answer shown back to the student after release, when the exam has
 * `allow_review`. Carries the correct option only once review is permitted.
 */
export interface ReviewedAnswer {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  maxMarks: number;
  score: number | null;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  textAnswer: string | null;
  feedback: string | null;
  explanation: string | null;
  options: QuestionOption[];
}

/** Exam Controller monitoring row (dev doc §9.2 anti-cheat). */
export interface LiveAttempt {
  id: string;
  studentName: string;
  rollNo: string;
  startedAt: string;
  status: AttemptStatus;
  answeredCount: number;
  tabSwitchCount: number;
}

/** Coordinator timetable cell — an exam on a date for a class. */
export interface TimetableEntry {
  examId: string;
  title: string;
  subjectCode: string;
  className: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: ExamMode;
}
