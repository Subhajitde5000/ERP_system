import type {
  ClassCollection,
  CollectionSummary,
  FeeAccount,
  FeeData,
  FeeInstallment,
  FeePayment,
  FeePermissions,
  FeeStructure,
  PaymentMode,
  Scholarship,
  ScholarshipGrant,
} from "@/types/fee";
import {
  lateFineFor,
  resolveFeeStatus,
  resolveInstallmentStatus,
} from "./fee";
import { getClassRoster, type RosterStudent } from "./attendance-data";

/**
 * Fee data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 11, C-RB-11; DB §9).
 *
 *   GET   /api/v1/finance/accounts?q=&status=      accountant's list
 *   GET   /api/v1/finance/accounts/:id             one account + installments
 *   POST  /api/v1/finance/payments                 record a payment
 *   GET   /api/v1/finance/payments/:id/receipt     generated PDF receipt
 *   POST  /api/v1/finance/scholarship-grants       apply a scholarship
 *   GET   /api/v1/finance/summary                  collection roll-up
 *   GET   /api/v1/finance/structures               fee heads + schedule
 *   PATCH /api/v1/finance/structures/:id           C-IA-15 structure editor
 *
 * Every figure below is derived from the structure and the payment rows —
 * `net_payable`, `balance_due`, installment status and the collection
 * summary are all computed, so the ledger can't contradict itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/** The signed-in student, matching the student-detail fixture. */
const OWN_STUDENT_ID = "s1";

const ACCOUNTANT = "Suresh Patil";
const ACADEMIC_YEAR = "2024-25";

/* ── Structure (§9.1–9.2) ───────────────────────────────────────────────── */

/**
 * The fee heads mirror the ones the Settings page (C-IA-15) already shows, so
 * the structure editor and the accounts agree on what a year costs.
 * Optional heads (hostel, transport) are billed only to the students who use
 * them, which is why an account's `totalFee` varies.
 */
const HEADS = [
  { id: "fh1", name: "Tuition fee", amount: 78000, isRefundable: false, sortOrder: 0, optional: false },
  { id: "fh2", name: "Laboratory fee", amount: 9000, isRefundable: false, sortOrder: 1, optional: false },
  { id: "fh3", name: "Library fee", amount: 3000, isRefundable: true, sortOrder: 2, optional: false },
  { id: "fh4", name: "Examination fee", amount: 6000, isRefundable: false, sortOrder: 3, optional: false },
  { id: "fh5", name: "Hostel fee", amount: 54000, isRefundable: false, sortOrder: 4, optional: true },
  { id: "fh6", name: "Transport fee", amount: 18000, isRefundable: false, sortOrder: 5, optional: true },
];

/** Two installments, 50/50 — the schedule the structure seeds accounts with. */
const SCHEDULE = [
  { label: "Term 1", percent: 50, dueOffsetDays: -120 },
  { label: "Term 2", percent: 50, dueOffsetDays: 17 },
];

const BASE_FEE = HEADS.filter((h) => !h.optional).reduce(
  (a, h) => a + h.amount,
  0,
);

export function getFeeStructure(): FeeStructure {
  // `optional` is a fixture-only flag for who gets billed the head; it is not
  // part of the `fee_heads` row the editor renders.
  const heads = HEADS.map((h) => ({
    id: h.id,
    name: h.name,
    amount: h.amount,
    isRefundable: h.isRefundable,
    sortOrder: h.sortOrder,
  }));
  return {
    id: "fs1",
    name: `General Fee — ${ACADEMIC_YEAR}`,
    academicYear: ACADEMIC_YEAR,
    appliesTo: ["FY-BSc-A", "FY-BSc-B", "SY-BSc-A", "SY-BSc-B"],
    heads,
    // Derived from the heads, never a second hand-written number
    totalAmount: heads.reduce((a, h) => a + h.amount, 0),
    isActive: true,
    schedule: SCHEDULE,
  };
}

/* ── Scholarships (§9.6) ────────────────────────────────────────────────── */

const SCHOLARSHIPS: Scholarship[] = [
  { id: "sc1", name: "Merit Scholarship", type: "PERCENTAGE", value: 25, criteria: "CGPA 9.0 and above", isActive: true },
  { id: "sc2", name: "Need-based Grant", type: "FIXED_AMOUNT", value: 20000, criteria: "Family income below ₹3L", isActive: true },
  { id: "sc3", name: "Sports Excellence", type: "FIXED_AMOUNT", value: 15000, criteria: "State-level representation", isActive: true },
  { id: "sc4", name: "Staff Ward Waiver", type: "FULL_WAIVER", value: 100, criteria: "Child of a serving staff member", isActive: true },
];

/* ── Per-student seeds ──────────────────────────────────────────────────── */

/**
 * [extra heads billed, concession, scholarship id, paid fraction of term 1,
 *  paid fraction of term 2]
 *
 * `s1` mirrors the student-detail fixture: 96,000 payable with term 1 settled
 * and term 2 outstanding. Everyone else spreads across the states the
 * accountant needs to act on — fully paid, part paid, overdue, waived.
 */
