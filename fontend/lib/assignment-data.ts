import type {
  AssignmentDetail,
  AssignmentProgress,
  AssignmentSummary,
  DepartmentAssignmentSummary,
  Milestone,
  StudentAssignment,
  SubmissionRow,
  SubmissionStatus,
  TeacherLoad,
  UploadPolicy,
} from "@/types/assignment";
import { getClassRoster } from "./attendance-data";

/**
 * Assignment data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 7, C-RB-07; dev doc §9.3).
 *
 *   GET   /api/v1/assignment/assignments?scope=&status=   list, auto-scoped
 *   POST  /api/v1/assignment/assignments                  create (DRAFT)
 *   PATCH /api/v1/assignment/assignments/:id/publish      DRAFT → PUBLISHED
 *   PATCH /api/v1/assignment/assignments/:id/close        PUBLISHED → CLOSED
 *   GET   /api/v1/assignment/assignments/:id/submissions  review queue
 *   POST  /api/v1/assignment/assignments/:id/submissions  student submits
 *   PATCH /api/v1/assignment/submissions/:id/review       grade + feedback
 *   POST  /api/v1/storage/presign                         attachment upload
 *
 * Approving a milestone submission unlocks the next one and notifies the
 * student (dev doc §9.3).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAYS = 24 * 60 * 60 * 1000;
/** Fixed base time so server and client render identically. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

/** The signed-in teacher, for the AUTHOR view. */
const OWN_TEACHER = "Priya Sharma";
/** The signed-in HOD's department. */
const OWN_DEPT = "CSE";

const ASSIGNMENTS: AssignmentSummary[] = [
  {
    id: "as1",
    title: "Binary Trees — Worksheet 3",
    description:
      "Implement insertion, deletion and in-order traversal for a BST. Include complexity analysis for each operation.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "FY-A",
    departmentName: "CSE",
    teacherName: OWN_TEACHER,
    type: "REGULAR",
    totalMarks: 20,
    passingMarks: 8,
    dueDate: at(1 * DAYS),
    allowLateSubmission: true,
    latePenaltyPercent: 10,
    status: "PUBLISHED",
    enrolledCount: 32,
    submittedCount: 24,
    reviewedCount: 16,
    pendingReview: 8,
    milestoneCount: 0,
  },
  {
    id: "as2",
    title: "ER Diagram Lab",
    description:
      "Model the given library system as an ER diagram, then normalise to 3NF. Submit both the diagram and the schema.",
    subjectCode: "CS305",
    subjectName: "Databases",
    className: "FY-A",
    departmentName: "CSE",
    teacherName: OWN_TEACHER,
    type: "REGULAR",
    totalMarks: 15,
    passingMarks: 6,
    dueDate: at(3 * DAYS),
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    status: "PUBLISHED",
    enrolledCount: 32,
    submittedCount: 11,
    reviewedCount: 8,
    pendingReview: 3,
    milestoneCount: 0,
  },
  {
    id: "as3",
    title: "Capstone Project — Distributed Cache",
    description:
      "Build a distributed cache with consistent hashing. Delivered in four milestones across the semester.",
    subjectCode: "CS301",
    subjectName: "Algorithms",
    className: "SY-B",
    departmentName: "CSE",
    teacherName: OWN_TEACHER,
    type: "MILESTONE",
    totalMarks: 100,
    passingMarks: 40,
    dueDate: at(30 * DAYS),
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    status: "PUBLISHED",
    enrolledCount: 28,
    submittedCount: 26,
    reviewedCount: 21,
    pendingReview: 5,
    milestoneCount: 4,
  },
  {
    id: "as4",
    title: "Process Scheduling Report",
    description:
      "Compare round-robin, SJF and priority scheduling on the supplied workload traces.",
    subjectCode: "CS307",
    subjectName: "Operating Systems",
    className: "SY-B",
    departmentName: "CSE",
    teacherName: OWN_TEACHER,
    type: "REGULAR",
    totalMarks: 25,
    passingMarks: 10,
    dueDate: at(-4 * DAYS),
    allowLateSubmission: true,
    latePenaltyPercent: 20,
    status: "CLOSED",
    enrolledCount: 28,
    submittedCount: 27,
    reviewedCount: 27,
    pendingReview: 0,
    milestoneCount: 0,
  },
  {
    id: "as5",
    title: "Sorting Algorithms — Practice Set",
    description: "Ten problems covering comparison and non-comparison sorts.",
    subjectCode: "CS201",
    subjectName: "Data Structures",
    className: "FY-A",
    departmentName: "CSE",
    teacherName: OWN_TEACHER,
    type: "REGULAR",
    totalMarks: 10,
    passingMarks: 4,
    dueDate: at(7 * DAYS),
    allowLateSubmission: true,
    latePenaltyPercent: 5,
    status: "DRAFT",
    enrolledCount: 32,
    submittedCount: 0,
    reviewedCount: 0,
    pendingReview: 0,
    milestoneCount: 0,
  },
  // Other teachers — visible to HOD and above
  {
    id: "as6",
    title: "Normalisation Case Study",
    description: "Denormalise the supplied schema and justify each decision.",
    subjectCode: "CS305",
    subjectName: "Databases",
    className: "SY-A",
    departmentName: "CSE",
    teacherName: "Arun Kumar",
    type: "REGULAR",
    totalMarks: 20,
    passingMarks: 8,
    dueDate: at(2 * DAYS),
    allowLateSubmission: true,
    latePenaltyPercent: 10,
    status: "PUBLISHED",
    enrolledCount: 30,
    submittedCount: 28,
    reviewedCount: 10,
    pendingReview: 18,
    milestoneCount: 0,
  },
  {
    id: "as7",
    title: "Signal Convolution Problems",
    description: "Twelve problems on discrete-time convolution.",
    subjectCode: "EC202",
    subjectName: "Signals & Systems",
    className: "SY-A",
    departmentName: "ECE",
    teacherName: "Meena Thomas",
    type: "REGULAR",
    totalMarks: 20,
    passingMarks: 8,
    dueDate: at(5 * DAYS),
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    status: "PUBLISHED",
    enrolledCount: 45,
    submittedCount: 19,
    reviewedCount: 19,
    pendingReview: 0,
    milestoneCount: 0,
  },
];

