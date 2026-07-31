/**
 * Fee contracts — role_based_shared_pages.md PAGE 11 (C-RB-11).
 * Mirrors `fee_structures`, `fee_heads`, `student_fee_accounts`,
 * `fee_installments`, `fee_payments`, `scholarships` and
 * `scholarship_grants` in database_design_complete.md §9.
 */

/** `fee_status` enum (DB §9.3). */
export type FeeStatus = "UNPAID" | "PARTIAL" | "PAID" | "WAIVED";

/** `installment_status` enum (DB §9.4). */
export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "WAIVED";

/** `payment_mode` enum (DB §9.5). */
export type PaymentMode = "CASH" | "ONLINE" | "CHEQUE" | "DD" | "UPI";

/** `scholarship_type` enum (DB §9.6). */
export type ScholarshipType = "PERCENTAGE" | "FIXED_AMOUNT" | "FULL_WAIVER";

/**
 * PAGE 11 gives each role a genuinely different screen — a collection desk,
 * a structure editor, a personal statement, a summary — so this is a
 * **view-kind dispatch**, like attendance and examination, not a filter.
 */
export type FeeViewKind =
  | "COLLECT" // Accountant — all accounts, search, collect, defaulters
  | "STRUCTURE" // Institution Admin — fee heads + collection summary
  | "SUMMARY" // Principal — high-level collection, read-only
  | "SELF" // Student — own account, installments, receipts
  | "CHILD" // Parent — child's account
  | "NONE";

export interface FeePermissions {
  view: FeeViewKind;
  /** Accountant — "Record payment" */
  canRecordPayment: boolean;
  /** Accountant — "apply scholarship" */
  canGrantScholarship: boolean;
  /** Accountant — "view defaulters" */
  canSeeDefaulters: boolean;
  /** Institution Admin — "Set up fee heads, installment schedule" */
  canEditStructure: boolean;
  /** Everyone with an account — "Download receipt" */
  canDownloadReceipt: boolean;
  /**
   * Whether other students' accounts are returned at all. A student must
   * never receive the class's ledger.
   */
  canSeeAllAccounts: boolean;
  note: string;
}

/* ── Structure (`fee_structures` + `fee_heads`, §9.1–9.2) ───────────────── */

export interface FeeHead {
  id: string;
  name: string;
  amount: number;
  isRefundable: boolean;
  sortOrder: number;
}

export interface FeeStructure {
  id: string;
  name: string;
  academicYear: string;
  /** Class names this structure applies to (`applicable_to`) */
  appliesTo: string[];
  heads: FeeHead[];
  /** Derived from the heads, never stored twice */
  totalAmount: number;
  isActive: boolean;
  /** Installment plan the structure seeds each account with */
  schedule: { label: string; percent: number; dueOffsetDays: number }[];
}

/* ── Account (`student_fee_accounts` + `fee_installments`, §9.3–9.4) ────── */

export interface FeeInstallment {
  id: string;
  installmentNumber: number;
  label: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: InstallmentStatus;
  lateFine: number;
}

export interface FeePayment {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionReference: string | null;
  paymentDate: string;
  collectedByName: string;
  /** Which installment it settled, if any */
  installmentLabel: string | null;
  notes: string | null;
}

export interface ScholarshipGrant {
  id: string;
  scholarshipName: string;
  type: ScholarshipType;
  amountGranted: number;
  grantedByName: string;
  grantedAt: string;
  remarks: string | null;
}

/** One student's account for the year (`student_fee_accounts`). */
export interface FeeAccount {
  id: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  academicYear: string;
  structureName: string;
  totalFee: number;
  concessionAmount: number;
  scholarshipAmount: number;
  /** total − concession − scholarship */
  netPayable: number;
  totalPaid: number;
  /** net_payable − total_paid */
  balanceDue: number;
  status: FeeStatus;
  installments: FeeInstallment[];
  payments: FeePayment[];
  grants: ScholarshipGrant[];
  /** Derived: installments past their due date and unpaid */
  overdueCount: number;
  /** Derived: total late fine across overdue installments */
  lateFineTotal: number;
}

/* ── Collection summary (Principal / Admin) ─────────────────────────────── */

export interface ClassCollection {
  className: string;
  studentCount: number;
  netPayable: number;
  collected: number;
  outstanding: number;
  /** Percentage collected */
  collectionRate: number;
  defaulters: number;
}

export interface CollectionSummary {
  netPayable: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  /** Accounts with at least one overdue installment */
  defaulters: number;
  /** Accounts fully settled */
  settled: number;
  studentCount: number;
  scholarshipTotal: number;
  concessionTotal: number;
  byClass: ClassCollection[];
  /** Collected per month, oldest first — drives the trend strip */
  monthly: { label: string; amount: number }[];
}

/** Scholarship schemes available to grant (`scholarships`, §9.6). */
export interface Scholarship {
  id: string;
  name: string;
  type: ScholarshipType;
  value: number;
  criteria: string | null;
  isActive: boolean;
}

/**
 * Everything the fee page may render.
 *
 * Sections a role isn't entitled to are **absent**, not empty — a student's
 * payload carries no other accounts and no collection totals.
 */
export interface FeeData {
  /** Accountant — every account, already scoped by the data layer */
  accounts?: FeeAccount[];
  /** Accountant / Admin / Principal — the roll-up */
  summary?: CollectionSummary;
  /** Institution Admin — the structure editor */
  structure?: FeeStructure;
  /** Accountant — schemes they can apply */
  scholarships?: Scholarship[];
  /** Student / Parent — the one account that is theirs */
  ownAccount?: FeeAccount;
}
