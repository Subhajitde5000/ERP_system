import type { InstitutionRole } from "@/types/auth";
import type { Tone } from "@/types/dashboard";
import type {
  FeePermissions,
  FeeStatus,
  FeeViewKind,
  InstallmentStatus,
  PaymentMode,
  ScholarshipType,
} from "@/types/fee";

/**
 * Fee role logic — role_based_shared_pages.md PAGE 11 (C-RB-11).
 *
 * Each role gets a genuinely different screen — a collection desk, a
 * structure editor, a personal statement, a summary — so this is a
 * **view-kind dispatch** like attendance and examination, resolved
 * server-side and dispatched once.
 *
 * ── Deviations, flagged in the README ─────────────────────────────────────
 *
 * 1. PAGE 11 names 5 roles. §6 grants Vice Principal the Principal's scope
 *    minus final approval, and the VP shares the Principal's read-only view
 *    everywhere else in this app, so the VP gets the same summary.
 *
 * 2. §4.3 says the Principal "cannot manage fees, billing" — the summary is
 *    therefore strictly read-only, with no collect or defaulter actions.
 *
 * 3. The other 12 roles get a 403. Fee data is financial and personal; a
 *    Librarian has no business in the ledger.
 *
 * TODO(Dev-B): the backend must scope identically — a student requesting
 * another student's account must 403 regardless of what the UI offers.
 */

const BASE: Omit<FeePermissions, "view" | "note"> = {
  canRecordPayment: false,
  canGrantScholarship: false,
  canSeeDefaulters: false,
  canEditStructure: false,
  canDownloadReceipt: false,
  canSeeAllAccounts: false,
};

const VIEWS: Record<InstitutionRole, FeePermissions> = {
  // §4.7 — collection, receipts, defaulters, scholarships
  ACCOUNTANT: {
    ...BASE,
    view: "COLLECT",
    canRecordPayment: true,
    canGrantScholarship: true,
    canSeeDefaulters: true,
    canDownloadReceipt: true,
    canSeeAllAccounts: true,
    note: "Every student's fee account — collect, receipt and follow up.",
  },

  // §4.2 — "Fee Structure: Define fee heads, installments"
  INSTITUTION_ADMIN: {
    ...BASE,
    view: "STRUCTURE",
    canEditStructure: true,
    canSeeDefaulters: true,
    canSeeAllAccounts: true,
    note: "Fee structure and institution-wide collection.",
  },

  // §4.3 explicitly: cannot manage fees or billing
  PRINCIPAL: summaryView(),
  VICE_PRINCIPAL: summaryView(),

  STUDENT: {
    ...BASE,
    view: "SELF",
    canDownloadReceipt: true,
    note: "Your fee account, installments and receipts.",
  },

  PARENT: {
    ...BASE,
    view: "CHILD",
    canDownloadReceipt: true,
    note: "Your child's fee account and receipts.",
  },

  // Fee data is financial and personal — no business case for the rest (§6)
  HOD: noAccess(),
  TEACHER: noAccess(),
  MENTOR: noAccess(),
  EXAM_CONTROLLER: noAccess(),
  ACADEMIC_COORDINATOR: noAccess(),
  LIBRARIAN: noAccess(),
  HOSTEL_WARDEN: noAccess(),
  TRANSPORT_MANAGER: noAccess(),
  PLACEMENT_OFFICER: noAccess(),
  HR_MANAGER: noAccess(),
  ADMISSION_OFFICER: noAccess(),
  STORE_MANAGER: noAccess(),
};

function summaryView(): FeePermissions {
  return {
    ...BASE,
    view: "SUMMARY",
    // §4.3: view all reports, but no billing controls
    canSeeAllAccounts: true,
    note: "Institution-wide fee collection — read only.",
  };
}

function noAccess(): FeePermissions {
  return {
    ...BASE,
    view: "NONE",
    note: "Fee accounts aren't part of your role.",
  };
}

/** Richest view wins for multi-role users. */
const VIEW_RANK: FeeViewKind[] = [
  "NONE",
  "CHILD",
  "SELF",
  "SUMMARY",
  "STRUCTURE",
  "COLLECT",
];

