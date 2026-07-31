import type { StudentDetail } from "@/types/student-detail";
import { getOwnRoomId, getRoom, getOwnHostelAllotment } from "./hostel-data";
import { getOwnLoans } from "./library-data";
import { getOwnFeeAccount } from "./fee-data";

/**
 * Student detail data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with `GET /api/v1/students/:id?sections=…`.
 *
 * The backend must scope each section by the caller's role — a Teacher asking
 * for `fee` should 403 even though the UI never offers that tab. Sections:
 *
 *   profile · attendance · results · assignments · fee · enrollment
 *   notes (mentor-private) · exam-attempts · placement · library
 *   hostel · transport · admission
 *
 * Attendance / Results / Assignments reuse the existing module fixtures
 * (`getSelfAttendance`, `getStudentResults`, `getStudentAssignments`) so the
 * detail page can never disagree with those pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** This student's fee account, per the finance module (DB §9). */
const FEE_ACCOUNT = getOwnFeeAccount();

/** Books this student currently holds, per the library module (DB §8.1). */
const LIBRARY_LOANS = getOwnLoans();

/** The allotment the hostel module holds for this student (DB §8.2). */
const HOSTEL_ROOM = getRoom(getOwnRoomId())!;
const { bedNumber: HOSTEL_BED, attendancePct: HOSTEL_PCT } =
  getOwnHostelAllotment();

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAhead: number) =>
  new Date(T0 + daysAhead * DAY).toISOString().slice(0, 10);

/** The demo student every role opens. */
const ARYAN: StudentDetail = {
  summary: {
    id: "s1",
    name: "Aryan Mehta",
    rollNo: "ROLL142",
    className: "FY-BSc-A",
    departmentName: "CSE",
    email: "aryan.mehta@abc-college.edu",
    phone: "+91 98451 87890",
    admissionYear: "2024",
    status: "ENROLLED",
    attendancePct: 82,
    resultPercentage: 67,
  },

  notes: [
    {
      id: "mn1",
      body: "Attendance in CS301 has slipped to 68%. Spoke with him — he's struggling with the 9 AM slot after a long commute. Suggested he move to the afternoon lab batch.",
      authorName: "Rajiv Nair",
      createdAt: at(4),
    },
    {
      id: "mn2",
      body: "Strong on databases, weak on discrete maths. Recommended the Tuesday remedial session.",
      authorName: "Rajiv Nair",
      createdAt: at(18),
    },
  ],

  enrollment: [
    {
      academicYear: "2024-25",
      className: "FY-BSc-A",
      status: "Enrolled",
      note: "Current year",
    },
    {
      academicYear: "2024",
      className: "Admission",
      status: "Admitted",
      note: "Merit rank 42 · admitted 12 Jun 2024",
    },
  ],

  fee: {
    // Derived from the finance module so PAGE 11 and PAGE 19 can't quote
    // different totals, due dates or installment states for one account.
    totalPayable: FEE_ACCOUNT?.netPayable ?? 0,
    totalPaid: FEE_ACCOUNT?.totalPaid ?? 0,
    balance: FEE_ACCOUNT?.balanceDue ?? 0,
    installments: (FEE_ACCOUNT?.installments ?? []).map((i) => ({
      label: i.label,
      amount: i.amount,
      dueDate: i.dueDate,
      status:
        i.status === "PAID"
          ? ("PAID" as const)
          : i.status === "OVERDUE"
            ? ("OVERDUE" as const)
            : ("DUE" as const),
      paidOn:
        FEE_ACCOUNT?.payments.find((p) => p.installmentLabel === i.label)
          ?.paymentDate ?? null,
    })),
  },

  examAttempts: [
    {
      examTitle: "Mid-term Examination — Algorithms",
      subjectCode: "CS301",
      date: at(0),
      score: null,
      totalMarks: 50,
      status: "SUBMITTED",
      tabSwitchCount: 4,
      malpracticeNote: null,
    },
    {
      examTitle: "Quiz 3 — Data Structures",
      subjectCode: "CS201",
      date: at(6),
      score: 16,
      totalMarks: 20,
      status: "GRADED",
      tabSwitchCount: 0,
      malpracticeNote: null,
    },
    {
      examTitle: "Surprise Test — Algorithms",
      subjectCode: "CS301",
      date: at(21),
      score: 3,
      totalMarks: 10,
      status: "MALPRACTICE",
      tabSwitchCount: 11,
      malpracticeNote:
        "11 tab switches flagged by the proctor. Warned; marks retained.",
    },
  ],

  placement: {
    cgpa: 7.4,
    backlogs: 1,
    eligible: false,
    applications: [
      {
        company: "Infosys",
        role: "Systems Engineer",
        stage: "APPLIED",
        appliedOn: at(3),
      },
      {
        company: "TCS",
        role: "Graduate Trainee",
        stage: "REJECTED",
        appliedOn: at(30),
      },
    ],
  },

  library: {
    // Loans come from the library module so PAGE 19 and PAGE 24 can't quote
    // different accession numbers, due dates or fines for the same book.
    issued: LIBRARY_LOANS.map((l) => ({
      bookId: l.bookId,
      title: l.title,
      accessionNo: l.accessionNumber,
      issuedOn: l.issuedOn,
      dueOn: l.dueOn,
      isOverdue: l.isOverdue,
    })),
    fineOutstanding: LIBRARY_LOANS.reduce((a, l) => a + l.fineAmount, 0),
    fineHistory: [
      { reason: "Overdue — Clean Code (8 days)", amount: 40, paidOn: at(45) },
      ...LIBRARY_LOANS.filter((l) => l.isOverdue).map((l) => ({
        reason: `Overdue — ${l.title} (${l.overdueDays} days)`,
        amount: l.fineAmount,
        paidOn: null,
      })),
    ],
  },

  hostel: {
    // Room, bed and percentage come from the hostel module so PAGE 19 and
    // PAGE 23 can't tell different stories about the same allotment.
    blockName: HOSTEL_ROOM.blockName,
    roomNo: HOSTEL_ROOM.roomNumber,
    bedNo: String(HOSTEL_BED),
    allottedOn: at(300),
    attendancePct: HOSTEL_PCT,
    leaveRequests: [
      {
        fromDate: on(4),
        toDate: on(6),
        reason: "Family function",
        status: "PENDING",
      },
      {
        fromDate: on(-20),
        toDate: on(-18),
        reason: "Medical",
        status: "APPROVED",
      },
    ],
  },

  transport: {
    routeName: "R1 · Station – Campus",
    stopName: "MG Road Junction",
    pickupTime: "07:40",
    dropTime: "16:20",
    vehicleNo: "KA-01-4521",
    driverName: "Suresh Babu",
  },

  admission: {
    applicationNo: "ADM-2024-0142",
    appliedOn: at(420),
    meritRank: 42,
    status: "SHORTLISTED",
    documents: [
      { name: "Class 12 marksheet", verified: true },
      { name: "Transfer certificate", verified: true },
      { name: "Aadhaar", verified: true },
      { name: "Caste certificate", verified: false },
    ],
  },
};

/** Mirrors `GET /api/v1/students/:id`. */
export function getStudentDetail(id: string): StudentDetail | undefined {
  // Single demo record; the id is echoed so links round-trip correctly.
  return id ? { ...ARYAN, summary: { ...ARYAN.summary, id } } : undefined;
}
