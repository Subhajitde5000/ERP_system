import type {
  AttemptSession,
  DescriptiveAnswer,
  ExamSection,
  ExamSettings,
  ExamSummary,
  GradeBand,
  HallAllocation,
  LiveAttempt,
  MalpracticeLog,
  Question,
  ReviewedAnswer,
  StudentExam,
  SubmissionStats,
  TimetableEntry,
} from "@/types/examination";
import { getClassRoster } from "./attendance-data";

/**
 * Examination data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 6, C-RB-06; dev doc §9.2).
 *
 *   GET   /api/v1/examination/exams?scope=&status=      list, auto-scoped
 *   POST  /api/v1/examination/exams                     create (DRAFT)
 *   GET   /api/v1/examination/exams/:id                 detail + questions
 *   PATCH /api/v1/examination/exams/:id                 edit while DRAFT
 *   POST  /api/v1/examination/exams/:id/publish         DRAFT → PUBLISHED
 *   POST  /api/v1/examination/exams/:id/attempts        student starts (Redis timer)
 *   PATCH /api/v1/examination/attempts/:id/submit       submit / auto-submit
 *   GET   /api/v1/examination/exams/:id/attempts        live monitor
 *   POST  /api/v1/examination/exams/:id/halls           allocate halls
 *   POST  /api/v1/examination/exams/:id/results/release COMPLETED → RESULTS_RELEASED
 *
 * Shapes match the API response exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MINUTES = 60 * 1000;
const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;
/** Fixed base time so server and client render identically. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

/** Institution-wide exam set; each view filters this down. */
const EXAMS: ExamSummary[] = [
  {
    id: "e1",
    title: "Mid-term Examination — Algorithms",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    examType: "MIXED",
    mode: "ONLINE",
    totalMarks: 50,
    passingMarks: 20,
    durationMinutes: 90,
    // Started 55 minutes ago, so 35 remain. It was `at(-2 * HOURS)` against a
    // 90-minute paper, which meant the only ONGOING exam in the fixture had
    // *already ended* — the live monitor (C-EC-05) then showed a countdown
    // reading "overdue by 30m" and nothing a controller could act on.
    scheduledAt: at(-55 * MINUTES),
    status: "ONGOING",
    createdBy: "Priya Sharma",
    questionCount: 25,
    // Matches the attempt roster: 7 candidates, all of whom started. A cohort
    // of 32 against 7 attempt rows reported "25 not started" 40 minutes into
    // the paper, which reads as a system failure rather than a demo fixture.
    enrolledCount: 7,
    // 4 of the 7 attempts have been handed in (2 SUBMITTED + 2 GRADED).
    // Left at 18 after the cohort was corrected to 7, this claimed more
    // submissions than there were candidates.
    submittedCount: 4,
    gradedCount: 0,
    malpracticeFlags: 1,
    hallsAllocated: 0,
    hallsRequired: 0,
  },
  {
    id: "e2",
    title: "Unit Test 2 — Databases",
    subjectCode: "CS305",
    subjectName: "Databases",
    className: "FY-A",
    departmentName: "CSE",
    examType: "MCQ",
    mode: "ONLINE",
    totalMarks: 25,
    passingMarks: 10,
    durationMinutes: 45,
    scheduledAt: at(2 * DAYS),
    status: "PUBLISHED",
    createdBy: "Priya Sharma",
    questionCount: 25,
    enrolledCount: 32,
    submittedCount: 0,
    gradedCount: 0,
    malpracticeFlags: 0,
    hallsAllocated: 0,
    hallsRequired: 0,
  },
  {
    id: "e3",
    title: "Practical Assessment — Operating Systems",
    subjectCode: "CS307",
    subjectName: "Operating Systems",
    className: "SY-B",
    departmentName: "CSE",
    examType: "DESCRIPTIVE",
    mode: "OFFLINE",
    totalMarks: 40,
    passingMarks: 16,
    durationMinutes: 120,
    scheduledAt: at(5 * DAYS),
    status: "DRAFT",
    createdBy: "Priya Sharma",
    questionCount: 8,
    enrolledCount: 28,
    submittedCount: 0,
    gradedCount: 0,
    malpracticeFlags: 0,
    hallsAllocated: 0,
    hallsRequired: 2,
  },
  {
    id: "e4",
    title: "Quiz 3 — Data Structures",
    subjectCode: "CS201",
    subjectName: "Data Structures",
    className: "FY-A",
    departmentName: "CSE",
    examType: "QUIZ",
    mode: "ONLINE",
    totalMarks: 20,
    passingMarks: 8,
    durationMinutes: 30,
    scheduledAt: at(-6 * DAYS),
    status: "COMPLETED",
    createdBy: "Priya Sharma",
    questionCount: 20,
    enrolledCount: 32,
    submittedCount: 31,
    gradedCount: 31,
    malpracticeFlags: 0,
    hallsAllocated: 0,
    hallsRequired: 0,
  },
  {
    id: "e5",
    title: "Internal Assessment 1 — Discrete Mathematics",
    subjectCode: "MA101",
    subjectName: "Discrete Mathematics",
    className: "FY-A",
    departmentName: "CSE",
    examType: "MIXED",
    mode: "OFFLINE",
    totalMarks: 30,
    passingMarks: 12,
    durationMinutes: 60,
    scheduledAt: at(-14 * DAYS),
    status: "RESULTS_RELEASED",
    createdBy: "Arun Kumar",
    questionCount: 15,
    enrolledCount: 32,
    submittedCount: 32,
    gradedCount: 32,
    malpracticeFlags: 0,
    hallsAllocated: 2,
    hallsRequired: 2,
  },
  {
    id: "e6",
    title: "Mid-term Examination — Signals & Systems",
    subjectCode: "EC202",
    subjectName: "Signals & Systems",
    className: "SY-A",
    departmentName: "ECE",
    examType: "DESCRIPTIVE",
    mode: "OFFLINE",
    totalMarks: 50,
    passingMarks: 20,
    durationMinutes: 120,
    scheduledAt: at(3 * DAYS),
    status: "PUBLISHED",
    createdBy: "Meena Thomas",
    questionCount: 10,
    enrolledCount: 45,
    submittedCount: 0,
    gradedCount: 0,
    malpracticeFlags: 0,
    hallsAllocated: 1,
    hallsRequired: 3,
  },
  {
    id: "e7",
    title: "Workshop Practical — Thermodynamics",
    subjectCode: "ME105",
    subjectName: "Thermodynamics",
    className: "SY-A",
    departmentName: "Mechanical",
    examType: "DESCRIPTIVE",
    mode: "OFFLINE",
    totalMarks: 40,
    passingMarks: 16,
    durationMinutes: 150,
    scheduledAt: at(6 * DAYS),
    status: "PUBLISHED",
    createdBy: "Rajesh Verma",
    questionCount: 6,
    enrolledCount: 38,
    submittedCount: 0,
    gradedCount: 0,
    malpracticeFlags: 0,
    hallsAllocated: 0,
    hallsRequired: 2,
  },
];

