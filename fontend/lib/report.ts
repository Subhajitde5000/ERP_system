import type { InstitutionRole } from "@/types/auth";
import type { ReportPermissions } from "@/types/report";
import { OWN_DEPARTMENT } from "./staff-detail";

/**
 * Reports role logic — role_based_shared_pages.md PAGE 14 (C-RB-14).
 *
 * "One URL. Completely different report types per role."
 *
 * PAGE 14's stated pattern is a `<ReportSection>` per role that renders only
 * for that role. Implemented literally that is eleven near-identical
 * components, which the standing "no duplicate code" instruction rules out —
 * and it is the same mistake the docs already avoided for dashboards (§9 of
 * the shared-pages doc asks for one dynamic route, not 18 pages).
 *
 * So the matrix is a **table of section ids per role**, each section is a
 * config object of `Stat`s and `Panel`s, and the existing dashboard renderer
 * draws them. The component never names a role, and adding a report is a data
 * change.
 *
 * ── Deviations, all flagged in the README ─────────────────────────────────
 *
 * 1. PAGE 14 lists 11 role groups (12 roles with VP). **`role_based_system_
 *    design.md` §4/§5 grant a Reports row to three more**: Hostel Warden
 *    ("Occupancy and attendance reports", §5.1), Admission Officer
 *    ("Admission funnel and conversion reports", §5.5) and Academic
 *    Coordinator ("Academic calendar reports", §4.5). Every other module
 *    owner in this table got their reports, and those three own live modules
 *    with a dashboard already showing the same figures, so withholding a
 *    reports page from them looks like an omission in PAGE 14 rather than a
 *    decision. They are granted their §4/§5 row. Flip them to `denied()` if
 *    PAGE 14 is meant to be exhaustive.
 *
 * 2. The remaining 4 — Teacher's Mentor variant, Student, Parent — get a 403.
 *    §4.9/§4.10 scope Student and Parent to their own records, which the
 *    dashboard and the per-module pages already show; an analytics page over
 *    a single row is not a report. Mentor mirrors Teacher elsewhere in this
 *    app, but §2.2's mentor grant is pastoral (mentee attendance/results,
 *    which they already have on the student detail page) and carries no
 *    Reports row, so it stays out.
 *
 * 3. Every report here is read-only. §4.3 explicitly bars the Principal from
 *    managing fees, and no role's Reports row in §4/§5 grants a mutation, so
 *    the only action on this page is export.
 *
 * TODO(Dev-B): the backend must scope identically. A HOD requesting the
 * institution roll-up must 403 even though the UI never offers it — a report
 * endpoint is the easiest place to leak an aggregate over data the caller
 * cannot see row-by-row.
 */

const BASE: Omit<ReportPermissions, "sectionIds" | "note"> = {
  departmentScope: null,
  canExport: true,
};