/** Newest-due first, but anything awaiting review floats up. */
function byUrgency(a: AssignmentSummary, b: AssignmentSummary) {
  if ((a.pendingReview > 0) !== (b.pendingReview > 0)) {
    return a.pendingReview > 0 ? -1 : 1;
  }
  return +new Date(a.dueDate) - +new Date(b.dueDate);
}

/** Teacher — only what they created. */
export function getOwnAssignments(): AssignmentSummary[] {
  return ASSIGNMENTS.filter((a) => a.teacherName === OWN_TEACHER).sort(byUrgency);
}

/** HOD — own department. */
export function getDepartmentAssignments(): AssignmentSummary[] {
  return ASSIGNMENTS.filter((a) => a.departmentName === OWN_DEPT).sort(byUrgency);
}

/** HOD — review load per teacher (PAGE 7: "pending review count per teacher"). */
export function getTeacherLoads(): TeacherLoad[] {
  const dept = ASSIGNMENTS.filter((a) => a.departmentName === OWN_DEPT);
  const byTeacher = new Map<string, TeacherLoad>();

  for (const a of dept) {
    const existing = byTeacher.get(a.teacherName);
    if (existing) {
      existing.assignmentCount += 1;
      existing.pendingReview += a.pendingReview;
      if (!existing.subjectCodes.includes(a.subjectCode)) {
        existing.subjectCodes.push(a.subjectCode);
      }
    } else {
      byTeacher.set(a.teacherName, {
        teacherId: a.teacherName.toLowerCase().replace(/\s+/g, "-"),
        teacherName: a.teacherName,
        subjectCodes: [a.subjectCode],
        assignmentCount: 1,
        pendingReview: a.pendingReview,
        oldestPendingDays: a.teacherName === "Arun Kumar" ? 9 : 3,
      });
    }
  }

  return [...byTeacher.values()].sort((x, y) => y.pendingReview - x.pendingReview);
}