type Seed = [string[], number, string | null, number, number];

const SEEDS: Record<string, Seed> = {
  // 96,000 payable with term 1 settled — the figures student detail quotes.
  // s1 is a day scholar here; hostel/transport extras sit on s3/s5/s8.
  s1: [[], 0, null, 1, 0],
  s2: [[], 0, "sc1", 1, 1],            // merit scholarship, fully paid
  s3: [["fh5"], 0, null, 1, 0],        // hostel resident, term 2 due
  s4: [[], 5000, null, 1, 1],          // concession, settled
  s5: [["fh5", "fh6"], 0, null, 0.5, 0], // both extras, badly behind
  s6: [[], 0, "sc2", 1, 0.5],          // need-based, part paid
  s7: [[], 0, null, 0, 0],             // nothing paid — top defaulter
  s8: [["fh6"], 0, null, 1, 1],        // settled
  s9: [[], 0, "sc4", 0, 0],            // full waiver
  s10: [[], 0, null, 1, 0.25],         // part paid
};

const MODES: PaymentMode[] = ["UPI", "ONLINE", "CASH", "CHEQUE", "DD"];

/** Build one account, deriving every total from the seed. */
function buildAccount(student: RosterStudent): FeeAccount {
  const { id: studentId, name, rollNo, className } = student;
  const [extras, concession, scholarshipId, t1, t2] =
    SEEDS[studentId] ?? [[], 0, null, 0, 0];

  const extraFee = extras.reduce(
    (a, id) => a + (HEADS.find((h) => h.id === id)?.amount ?? 0),
    0,
  );
  const totalFee = BASE_FEE + extraFee;

  // Scholarship value resolves against this student's own total
  const scheme = SCHOLARSHIPS.find((s) => s.id === scholarshipId);
  const scholarshipAmount = !scheme
    ? 0
    : scheme.type === "FULL_WAIVER"
      ? totalFee - concession
      : scheme.type === "PERCENTAGE"
        ? Math.round((totalFee * scheme.value) / 100)
        : scheme.value;

  const netPayable = Math.max(0, totalFee - concession - scholarshipAmount);

  // Installments split by the structure's schedule; the last one absorbs any
  // rounding remainder so the parts always sum to the whole.
  const raw = SCHEDULE.map((s) => Math.round((netPayable * s.percent) / 100));
  const drift = netPayable - raw.reduce((a, b) => a + b, 0);
  if (raw.length) raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) + drift;

  const fractions = [t1, t2];
  const payments: FeePayment[] = [];
  const installments: FeeInstallment[] = [];
  let receiptSeq = 0;

  SCHEDULE.forEach((slot, i) => {
    const amount = raw[i] ?? 0;
    const paidAmount = Math.round(amount * (fractions[i] ?? 0));
    const dueDate = on(-slot.dueOffsetDays);

    const status = resolveInstallmentStatus(
      scheme?.type === "FULL_WAIVER" ? "WAIVED" : "PENDING",
      dueDate,
      paidAmount,
      amount,
      T0,
    );

    installments.push({
      id: `${studentId}-i${i + 1}`,
      installmentNumber: i + 1,
      label: slot.label,
      amount,
      dueDate,
      paidAmount,
      status,
      lateFine: status === "OVERDUE" ? lateFineFor(dueDate, T0) : 0,
    });

    if (paidAmount > 0) {
      receiptSeq += 1;
      payments.push({
        id: `${studentId}-p${receiptSeq}`,
        receiptNumber: `RCPT-${rollNo}-${receiptSeq}`,
        amount: paidAmount,
        paymentMode: MODES[(Number(studentId.slice(1)) + i) % MODES.length]!,
        transactionReference:
          i % 2 === 0 ? `UTR${900000 + Number(studentId.slice(1)) * 37 + i}` : null,
        // Paid a couple of days before the due date
        paymentDate: on(-slot.dueOffsetDays + 2),
        collectedByName: ACCOUNTANT,
        installmentLabel: slot.label,
        notes: null,
      });
    }
  });

  const totalPaid = installments.reduce((a, i) => a + i.paidAmount, 0);
  const grants: ScholarshipGrant[] = scheme
    ? [
        {
          id: `${studentId}-g1`,
          scholarshipName: scheme.name,
          type: scheme.type,
          amountGranted: scholarshipAmount,
          grantedByName: ACCOUNTANT,
          grantedAt: at(200),
          remarks: scheme.criteria,
        },
      ]
    : [];

  const overdue = installments.filter((i) => i.status === "OVERDUE");

  return {
    id: `fa-${studentId}`,
    studentId,
    studentName: name,
    rollNo,
    className,
    academicYear: ACADEMIC_YEAR,
    structureName: `General Fee — ${ACADEMIC_YEAR}`,
    totalFee,
    concessionAmount: concession,
    scholarshipAmount,
    netPayable,
    totalPaid,
    balanceDue: netPayable - totalPaid,
    status: resolveFeeStatus(netPayable, totalPaid),
    installments,
    payments,
    grants,
    overdueCount: overdue.length,
    lateFineTotal: overdue.reduce((a, i) => a + i.lateFine, 0),
  };
}