/** The signed-in teacher, for the AUTHOR view. */
const OWN_AUTHOR = "Priya Sharma";
/** The signed-in HOD's department. */
const OWN_DEPT = "CSE";

/** Teacher — only exams they created. */
export function getOwnExams(): ExamSummary[] {
  return EXAMS.filter((e) => e.createdBy === OWN_AUTHOR).sort(bySchedule);
}

/** Exam Controller / Principal / VP — everything. */
export function getAllExams(): ExamSummary[] {
  return [...EXAMS].sort(bySchedule);
}

/** HOD — own department only. */
export function getDepartmentExams(): ExamSummary[] {
  return EXAMS.filter((e) => e.departmentName === OWN_DEPT).sort(bySchedule);
}

/** Newest scheduled first, but live exams float to the top. */
function bySchedule(a: ExamSummary, b: ExamSummary) {
  const rank = (e: ExamSummary) => (e.status === "ONGOING" ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return +new Date(b.scheduledAt) - +new Date(a.scheduledAt);
}

/** Academic Coordinator — upcoming exams as a date × class timetable. */
export function getTimetable(): TimetableEntry[] {
  return EXAMS.filter(
    (e) => e.status === "PUBLISHED" || e.status === "ONGOING",
  )
    .map((e) => ({
      examId: e.id,
      title: e.title,
      subjectCode: e.subjectCode,
      className: e.className,
      scheduledAt: e.scheduledAt,
      durationMinutes: e.durationMinutes,
      mode: e.mode,
    }))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
}

/** Student / Parent — their class's exams with attempt state. */
export function getStudentExams(): StudentExam[] {
  return [
    {
      id: "e1",
      title: "Mid-term Examination — Algorithms",
      subjectCode: "CS301",
      subjectName: "Algorithms",
      examType: "MIXED",
      mode: "ONLINE",
      totalMarks: 50,
      passingMarks: 20,
      durationMinutes: 90,
      scheduledAt: at(-2 * HOURS),
      status: "ONGOING",
      attemptStatus: "NOT_STARTED",
      score: null,
      percentage: null,
      grade: null,
      allowReview: false,
    },
    {
      id: "e2",
      title: "Unit Test 2 — Databases",
      subjectCode: "CS305",
      subjectName: "Databases",
      examType: "MCQ",
      mode: "ONLINE",
      totalMarks: 25,
      passingMarks: 10,
      durationMinutes: 45,
      scheduledAt: at(2 * DAYS),
      status: "PUBLISHED",
      attemptStatus: "NOT_STARTED",
      score: null,
      percentage: null,
      grade: null,
      allowReview: false,
    },
    {
      id: "e4",
      title: "Quiz 3 — Data Structures",
      subjectCode: "CS201",
      subjectName: "Data Structures",
      examType: "QUIZ",
      mode: "ONLINE",
      totalMarks: 20,
      passingMarks: 8,
      durationMinutes: 30,
      scheduledAt: at(-6 * DAYS),
      status: "COMPLETED",
      attemptStatus: "SUBMITTED",
      score: null,
      percentage: null,
      grade: null,
      allowReview: false,
    },
    {
      id: "e5",
      title: "Internal Assessment 1 — Discrete Mathematics",
      subjectCode: "MA101",
      subjectName: "Discrete Mathematics",
      examType: "MIXED",
      mode: "OFFLINE",
      totalMarks: 30,
      passingMarks: 12,
      durationMinutes: 60,
      scheduledAt: at(-14 * DAYS),
      status: "RESULTS_RELEASED",
      attemptStatus: "GRADED",
      score: 23,
      percentage: 77,
      grade: "B+",
      allowReview: true,
    },
    {
      id: "e8",
      title: "Surprise Test — Algorithms",
      subjectCode: "CS301",
      subjectName: "Algorithms",
      examType: "MCQ",
      mode: "ONLINE",
      totalMarks: 10,
      passingMarks: 4,
      durationMinutes: 15,
      scheduledAt: at(-21 * DAYS),
      status: "RESULTS_RELEASED",
      attemptStatus: "GRADED",
      score: 3,
      percentage: 30,
      grade: "F",
      allowReview: true,
    },
  ];
}

/* ── Exam detail (PAGE 21, C-RB-21) ─────────────────────────────────────── */

/** `exam_sections` for the demo paper. */
const SECTIONS: ExamSection[] = [
  {
    id: "sec-a",
    title: "Section A — Objective",
    description: "Answer all questions. Negative marking applies.",
    maxMarks: 20,
    sortOrder: 0,
  },
  {
    id: "sec-b",
    title: "Section B — Descriptive",
    description: "Answer any two. Marks are awarded for reasoning.",
    maxMarks: 30,
    sortOrder: 1,
  },
];

/**
 * The demo paper. Marks sum to the exam's `total_marks` (50 for e1) so the
 * editor's running total is honest — a paper whose questions don't add up to
 * the declared total is the kind of thing a teacher would notice immediately.
 */
const QUESTIONS: Question[] = [
  {
    id: "q1",
    sectionId: "sec-a",
    sortOrder: 0,
    text: "What is the worst-case time complexity of quicksort when the pivot is always the first element of an already-sorted array?",
    questionType: "MCQ",
    marks: 5,
    negativeMarks: 1,
    difficulty: "MEDIUM",
    explanation:
      "Every partition splits into 0 and n-1, giving n levels of recursion.",
    options: [
      { id: "o1", text: "O(n log n)", isCorrect: false },
      { id: "o2", text: "O(n²)", isCorrect: true },
      { id: "o3", text: "O(log n)", isCorrect: false },
      { id: "o4", text: "O(n)", isCorrect: false },
    ],
  },
  {
    id: "q2",
    sectionId: "sec-a",
    sortOrder: 1,
    text: "A stable sorting algorithm preserves the relative order of records with equal keys.",
    questionType: "TRUE_FALSE",
    marks: 5,
    negativeMarks: 0,
    difficulty: "EASY",
    explanation: null,
    options: [
      { id: "o5", text: "True", isCorrect: true },
      { id: "o6", text: "False", isCorrect: false },
    ],
  },
  {
    id: "q3",
    sectionId: "sec-a",
    sortOrder: 2,
    text: "Which data structure gives O(1) amortised insertion at both ends?",
    questionType: "MCQ",
    marks: 5,
    negativeMarks: 1,
    difficulty: "EASY",
    explanation: "A deque backed by a growable ring buffer.",
    options: [
      { id: "o7", text: "Singly linked list", isCorrect: false },
      { id: "o8", text: "Deque", isCorrect: true },
      { id: "o9", text: "Binary heap", isCorrect: false },
      { id: "o10", text: "Sorted array", isCorrect: false },
    ],
  },
  {
    id: "q4",
    sectionId: "sec-a",
    sortOrder: 3,
    text: "Dijkstra's algorithm produces correct shortest paths on a graph containing negative edge weights.",
    questionType: "TRUE_FALSE",
    marks: 5,
    negativeMarks: 0,
    difficulty: "MEDIUM",
    explanation: "Use Bellman-Ford when negative weights are possible.",
    options: [
      { id: "o11", text: "True", isCorrect: false },
      { id: "o12", text: "False", isCorrect: true },
    ],
  },
  {
    id: "q5",
    sectionId: "sec-b",
    sortOrder: 4,
    text: "Explain why introsort switches to heapsort beyond a recursion depth of 2·log n. Discuss the trade-off against pure quicksort.",
    questionType: "LONG_ANSWER",
    marks: 15,
    negativeMarks: 0,
    difficulty: "HARD",
    explanation: null,
    options: [],
  },
  {
    id: "q6",
    sectionId: "sec-b",
    sortOrder: 5,
    text: "Given a stream of integers, describe an approach to maintain the running median in O(log n) per element. State the data structures used.",
    questionType: "LONG_ANSWER",
    marks: 15,
    negativeMarks: 0,
    difficulty: "HARD",
    explanation: null,
    options: [],
  },
];

/** Question paper for an exam. */
export function getQuestions(): Question[] {
  return [...QUESTIONS].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSections(): ExamSection[] {
  return [...SECTIONS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Settings block the Teacher edits while the exam is DRAFT. */
export function getExamSettings(id: string): ExamSettings {
  const exam = getExam(id);
  return {
    instructions:
      "Answer all questions in Section A. Attempt any two from Section B. Calculators are not permitted.",
    windowEndAt: exam ? at(+new Date(exam.scheduledAt) - T0 + 30 * 60 * 1000) : null,
    resultsReleaseAt: null,
    allowReview: exam?.status === "RESULTS_RELEASED",
    shuffleQuestions: true,
    showScoreImmediately: exam?.examType === "QUIZ",
  };
}

/* ── Attempts ───────────────────────────────────────────────────────────── */

/**
 * Full roster for the ongoing exam. The live monitor and every derived
 * statistic read from this one array, so the counts can't disagree with the
 * rows — the mistake that produced phantom timetable clashes on PAGE 10.
 */
/**
 * [rosterIndex, minutesAgo, status, answeredCount, tabSwitchCount]
 *
 * The students are read from `getClassRoster()` rather than typed here. The
 * hand-written list had drifted: ROLL151 was "Meera Iyer" while the roster
 * (and the fee ledger, the hostel roll-call and global search) call her
 * "Rhea Kapoor", and "Rahul Das / ROLL164" existed nowhere else in the app.
 * A malpractice log naming a student who cannot be looked up is worse than
 * useless to an Exam Controller.
 */
const ATTEMPT_SEED: [number, number, LiveAttempt["status"], number, number][] = [
  [0, 100, "IN_PROGRESS", 4, 4],
  [1, 105, "SUBMITTED", 6, 0],
  [2, 102, "IN_PROGRESS", 5, 1],
  [3, 108, "SUBMITTED", 6, 0],
  [4, 99, "MALPRACTICE", 3, 11],
  [5, 107, "GRADED", 6, 0],
  [6, 104, "GRADED", 6, 2],
];

const ATTEMPTS: LiveAttempt[] = ATTEMPT_SEED.map(
  ([index, minutesAgo, status, answeredCount, tabSwitchCount], i) => {
    const student = getClassRoster()[index]!;
    return {
      id: `a${i + 1}`,
      studentName: student.name,
      rollNo: student.rollNo,
      startedAt: at(-minutesAgo * 60 * 1000),
      status,
      answeredCount,
      tabSwitchCount,
    };
  },
);

/** Exam Controller — live attempt monitor for an ongoing exam. */
export function getLiveAttempts(): LiveAttempt[] {
  return ATTEMPTS;
}

/** Percentages for the attempts that have been graded, keyed by attempt id. */
const GRADED_PCT: Record<string, number> = {
  a6: 84,
  a7: 58,
};

/**
 * Submission + grading roll-up — PAGE 21 "submission stats" (Teacher) and
 * "submission summary" (HOD / Principal).
 *
 * Everything is counted from the attempt rows and the exam's enrolled count,
 * so the panel can never contradict the table beside it.
 */
export function getSubmissionStats(exam: ExamSummary): SubmissionStats {
  const rows = ATTEMPTS;
  const count = (s: LiveAttempt["status"]) =>
    rows.filter((a) => a.status === s).length;

  const submitted = count("SUBMITTED");
  const graded = count("GRADED");
  const inProgress = count("IN_PROGRESS");
  const malpractice = count("MALPRACTICE");
  // Enrolled students who never opened the exam
  const notStarted = Math.max(0, exam.enrolledCount - rows.length);

  const pcts = Object.values(GRADED_PCT);
  const passPct = (exam.passingMarks / exam.totalMarks) * 100;
  const descriptivePerPaper = QUESTIONS.filter(
    (q) => q.questionType === "LONG_ANSWER" || q.questionType === "SHORT_ANSWER",
  ).length;

  return {
    enrolled: exam.enrolledCount,
    notStarted,
    inProgress,
    submitted,
    graded,
    malpractice,
    // MCQ auto-grades; only descriptive answers wait for a human (§9.2)
    pendingDescriptive: submitted * descriptivePerPaper,
    averagePercentage: pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : null,
    highestPercentage: pcts.length ? Math.max(...pcts) : null,
    lowestPercentage: pcts.length ? Math.min(...pcts) : null,
    passCount: pcts.filter((p) => p >= passPct).length,
    failCount: pcts.filter((p) => p < passPct).length,
  };
}

/** Grade histogram for the result summary — derived from the same source. */
export function getGradeBands(): GradeBand[] {
  const band = (pct: number) =>
    pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 40 ? "C" : "F";

  const counts = new Map<string, number>();
  for (const pct of Object.values(GRADED_PCT)) {
    const g = band(pct);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  return ["A+", "A", "B+", "B", "C", "F"].map((grade) => ({
    grade,
    count: counts.get(grade) ?? 0,
  }));
}

/**
 * Descriptive answers awaiting a grade — the Teacher's marking queue.
 * Only SUBMITTED attempts appear; graded ones have left the queue.
 */
export function getDescriptiveQueue(): DescriptiveAnswer[] {
  const descriptive = QUESTIONS.filter(
    (q) => q.questionType === "LONG_ANSWER" || q.questionType === "SHORT_ANSWER",
  );
  const pending = ATTEMPTS.filter((a) => a.status === "SUBMITTED");

  const BODIES: Record<string, string> = {
    q5: "Quicksort degrades to O(n²) when the pivot choice is consistently poor. Introsort tracks recursion depth and, once it passes 2·log n, switches to heapsort which is O(n log n) in the worst case. The trade-off is that heapsort has worse constant factors and poor cache locality, so you only pay that cost on the inputs that would otherwise blow up.",
    q6: "Keep two heaps — a max-heap for the lower half and a min-heap for the upper half. After each insert, rebalance so their sizes differ by at most one. The median is the max-heap root when sizes differ, or the mean of both roots when equal. Each insert is O(log n).",
  };

  return pending.flatMap((attempt) =>
    descriptive.map((q) => ({
      answerId: `${attempt.id}-${q.id}`,
      attemptId: attempt.id,
      studentName: attempt.studentName,
      rollNo: attempt.rollNo,
      questionId: q.id,
      questionText: q.text,
      maxMarks: q.marks,
      textAnswer: BODIES[q.id] ?? "",
      score: null,
      feedback: null,
      gradedByName: null,
    })),
  );
}

/** `exam_hall_allocations` — offline exams only. */
export function getHallAllocations(exam: ExamSummary): HallAllocation[] {
  if (exam.mode !== "OFFLINE") return [];

  const ROOMS: [string, string | null, number, number][] = [
    ["Hall A-101", "Arun Kumar", 30, 30],
    ["Hall A-102", "Latha Venkat", 30, 15],
    ["Hall B-204", null, 30, 0],
  ];

  return ROOMS.slice(0, Math.max(exam.hallsRequired, exam.hallsAllocated)).map(
    ([roomNo, invigilatorName, capacity, seatedCount], i) => ({
      id: `hall-${i + 1}`,
      roomNo,
      invigilatorName: i < exam.hallsAllocated ? invigilatorName : null,
      capacity,
      seatedCount: i < exam.hallsAllocated ? seatedCount : 0,
    }),
  );
}

/**
 * `malpractice_logs` for this exam — derived from the flagged attempts so the
 * controller's queue always matches the count in the header.
 */
export function getMalpracticeLogs(): MalpracticeLog[] {
  const logs: MalpracticeLog[] = [];

  for (const a of ATTEMPTS) {
    if (a.status === "MALPRACTICE") {
      logs.push({
        id: `mp-${a.id}`,
        attemptId: a.id,
        studentName: a.studentName,
        rollNo: a.rollNo,
        type: "TAB_SWITCH",
        description: `${a.tabSwitchCount} tab switches during the attempt window.`,
        loggedAt: at(-40 * 60 * 1000),
        // Open on purpose so the controller's action buttons are demoable
        actionTaken: null,
        handledByName: null,
      });
    } else if (a.tabSwitchCount > 2) {
      logs.push({
        id: `mp-${a.id}`,
        attemptId: a.id,
        studentName: a.studentName,
        rollNo: a.rollNo,
        type: "TAB_SWITCH",
        description: `${a.tabSwitchCount} tab switches — below the auto-flag threshold.`,
        loggedAt: at(-55 * 60 * 1000),
        actionTaken: "IGNORED",
        handledByName: "Deepak Iyer",
      });
    }
  }

  return logs;
}

/**
 * A student's in-progress attempt. Correct answers are deliberately absent —
 * the attempt payload must never carry the answer key.
 */
export function getAttemptSession(examId: string): AttemptSession {
  const exam = getExam(examId);
  const duration = (exam?.durationMinutes ?? 90) * 60 * 1000;

  /*
   * Unlike every other fixture in this file, the attempt window is anchored to
   * the *real* clock rather than the frozen T0. A live timer compared against
   * a pinned timestamp is always already expired, which auto-submits the paper
   * the moment it opens.
   *
   * TODO(Dev-B): the real `POST /examination/exams/:id/attempts` stamps
   * `started_at` when the student clicks Start and sets the Redis TTL from it;
   * here it's approximated at page-render time.
   */
  const startedAt = new Date().toISOString();

  return {
    attemptId: "a1",
    examId,
    startedAt,
    // Server-authoritative deadline (Redis TTL, dev doc §9.2)
    expiresAt: new Date(+new Date(startedAt) + duration).toISOString(),
    questions: getQuestions().map((q) => ({
      ...q,
      explanation: null,
      options: q.options.map((o) => ({ ...o, isCorrect: false })),
    })),
    answers: [
      { questionId: "q1", selectedOptionId: "o2", textAnswer: null },
      { questionId: "q2", selectedOptionId: "o5", textAnswer: null },
      { questionId: "q3", selectedOptionId: "o8", textAnswer: null },
      { questionId: "q4", selectedOptionId: null, textAnswer: null },
      { questionId: "q5", selectedOptionId: null, textAnswer: null },
      { questionId: "q6", selectedOptionId: null, textAnswer: null },
    ],
    tabSwitchCount: 4,
  };
}

/**
 * The student's own graded paper, shown after release when `allow_review` is
 * set. This is the only payload that may carry the correct option.
 *
 * Marks are scaled to the exam being reviewed and the per-question scores are
 * forced to sum to the recorded total, so the breakdown can never disagree
 * with the score in the header — the released exam (30 marks) and the demo
 * paper (50 marks) would otherwise tell two different stories.
 */
export function getReviewedAnswers(
  exam: ExamSummary,
  studentExam: StudentExam,
): ReviewedAnswer[] {
  const PICKED: Record<string, string | null> = {
    q1: "o2", // correct
    q2: "o5", // correct
    q3: "o10", // wrong
    q4: "o12", // correct
    q5: null,
    q6: null,
  };
  const TEXT: Record<string, string | null> = {
    q5: "Introsort watches the recursion depth and falls back to heapsort so the worst case stays O(n log n).",
    q6: "Two heaps, rebalanced after every insert.",
  };
  const FEEDBACK: Record<string, string | null> = {
    q5: "Correct mechanism, but you didn't discuss the constant-factor trade-off.",
    q6: "States the structures but not the O(log n) justification.",
  };
  /** Fraction of the question's marks the student earned. */
  const EARNED: Record<string, number> = {
    q1: 1,
    q2: 1,
    q3: 0,
    q4: 1,
    q5: 0.75,
    q6: 0.4,
  };

  const paperTotal = QUESTIONS.reduce((a, q) => a + q.marks, 0);
  const scale = exam.totalMarks / paperTotal;

  // Scale each question's marks, keeping the paper's total exact by giving
  // any rounding remainder to the last question.
  const scaled = QUESTIONS.map((q) => ({
    q,
    maxMarks: Math.round(q.marks * scale * 2) / 2,
  }));
  const scaledTotal = scaled.reduce((a, r) => a + r.maxMarks, 0);
  if (scaled.length && scaledTotal !== exam.totalMarks) {
    scaled[scaled.length - 1]!.maxMarks += exam.totalMarks - scaledTotal;
  }

  // Award marks by the earned fraction, then settle the difference against
  // the recorded score on the last question that carries any marks.
  const awarded = scaled.map((r) => ({
    ...r,
    score: Math.round(r.maxMarks * (EARNED[r.q.id] ?? 0) * 2) / 2,
  }));
  const target = studentExam.score ?? 0;
  const drift = target - awarded.reduce((a, r) => a + r.score, 0);
  if (drift !== 0) {
    const last = [...awarded].reverse().find((r) => r.score > 0);
    if (last) last.score = Math.max(0, last.score + drift);
  }

  return awarded.map(({ q, maxMarks, score }) => ({
    questionId: q.id,
    questionText: q.text,
    questionType: q.questionType,
    maxMarks,
    score,
    selectedOptionId: PICKED[q.id] ?? null,
    correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
    textAnswer: TEXT[q.id] ?? null,
    feedback: FEEDBACK[q.id] ?? null,
    explanation: q.explanation,
    options: q.options,
  }));
}

/** Detail lookup used by /examination/:id. */
export function getExam(id: string): ExamSummary | undefined {
  return EXAMS.find((e) => e.id === id);
}

/**
 * The exam as shown on the detail page, with `question_count` synced to the
 * paper actually served — otherwise the header claims 25 questions above a
 * 6-question editor. In production both come from the same row + join.
 */
export function getExamDetail(id: string): ExamSummary | undefined {
  const exam = getExam(id);
  return exam ? { ...exam, questionCount: QUESTIONS.length } : undefined;
}

export function getStudentExam(id: string): StudentExam | undefined {
  return getStudentExams().find((e) => e.id === id);
}