/** Principal / VP — institution-wide roll-up. */
export function getInstitutionSummary(): DepartmentAssignmentSummary[] {
  return [
    { departmentId: "cse", departmentName: "CSE", assignmentCount: 24, submissionRate: 86, pendingReview: 34, overdueCount: 3 },
    { departmentId: "ece", departmentName: "ECE", assignmentCount: 18, submissionRate: 74, pendingReview: 12, overdueCount: 5 },
    { departmentId: "me", departmentName: "Mechanical", assignmentCount: 14, submissionRate: 68, pendingReview: 21, overdueCount: 8 },
    { departmentId: "civil", departmentName: "Civil", assignmentCount: 11, submissionRate: 81, pendingReview: 6, overdueCount: 2 },
    { departmentId: "com", departmentName: "Commerce", assignmentCount: 20, submissionRate: 91, pendingReview: 4, overdueCount: 1 },
  ];
}

/** Student / Parent — their own assignments with submission state. */
export function getStudentAssignments(): StudentAssignment[] {
  return [
    {
      id: "as1",
      title: "Binary Trees — Worksheet 3",
      description:
        "Implement insertion, deletion and in-order traversal for a BST. Include complexity analysis for each operation.",
      subjectCode: "CS301",
      subjectName: "Algorithms",
      teacherName: OWN_TEACHER,
      type: "REGULAR",
      totalMarks: 20,
      passingMarks: 8,
      dueDate: at(1 * DAYS),
      allowLateSubmission: true,
      latePenaltyPercent: 10,
      status: "NOT_SUBMITTED",
      score: null,
      grade: null,
      feedback: null,
      isLate: false,
      version: 1,
      files: [],
      milestones: [],
    },
    {
      id: "as2",
      title: "ER Diagram Lab",
      description:
        "Model the given library system as an ER diagram, then normalise to 3NF.",
      subjectCode: "CS305",
      subjectName: "Databases",
      teacherName: "Arun Kumar",
      type: "REGULAR",
      totalMarks: 15,
      passingMarks: 6,
      dueDate: at(3 * DAYS),
      allowLateSubmission: false,
      latePenaltyPercent: 0,
      status: "SUBMITTED",
      score: null,
      grade: null,
      feedback: null,
      isLate: false,
      version: 1,
      files: [{ id: "f1", fileName: "er_diagram_roll142.pdf", fileSizeBytes: 842_000 }],
      milestones: [],
    },
    {
      id: "as3",
      title: "Capstone Project — Distributed Cache",
      description:
        "Build a distributed cache with consistent hashing. Delivered in four milestones.",
      subjectCode: "CS301",
      subjectName: "Algorithms",
      teacherName: OWN_TEACHER,
      type: "MILESTONE",
      totalMarks: 100,
      passingMarks: 40,
      dueDate: at(30 * DAYS),
      allowLateSubmission: false,
      latePenaltyPercent: 0,
      status: "UNDER_REVIEW",
      score: null,
      grade: null,
      feedback: null,
      isLate: false,
      version: 1,
      files: [],
      milestones: [
        {
          id: "m1",
          title: "Phase 1 — Proposal",
          description: "Scope, architecture sketch and success criteria.",
          sortOrder: 1,
          marks: 20,
          dueDate: at(-20 * DAYS),
          isLocked: false,
          status: "APPROVED",
        },
        {
          id: "m2",
          title: "Phase 2 — Core implementation",
          description: "Consistent hashing ring with node add/remove.",
          sortOrder: 2,
          marks: 30,
          dueDate: at(-2 * DAYS),
          isLocked: false,
          status: "UNDER_REVIEW",
        },
        {
          id: "m3",
          title: "Phase 3 — Replication & failover",
          description: "Replica placement and failure detection.",
          sortOrder: 3,
          marks: 30,
          dueDate: at(14 * DAYS),
          isLocked: true,
          status: "NOT_SUBMITTED",
        },
        {
          id: "m4",
          title: "Phase 4 — Benchmarks & report",
          description: "Throughput/latency benchmarks with written analysis.",
          sortOrder: 4,
          marks: 20,
          dueDate: at(28 * DAYS),
          isLocked: true,
          status: "NOT_SUBMITTED",
        },
      ],
    },
    {
      id: "as4",
      title: "Process Scheduling Report",
      description:
        "Compare round-robin, SJF and priority scheduling on the supplied traces.",
      subjectCode: "CS307",
      subjectName: "Operating Systems",
      teacherName: "Neha Rathi",
      type: "REGULAR",
      totalMarks: 25,
      passingMarks: 10,
      dueDate: at(-4 * DAYS),
      allowLateSubmission: true,
      latePenaltyPercent: 20,
      status: "APPROVED",
      score: 21,
      grade: "A",
      feedback:
        "Strong comparison and clear graphs. The SJF starvation discussion could go deeper, but the analysis is sound overall.",
      isLate: false,
      version: 1,
      files: [{ id: "f2", fileName: "scheduling_report.pdf", fileSizeBytes: 1_640_000 }],
      milestones: [],
    },
    {
      id: "as8",
      title: "Recursion Practice Set",
      description: "Eight recursion problems with trace tables.",
      subjectCode: "CS201",
      subjectName: "Data Structures",
      teacherName: OWN_TEACHER,
      type: "REGULAR",
      totalMarks: 10,
      passingMarks: 4,
      dueDate: at(-9 * DAYS),
      allowLateSubmission: true,
      latePenaltyPercent: 10,
      status: "RESUBMIT_REQUESTED",
      score: null,
      grade: null,
      feedback:
        "Q4 and Q6 are missing their trace tables, and Q7's base case is wrong. Please fix those three and resubmit.",
      isLate: true,
      version: 1,
      files: [{ id: "f3", fileName: "recursion_v1.pdf", fileSizeBytes: 512_000 }],
      milestones: [],
    },
  ];
}