function allAccounts(): FeeAccount[] {
  return getClassRoster().map(buildAccount);
}

/* ── Collection summary ─────────────────────────────────────────────────── */

/**
 * Roll-up for the Principal and the Admin. Counted from the accounts, so the
 * headline can never disagree with the list beneath it.
 */
function buildSummary(accounts: FeeAccount[]): CollectionSummary {
  const netPayable = accounts.reduce((a, x) => a + x.netPayable, 0);
  const collected = accounts.reduce((a, x) => a + x.totalPaid, 0);

  const byClassMap = new Map<string, FeeAccount[]>();
  for (const a of accounts) {
    byClassMap.set(a.className, [...(byClassMap.get(a.className) ?? []), a]);
  }

  const byClass: ClassCollection[] = [...byClassMap.entries()]
    .map(([className, rows]) => {
      const payable = rows.reduce((a, x) => a + x.netPayable, 0);
      const paid = rows.reduce((a, x) => a + x.totalPaid, 0);
      return {
        className,
        studentCount: rows.length,
        netPayable: payable,
        collected: paid,
        outstanding: payable - paid,
        collectionRate: payable ? Math.round((paid / payable) * 100) : 100,
        defaulters: rows.filter((x) => x.overdueCount > 0).length,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  // Collection per calendar month, from the payment rows themselves.
  //
  // Keyed by YYYY-MM and sorted on that key, not on insertion order: the
  // label ("Aug 26") is not sortable, and `.reverse()` on a Map's insertion
  // order produced a trend line running Aug → Mar, i.e. backwards in time.
  const monthMap = new Map<string, { label: string; amount: number }>();
  for (const a of accounts) {
    for (const p of a.payments) {
      const d = new Date(p.paymentDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      const cur = monthMap.get(key);
      monthMap.set(key, { label, amount: (cur?.amount ?? 0) + p.amount });
    }
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return {
    netPayable,
    collected,
    outstanding: netPayable - collected,
    collectionRate: netPayable ? Math.round((collected / netPayable) * 100) : 100,
    defaulters: accounts.filter((a) => a.overdueCount > 0).length,
    settled: accounts.filter((a) => a.status === "PAID" || a.status === "WAIVED").length,
    studentCount: accounts.length,
    scholarshipTotal: accounts.reduce((a, x) => a + x.scholarshipAmount, 0),
    concessionTotal: accounts.reduce((a, x) => a + x.concessionAmount, 0),
    byClass,
    monthly,
  };
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * Mirrors `GET /api/v1/finance/*` with the caller's entitlements applied.
 *
 * A student receives exactly one account — their own. The class ledger, the
 * collection totals and the structure editor are absent from their payload,
 * not hidden by CSS.
 */
export function getFeeData(perms: FeePermissions): FeeData {
  const data: FeeData = {};

  if (perms.canSeeAllAccounts) {
    const accounts = allAccounts();
    data.summary = buildSummary(accounts);

    // Only the collection desk needs the row-level ledger; the Principal's
    // summary and the Admin's structure view read the roll-up alone.
    if (perms.view === "COLLECT") {
      data.accounts = accounts;
      data.scholarships = SCHOLARSHIPS.filter((s) => s.isActive);
    }
  }

  if (perms.canEditStructure) data.structure = getFeeStructure();

  if (perms.view === "SELF" || perms.view === "CHILD") {
    const student = getClassRoster().find((s) => s.id === OWN_STUDENT_ID);
    if (student) {
      data.ownAccount = buildAccount(student);
    }
  }

  return data;
}

/**
 * The signed-in student's account, so other modules (student detail) can
 * quote the same figures instead of hard-coding them.
 */
export function getOwnFeeAccount(): FeeAccount | undefined {
  const student = getClassRoster().find((s) => s.id === OWN_STUDENT_ID);
  return student ? buildAccount(student) : undefined;
}

/** One student's account, for the student-detail Fee tab (PAGE 19). */
export function getFeeAccountFor(studentId: string): FeeAccount | undefined {
  const student = getClassRoster().find((s) => s.id === studentId);
  return student ? buildAccount(student) : undefined;
}

/** Receipts across every account — used by global search (PAGE 17). */
export function getAllReceipts(): {
  receiptNumber: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  amount: number;
  paymentDate: string;
}[] {
  return allAccounts().flatMap((a) =>
    a.payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      studentId: a.studentId,
      studentName: a.studentName,
      rollNo: a.rollNo,
      amount: p.amount,
      paymentDate: p.paymentDate,
    })),
  );
}