const PERMISSIONS: Record<InstitutionRole, ReportPermissions> = {
  // "Overall stats: enrolment, fee collection, attendance, results"
  INSTITUTION_ADMIN: {
    ...BASE,
    sectionIds: ["enrolment", "fee-collection", "attendance-overview", "results-overview"],
    note: "Institution-wide statistics across every module.",
  },

  // "Academic performance: dept-wise attendance, result trends, exam pass %"
  PRINCIPAL: academicScope(),
  VICE_PRINCIPAL: academicScope(),

  // "Dept reports: teacher-wise attendance marking, subject-wise results"
  HOD: {
    ...BASE,
    sectionIds: ["teacher-marking", "subject-results"],
    departmentScope: OWN_DEPARTMENT,
    note: `Reports for the ${OWN_DEPARTMENT} department.`,
  },

  // "Own class reports: attendance summary, assignment completion rate"
  TEACHER: {
    ...BASE,
    sectionIds: ["class-attendance", "assignment-completion"],
    note: "Your classes only.",
  },

  // "Exam reports: pass %, topper list, subject analysis, malpractice summary"
  EXAM_CONTROLLER: {
    ...BASE,
    sectionIds: ["exam-performance", "toppers", "subject-analysis", "malpractice"],
    note: "Examination analytics across every department.",
  },

  // "Finance reports: daily collection, fee defaulters, scholarship summary"
  ACCOUNTANT: {
    ...BASE,
    sectionIds: ["daily-collection", "defaulters", "scholarships"],
    note: "Fee collection, arrears and concessions.",
  },

  // "Placement stats: placed %, avg package, recruiter-wise, dept-wise"
  PLACEMENT_OFFICER: {
    ...BASE,
    sectionIds: ["placement-overview", "recruiters", "placement-by-department"],
    note: "Campus placement performance for the current cycle.",
  },

  // "HR reports: headcount, leave utilization, payroll summary"
  HR_MANAGER: {
    ...BASE,
    sectionIds: ["headcount", "leave-utilisation", "payroll"],
    note: "Staff headcount, leave and payroll.",
  },

  // "Route utilization, student count per route"
  TRANSPORT_MANAGER: {
    ...BASE,
    sectionIds: ["route-utilisation"],
    note: "Route load and vehicle capacity.",
  },

  // "Book issue stats, overdue rates, most borrowed books"
  LIBRARIAN: {
    ...BASE,
    sectionIds: ["circulation", "overdue", "most-borrowed"],
    note: "Catalogue circulation and overdue returns.",
  },

  // "Stock movement report, low-stock history, vendor-wise PO report"
  STORE_MANAGER: {
    ...BASE,
    sectionIds: ["stock-movement", "low-stock", "vendor-orders"],
    note: "Stock movement, reorder levels and purchase orders.",
  },

  /* ── Not in PAGE 14, but §4/§5 grant them a Reports row (deviation 1) ─── */

  // §5.1 "Reports | Occupancy and attendance reports"
  HOSTEL_WARDEN: {
    ...BASE,
    sectionIds: ["hostel-occupancy", "hostel-attendance"],
    note: "Block occupancy and resident roll-call.",
  },

  // §5.5 "Reports | Admission funnel and conversion reports"
  ADMISSION_OFFICER: {
    ...BASE,
    sectionIds: ["admission-funnel"],
    note: "Application funnel and conversion for the current cycle.",
  },

  // §4.5 (Academic Coordinator) "Reports | Academic calendar reports"
  ACADEMIC_COORDINATOR: {
    ...BASE,
    sectionIds: ["timetable-coverage", "exam-schedule-load"],
    note: "Timetable coverage and examination scheduling.",
  },

  /* ── No Reports row anywhere in the docs ─────────────────────────────── */

  MENTOR: denied(
    "Your mentees' attendance and results are on their student records.",
  ),
  STUDENT: denied(
    "Your own attendance, results and fees are on your dashboard.",
  ),
  PARENT: denied(
    "Your child's attendance, results and fees are on your dashboard.",
  ),
};

function academicScope(): ReportPermissions {
  return {
    ...BASE,
    sectionIds: ["dept-attendance", "result-trends", "exam-pass-rate"],
    note: "Academic performance across departments.",
  };
}

function denied(reason: string): ReportPermissions {
  return {
    ...BASE,
    sectionIds: [],
    canExport: false,
    note: reason,
    deniedReason: reason,
  };
}

/**
 * Reports for a set of roles.
 *
 * Multi-role users get the **union**, in the order the sections are declared,
 * deduplicated by id — a Principal who also runs Placement sees both sets
 * rather than only the first role's. The department fence survives only when
 * every granted role carries the same one, so HOD+Principal is unfenced.
 */
export function reportPermissions(
  roles: InstitutionRole[],
): ReportPermissions {
  const granted = roles.filter((r) => !PERMISSIONS[r].deniedReason);
  if (!granted.length) return PERMISSIONS[roles[0] ?? "STUDENT"];

  const [first, ...rest] = granted;
  const base = PERMISSIONS[first!];
  if (!rest.length) return base;

  return rest.reduce<ReportPermissions>((acc, role) => {
    const next = PERMISSIONS[role];
    return {
      sectionIds: [...new Set([...acc.sectionIds, ...next.sectionIds])],
      note: "Reports across everything you can see.",
      departmentScope:
        acc.departmentScope && acc.departmentScope === next.departmentScope
          ? acc.departmentScope
          : null,
      canExport: acc.canExport || next.canExport,
    };
  }, base);
}