export function getAssignment(id: string): AssignmentSummary | undefined {
  return ASSIGNMENTS.find((a) => a.id === id);
}

export function getStudentAssignment(id: string): StudentAssignment | undefined {
  return getStudentAssignments().find((a) => a.id === id);
}

/* ── Assignment detail (PAGE 22, C-RB-22) ───────────────────────────────── */

/** `assignments.max_file_size_mb` + `allowed_file_types` (DB §7.3). */
const UPLOAD_POLICY: UploadPolicy = {
  maxFileSizeMb: 10,
  allowedFileTypes: ["pdf", "doc", "docx", "zip"],
};

/** Milestones for `as3`, the MILESTONE assignment (mirrors the student view). */
const MILESTONES: Milestone[] = [
  {
    id: "m1",
    title: "Phase 1 — Proposal & design",
    description: "Architecture diagram and hashing strategy.",
    sortOrder: 1,
    marks: 20,
    dueDate: at(-20 * DAYS),
    isLocked: false,
    status: "APPROVED",
  },
  {
    id: "m2",
    title: "Phase 2 — Core implementation",
    description: "Consistent hashing ring with node add/remove.",
    sortOrder: 2,
    marks: 30,
    dueDate: at(-2 * DAYS),
    isLocked: false,
    status: "UNDER_REVIEW",
  },
  {
    id: "m3",
    title: "Phase 3 — Replication & failover",
    description: "Replica placement and failure detection.",
    sortOrder: 3,
    marks: 30,
    dueDate: at(14 * DAYS),
    isLocked: true,
    status: "NOT_SUBMITTED",
  },
  {
    id: "m4",
    title: "Phase 4 — Benchmarks & report",
    description: "Throughput/latency benchmarks with written analysis.",
    sortOrder: 4,
    marks: 20,
    dueDate: at(28 * DAYS),
    isLocked: true,
    status: "NOT_SUBMITTED",
  },
];