export function feePermissions(roles: InstitutionRole[]): FeePermissions {
  const [first, ...rest] = roles;
  const base = VIEWS[first ?? "STUDENT"];
  if (!rest.length) return base;

  return rest.reduce<FeePermissions>((acc, role) => {
    const next = VIEWS[role];
    const takeNext = VIEW_RANK.indexOf(next.view) > VIEW_RANK.indexOf(acc.view);

    return {
      view: takeNext ? next.view : acc.view,
      canRecordPayment: acc.canRecordPayment || next.canRecordPayment,
      canGrantScholarship:
        acc.canGrantScholarship || next.canGrantScholarship,
      canSeeDefaulters: acc.canSeeDefaulters || next.canSeeDefaulters,
      canEditStructure: acc.canEditStructure || next.canEditStructure,
      canDownloadReceipt: acc.canDownloadReceipt || next.canDownloadReceipt,
      canSeeAllAccounts: acc.canSeeAllAccounts || next.canSeeAllAccounts,
      note: takeNext ? next.note : acc.note,
    };
  }, base);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Part paid",
  PAID: "Paid",
  WAIVED: "Waived",
};

export const FEE_STATUS_TONE: Record<FeeStatus, Tone> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
  WAIVED: "muted",
};

export const INSTALLMENT_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Due",
  PAID: "Paid",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
};

export const INSTALLMENT_TONE: Record<InstallmentStatus, Tone> = {
  PENDING: "warning",
  PAID: "success",
  OVERDUE: "danger",
  WAIVED: "muted",
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  ONLINE: "Online",
  CHEQUE: "Cheque",
  DD: "Demand draft",
  UPI: "UPI",
};

export const PAYMENT_MODES: PaymentMode[] = [
  "CASH",
  "UPI",
  "ONLINE",
  "CHEQUE",
  "DD",
];

export const SCHOLARSHIP_TYPE_LABELS: Record<ScholarshipType, string> = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
  FULL_WAIVER: "Full waiver",
};

/** Collection-rate colour: the institution's health at a glance. */
export function collectionTone(rate: number): Tone {
  if (rate >= 90) return "success";
  if (rate >= 70) return "warning";
  return "danger";
}

/**
 * An installment is overdue once its due date has passed and it isn't
 * settled. Derived rather than stored, so a fixture can't claim PENDING for
 * something three weeks late.
 */
export function resolveInstallmentStatus(
  stored: InstallmentStatus,
  dueDate: string,
  paidAmount: number,
  amount: number,
  now: number,
): InstallmentStatus {
  if (stored === "WAIVED") return "WAIVED";
  if (paidAmount >= amount) return "PAID";
  return new Date(dueDate).setUTCHours(23, 59, 59, 999) < now
    ? "OVERDUE"
    : "PENDING";
}

/** `student_fee_accounts.status`, derived from the money (§9.3). */
export function resolveFeeStatus(
  netPayable: number,
  totalPaid: number,
): FeeStatus {
  if (netPayable === 0) return "WAIVED";
  if (totalPaid >= netPayable) return "PAID";
  return totalPaid > 0 ? "PARTIAL" : "UNPAID";
}

/**
 * Late fine on an overdue installment.
 * No doc states a rate, so it lives here as one constant rather than being
 * scattered through fixtures.
 * TODO(Dev-A): move to `tenant_settings` — institutions set their own.
 */
export const LATE_FINE_PER_DAY = 20;
export const LATE_FINE_CAP = 2000;

export function lateFineFor(dueDate: string, now: number): number {
  const due = new Date(dueDate).setUTCHours(23, 59, 59, 999);
  if (now <= due) return 0;
  const days = Math.floor((now - due) / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(LATE_FINE_CAP, days * LATE_FINE_PER_DAY);
}

/** Compact money for stat cards: ₹18.5L / ₹42K / ₹900. */
export function compactRupees(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${Math.round(amount / 1_000)}K`;
  return `₹${amount}`;
}
