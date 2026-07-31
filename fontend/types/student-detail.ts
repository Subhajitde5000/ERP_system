/**
 * Student detail contracts — role_based_shared_pages.md PAGE 19 (C-RB-19).
 *
 * Like the calendar, this page has no table of its own: it assembles records
 * from modules that already exist. Only the genuinely new sections — mentor
 * notes, library issues, hostel allotment, transport route, admission record
 * — are typed here; everything else reuses the module's own types.
 */

import type { DetailTab } from "./detail";

/** Every tab named in the PAGE 19 matrix. */
export type StudentTabKey =
  | "PROFILE"
  | "ATTENDANCE"
  | "RESULTS"
  | "ASSIGNMENTS"
  | "FEE"
  | "ENROLLMENT"
  | "NOTES"
  | "EXAM_ATTEMPTS"
  | "PLACEMENT"
  | "LIBRARY"
  | "HOSTEL"
  | "TRANSPORT"
  | "ADMISSION";

export type StudentTab = DetailTab<StudentTabKey>;

export interface StudentDetailPermissions {
  /** Tabs this role may open, in display order */
  tabs: StudentTab[];
  /** Institution Admin — edit the profile record */
  canEdit: boolean;
  /** Mentor — add private notes */
  canAddNote: boolean;
  /** Accountant — record a payment */
  canRecordPayment: boolean;
  /** Placement Officer — shortlist for a drive */
  canShortlist: boolean;
  /** Librarian — issue / return a book */
  canIssueBook: boolean;
  /** Hostel Warden — manage room allotment */
  canManageAllotment: boolean;
  /** Transport Manager — update the assigned route */
  canUpdateRoute: boolean;
  /** Admission Officer — enroll the applicant */
  canEnroll: boolean;
  /** Shown when the role has no business on this page (HR Manager) */
  deniedReason?: string;
}

/** Header summary — shown above the tabs for every role that has access. */
export interface StudentSummary {
  id: string;
  name: string;
  rollNo: string;
  className: string;
  departmentName: string;
  email: string;
  phone: string;
  admissionYear: string;
  status: "ENROLLED" | "ALUMNI" | "SUSPENDED" | "TRANSFERRED";
  attendancePct: number;
  resultPercentage: number | null;
}

/* ── Sections with no existing module ───────────────────────────────────── */

/** Mentor's private notes — visible only to the mentor who wrote them. */
export interface MentorNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface EnrollmentRecord {
  academicYear: string;
  className: string;
  status: string;
  note: string | null;
}

export interface FeeRecord {
  totalPayable: number;
  totalPaid: number;
  balance: number;
  installments: {
    label: string;
    amount: number;
    dueDate: string;
    status: "PAID" | "DUE" | "OVERDUE";
    paidOn: string | null;
  }[];
}

export interface ExamAttemptRecord {
  examTitle: string;
  subjectCode: string;
  date: string;
  score: number | null;
  totalMarks: number;
  status: "SUBMITTED" | "GRADED" | "MALPRACTICE" | "ABSENT";
  tabSwitchCount: number;
  malpracticeNote: string | null;
}

export interface PlacementRecord {
  cgpa: number;
  backlogs: number;
  eligible: boolean;
  applications: {
    company: string;
    role: string;
    stage: "APPLIED" | "SHORTLISTED" | "INTERVIEW" | "OFFER" | "REJECTED";
    appliedOn: string;
  }[];
}

export interface LibraryRecord {
  issued: {
    /** Links to the catalogue entry (PAGE 24) */
    bookId: string;
    title: string;
    accessionNo: string;
    issuedOn: string;
    dueOn: string;
    isOverdue: boolean;
  }[];
  fineOutstanding: number;
  fineHistory: { reason: string; amount: number; paidOn: string | null }[];
}

export interface HostelRecord {
  blockName: string;
  roomNo: string;
  bedNo: string;
  allottedOn: string;
  attendancePct: number;
  leaveRequests: {
    fromDate: string;
    toDate: string;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  }[];
}

export interface TransportRecord {
  routeName: string;
  stopName: string;
  pickupTime: string;
  dropTime: string;
  vehicleNo: string;
  driverName: string;
}

export interface AdmissionRecord {
  applicationNo: string;
  appliedOn: string;
  meritRank: number | null;
  status: "SUBMITTED" | "UNDER_REVIEW" | "SHORTLISTED" | "ADMITTED" | "REJECTED";
  documents: { name: string; verified: boolean }[];
}

/** Everything the detail page may render — sections load per tab. */
export interface StudentDetail {
  summary: StudentSummary;
  notes: MentorNote[];
  enrollment: EnrollmentRecord[];
  fee: FeeRecord;
  examAttempts: ExamAttemptRecord[];
  placement: PlacementRecord;
  library: LibraryRecord;
  hostel: HostelRecord;
  transport: TransportRecord;
  admission: AdmissionRecord;
}