/**
 * Feedback lines reused across the demo rows, so a reviewed submission always
 * carries a reason rather than an empty box.
 */
const FEEDBACK: Partial<Record<SubmissionStatus, string>> = {
  APPROVED: "Correct throughout, and the complexity analysis is well argued.",
  REJECTED:
    "Deletion case for a node with two children is wrong — revisit the successor logic.",
  RESUBMIT_REQUESTED:
    "Good start, but the traversal section is missing. Please add it and resubmit.",
};

/**
 * Build the per-student submission table for an assignment.
 *
 * The status mix is derived from the assignment's own counters so the table
 * can never disagree with the list page. The counters are **scaled to the
 * roster size** rather than used absolutely: with `reviewedCount` of 16 over a
 * 10-student sample every row would land in the reviewed band, leaving the
 * "To review" tab empty and the teacher's approve/reject flow undemoable
 * (the fixture-state trap from PAGE 19).
 */
function buildSubmissions(a: AssignmentSummary): SubmissionRow[] {
  const roster = getClassRoster();
  const n = roster.length;

  const share = (count: number) =>
    a.enrolledCount ? (count / a.enrolledCount) * n : 0;

  // Keep at least one row in each non-empty band so every state is visible
  const atLeastOne = (v: number, count: number) =>
    count > 0 ? Math.max(1, Math.round(v)) : 0;

  const reviewedRows = atLeastOne(share(a.reviewedCount), a.reviewedCount);
  const pendingRows = atLeastOne(share(a.pendingReview), a.pendingReview);

  return roster.map((student, i) => {
    const reviewed = i < reviewedRows;
    const pending = !reviewed && i < reviewedRows + pendingRows;

    // Spread the reviewed outcomes so the table shows every state the
    // teacher can act on, not a wall of APPROVED.
    let status: SubmissionStatus;
    if (reviewed) {
      status =
        i % 7 === 3 ? "REJECTED" : i % 5 === 4 ? "RESUBMIT_REQUESTED" : "APPROVED";
    } else if (pending) {
      status = i % 3 === 0 ? "UNDER_REVIEW" : "SUBMITTED";
    } else {
      status = "NOT_SUBMITTED";
    }

    const submitted = status !== "NOT_SUBMITTED";
    const isLate = submitted && i % 6 === 5;
    const scored = status === "APPROVED" || status === "REJECTED";

    // Deterministic spread of marks, never above the assignment's total
    const rawScore = Math.round(a.totalMarks * (0.55 + ((i * 7) % 40) / 100));
    const score = scored
      ? Math.min(a.totalMarks, status === "REJECTED" ? Math.round(a.passingMarks * 0.6) : rawScore)
      : null;

    return {
      submissionId: submitted ? `sub-${a.id}-${student.id}` : null,
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      milestoneId: null,
      status,
      submittedAt: submitted ? at(-(i + 1) * 6 * 60 * 60 * 1000) : null,
      isLate,
      lateByMinutes: isLate ? 90 + i * 15 : null,
      score,
      grade: score === null ? null : gradeFor(score, a.totalMarks),
      feedback: reviewed ? (FEEDBACK[status] ?? null) : null,
      reviewedByName: reviewed ? a.teacherName : null,
      reviewedAt: reviewed ? at(-(i + 1) * 3 * 60 * 60 * 1000) : null,
      version: status === "RESUBMIT_REQUESTED" || status === "REJECTED" ? 2 : 1,
      textResponse:
        submitted && i % 4 === 0
          ? "Included the optional extension in the last section."
          : null,
      files: submitted
        ? [
            {
              id: `f-${a.id}-${student.id}`,
              fileName: `${student.rollNo.toLowerCase()}-${a.id}.pdf`,
              fileSizeBytes: 240_000 + i * 31_000,
            },
          ]
        : [],
    };
  });
}

/** Same grade bands used across results and examinations. */
function gradeFor(score: number, total: number): string {
  const pct = (score / total) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 40) return "C";
  return "F";
}

/**
 * Completion roll-up — PAGE 22's "completion rate" for the HOD and the
 * summary above the Teacher's table.
 *
 * Class-level figures come from the assignment's own counters (the roster is
 * a 10-student sample of a 28–45 student class, so counting rows would
 * understate every total). Only the *shape* of the outcomes — how the
 * reviewed pile splits between approved and needs-changes — is taken from the
 * sample, then applied to the real reviewed count.
 */
function buildProgress(
  a: AssignmentSummary,
  rows: SubmissionRow[],
): AssignmentProgress {
  const reviewedRows = rows.filter((r) => r.reviewedByName);
  const approvedRows = reviewedRows.filter((r) => r.status === "APPROVED");

  const approvedShare = reviewedRows.length
    ? approvedRows.length / reviewedRows.length
    : 0;
  const approved = Math.round(a.reviewedCount * approvedShare);
  const needsChanges = a.reviewedCount - approved;

  const lateShare = rows.length
    ? rows.filter((r) => r.isLate).length / rows.length
    : 0;

  const scores = rows
    .map((r) => r.score)
    .filter((s): s is number => s !== null);

  return {
    enrolled: a.enrolledCount,
    notSubmitted: a.enrolledCount - a.submittedCount,
    submitted: a.submittedCount,
    // Awaiting the teacher, split the way the sample splits
    underReview: Math.round(
      a.pendingReview *
        (rows.filter((r) => r.status === "UNDER_REVIEW").length /
          Math.max(
            1,
            rows.filter(
              (r) => r.status === "UNDER_REVIEW" || r.status === "SUBMITTED",
            ).length,
          )),
    ),
    approved,
    rejected: needsChanges,
    resubmitRequested: rows.filter((r) => r.status === "RESUBMIT_REQUESTED")
      .length,
    late: Math.round(a.submittedCount * lateShare),
    submissionRate: a.enrolledCount
      ? Math.round((a.submittedCount / a.enrolledCount) * 100)
      : 0,
    completionRate: a.enrolledCount
      ? Math.round((approved / a.enrolledCount) * 100)
      : 0,
    pendingReview: a.pendingReview,
    averageScore: scores.length
      ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length)
      : null,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
  };
}

/**
 * Mirrors `GET /api/v1/assignment/assignments/:id` with the caller's
 * entitlements applied.
 *
 * Sections the role doesn't own are **omitted**, not hidden — a student must
 * never receive the whole class's marks and feedback in the RSC payload.
 */
export function getAssignmentDetail(
  id: string,
  opts: { canReview: boolean; canSeeProgress: boolean; isStudentSide: boolean },
): AssignmentDetail | undefined {
  const summary = getAssignment(id);
  if (!summary) return undefined;

  const milestones = summary.type === "MILESTONE" ? MILESTONES : [];
  const detail: AssignmentDetail = {
    summary,
    milestones,
    uploadPolicy: UPLOAD_POLICY,
  };

  // The per-student table is the reviewer's tool only
  const rows = buildSubmissions(summary);
  if (opts.canReview) detail.submissions = rows;
  if (opts.canSeeProgress) detail.progress = buildProgress(summary, rows);

  if (opts.isStudentSide) {
    detail.own =
      getStudentAssignment(id) ?? studentViewOf(summary, milestones);
  }

  return detail;
}

/**
 * A student's view of an assignment that isn't in their own fixture list —
 * keeps the detail page consistent for any id reachable from a deep link.
 */
function studentViewOf(
  a: AssignmentSummary,
  milestones: Milestone[],
): StudentAssignment {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    subjectCode: a.subjectCode,
    subjectName: a.subjectName,
    teacherName: a.teacherName,
    type: a.type,
    totalMarks: a.totalMarks,
    passingMarks: a.passingMarks,
    dueDate: a.dueDate,
    allowLateSubmission: a.allowLateSubmission,
    latePenaltyPercent: a.latePenaltyPercent,
    status: "NOT_SUBMITTED",
    score: null,
    grade: null,
    feedback: null,
    isLate: false,
    version: 1,
    files: [],
    milestones,
  };
}
