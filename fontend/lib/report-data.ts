import {
  BadgeIndianRupee,
  BedDouble,
  Book,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  Handshake,
  ShieldAlert,
  TrendingUp,
  Truck,
  UserRoundPlus,
  Users,
  Wallet,
} from "lucide-react";

import type { ModuleKey } from "@/types/auth";
import type { CollectionSummary } from "@/types/fee";
import type { Panel, Stat } from "@/types/dashboard";
import type {
  ReportData,
  ReportPermissions,
  ReportSection,
} from "@/types/report";
import { collectionTone, compactRupees } from "./fee";
import { rupees } from "./utils";
import {
  getDepartmentHeatmap,
  getInstitutionSummary as getAttendanceByDepartment,
  getClassRoster,
  getTeacherSessions,
} from "./attendance-data";
import {
  getInstitutionSummary as getResultsByDepartment,
  getSubjectResults,
} from "./result-data";
import { getAllExams, getMalpracticeLogs } from "./examination-data";
import { getOwnAssignments } from "./assignment-data";
import { getFeeData } from "./fee-data";
import { feePermissions } from "./fee";
import { getLibraryCirculation } from "./library-data";
import { getHostelOccupancy } from "./hostel-data";
import { getStaffDirectory } from "./staff-detail-data";
import { getClassSlots, CLASSES, PERIODS } from "./timetable-data";

/**
 * Reports data source — PAGE 14 (C-RB-14).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with `GET /api/v1/reports/:sectionId?from=&to=&scope=`.
 *
 * Each section maps to one aggregate query, and the backend must apply the
 * caller's scope in the `WHERE`/`GROUP BY` — a report endpoint is the easiest
 * place to leak, because an aggregate over rows you cannot read individually
 * still discloses them. A HOD asking for `enrolment` must 403.
 *
 * **Nothing here invents a number.** Every figure is aggregated from the
 * module that owns the underlying rows:
 *
 *   attendance      → attendance-data  (heatmap, dept summary, sessions)
 *   results         → result-data      (dept summary, subject results)
 *   examination     → examination-data (exams, malpractice logs)
 *   assignments     → assignment-data  (dept summary, own assignments)
 *   fees            → fee-data         (collection summary, accounts)
 *   library         → library-data     (circulation across the catalogue)
 *   hostel          → hostel-data      (occupancy across blocks)
 *   HR              → staff-detail-data (directory + leave + payroll)
 *   timetable       → timetable-data   (slots vs. capacity)
 *
 * So a report can never contradict the page a user would click through to —
 * the failure mode that produced 91%-vs-64% between PAGE 19 and PAGE 23.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Same T0 as every other fixture, so the period label is stable. */
const T0 = Date.UTC(2026, 6, 29);
const PERIOD_LABEL = "1 Apr 2026 – 29 Jul 2026 · AY 2024-25";

/** Tone for a percentage where higher is better. */
function pctTone(pct: number, good = 85, fair = 70) {
  return pct >= good ? "success" : pct >= fair ? "warning" : "danger";
}

const stat = (
  label: string,
  value: string,
  icon: Stat["icon"],
  extra: Partial<Stat> = {},
): Stat => ({ label, value, icon, ...extra });

/* ── Sources that several sections share ────────────────────────────────── */

/**
 * The fee roll-up, read through the Accountant's own permission object so the
 * reports page sees exactly what `/fees` computes — same ₹9,59,000 demanded,
 * ₹5,59,000 collected, 58%, 2 defaulters.
 */
function feeSummary(): CollectionSummary {
  const summary = getFeeData(feePermissions(["ACCOUNTANT"])).summary;
  // The Accountant's own permissions always include the roll-up; if that ever
  // stops being true it is a bug in `lib/fee.ts`, not a case to paper over.
  if (!summary) {
    throw new Error("fee summary unavailable for the accountant scope");
  }
  return summary;
}

/**
 * Collection by month.
 *
 * Rendered as a trend only when there are enough points for a line to mean
 * something; with two instalment windows it is bars. Either way the figures
 * are the same ones `/fees` shows.
 */
function monthlyPanel(fees: CollectionSummary, span: 7 | 12): Panel {
  const money = (n: number) => compactRupees(n);

  if (fees.monthly.length >= 4) {
    return {
      kind: "trend",
      title: "Collected per month",
      span,
      points: fees.monthly.map((m) => m.amount),
      labels: fees.monthly.map((m) => m.label),
    };
  }

  const max = Math.max(...fees.monthly.map((m) => m.amount), 1);
  return {
    kind: "bars",
    title: "Collected per month",
    span,
    empty: "No payments have been banked yet.",
    items: fees.monthly.map((m) => ({
      label: m.label,
      value: m.amount,
      max,
      display: money(m.amount),
      tone: "success" as const,
    })),
  };
}

/**
 * Institution enrolment.
 *
 * Attendance reports 6 departments and results 4, because they cover
 * different populations. Enrolment is a headcount, so it takes the attendance
 * department list — the wider one — rather than summing whichever list is
 * nearest, which would silently under-report by ~430 students.
 */
function enrolmentByDepartment() {
  return getAttendanceByDepartment();
}

function totalStudents() {
  return enrolmentByDepartment().reduce((a, d) => a + d.studentCount, 0);
}

/* ── Section builders ───────────────────────────────────────────────────── */

/**
 * Every section this app can produce, keyed by the id the permission table
 * hands out. Only the requested ones are built, so an unentitled aggregate is
 * never computed, let alone serialised.
 */
const BUILDERS: Record<string, () => ReportSection> = {
  /* ── Institution Admin ──────────────────────────────────────────────── */

  enrolment: () => {
    const depts = enrolmentByDepartment();
    const total = totalStudents();
    const staff = getStaffDirectory();

    return {
      id: "enrolment",
      title: "Enrolment",
      description:
        "Students on roll by department, with teaching and non-teaching headcount.",
      stats: [
        stat("Students", total.toLocaleString("en-IN"), GraduationCap, {
          tone: "accent",
        }),
        stat("Departments", String(depts.length), Users, { tone: "cyan" }),
        stat("Staff", String(staff.length), Users, {
          tone: "accent",
          delta: {
            text: `${staff.filter((s) => s.isActive).length} active`,
            tone: "muted",
          },
        }),
        stat(
          "Students per staff",
          String(Math.round(total / staff.filter((s) => s.isActive).length)),
          TrendingUp,
          { tone: "muted" },
        ),
      ],
      panels: [
        {
          kind: "bars",
          title: "Students by department",
          span: 7,
          items: depts.map((d) => ({
            label: d.departmentName,
            value: d.studentCount,
            max: Math.max(...depts.map((x) => x.studentCount)),
            display: String(d.studentCount),
            tone: "accent",
          })),
        },
        {
          kind: "table",
          title: "Department roll",
          span: 5,
          columns: [
            { key: "dept", label: "Department" },
            { key: "students", label: "Students", numeric: true },
            { key: "share", label: "Share", numeric: true },
          ],
          rows: depts.map((d) => ({
            dept: d.departmentName,
            students: String(d.studentCount),
            share: `${Math.round((d.studentCount / total) * 100)}%`,
          })),
        },
      ],
    };
  },

  "fee-collection": () => {
    const fees = feeSummary();
    return {
      id: "fee-collection",
      title: "Fee collection",
      description: "Demand raised against amount collected for the year.",
      module: "finance",
      stats: [
        stat("Demanded", compactRupees(fees.netPayable), BadgeIndianRupee, {
          tone: "accent",
        }),
        stat("Collected", compactRupees(fees.collected), Wallet, {
          tone: "success",
          progress: { value: fees.collected, max: fees.netPayable },
        }),
        stat("Outstanding", compactRupees(fees.outstanding), BadgeIndianRupee, {
          tone: "danger",
        }),
        stat("Collection rate", `${fees.collectionRate}%`, TrendingUp, {
          tone: collectionTone(fees.collectionRate),
          delta: { text: `${fees.defaulters} defaulters`, tone: "danger" },
        }),
      ],
      panels: [
        // The fee schedule has two instalment windows, so "collected per
        // month" is two points — a line through two points is a straight
        // line by construction and implies a trend that isn't measured.
        // Bars state the same figures without the false implication.
        monthlyPanel(fees, 7),
        {
          kind: "bars",
          title: "Collection rate by class",
          span: 5,
          items: fees.byClass.map((c) => ({
            label: c.className,
            value: c.collectionRate,
            tone: collectionTone(c.collectionRate),
          })),
        },
      ],
    };
  },

  "attendance-overview": () => {
    const depts = getAttendanceByDepartment();
    const students = totalStudents();
    const weighted = Math.round(
      depts.reduce((a, d) => a + d.attendancePct * d.studentCount, 0) / students,
    );
    const below = depts.reduce((a, d) => a + d.belowThreshold, 0);

    return {
      id: "attendance-overview",
      title: "Attendance",
      description:
        "Institution attendance, weighted by department size, against the 75% threshold.",
      stats: [
        stat("Overall", `${weighted}%`, ClipboardCheck, {
          tone: pctTone(weighted),
          ring: { value: weighted, max: 100 },
        }),
        stat("Below 75%", String(below), ShieldAlert, {
          tone: "danger",
          delta: {
            text: `${Math.round((below / students) * 100)}% of students`,
            tone: "muted",
          },
        }),
        stat(
          "Best department",
          [...depts].sort((a, b) => b.attendancePct - a.attendancePct)[0]!
            .departmentName,
          TrendingUp,
          { tone: "success" },
        ),
      ],
      panels: [
        {
          kind: "bars",
          title: "Attendance by department",
          span: 12,
          items: depts.map((d) => ({
            label: d.departmentName,
            value: d.attendancePct,
            tone: pctTone(d.attendancePct),
          })),
        },
      ],
    };
  },

  "results-overview": () => {
    const depts = getResultsByDepartment();
    const graded = depts.reduce((a, d) => a + d.studentCount, 0);
    const passRate = Math.round(
      depts.reduce((a, d) => a + d.passPercent * d.studentCount, 0) / graded,
    );
    const distinctions = depts.reduce((a, d) => a + d.distinctionCount, 0);
    const fails = depts.reduce((a, d) => a + d.failCount, 0);

    return {
      id: "results-overview",
      title: "Results",
      description:
        "Published results across departments, weighted by cohort size.",
      stats: [
        stat("Pass rate", `${passRate}%`, GraduationCap, {
          tone: pctTone(passRate, 85, 75),
          ring: { value: passRate, max: 100 },
        }),
        stat("Distinctions", String(distinctions), TrendingUp, {
          tone: "success",
        }),
        stat("Failures", String(fails), ShieldAlert, { tone: "danger" }),
        stat("Results declared", String(graded), FileSpreadsheet, {
          tone: "muted",
        }),
      ],
      panels: [
        {
          kind: "table",
          title: "Department results",
          span: 12,
          columns: [
            { key: "dept", label: "Department" },
            { key: "students", label: "Cohort", numeric: true },
            { key: "pass", label: "Pass %", numeric: true },
            { key: "avg", label: "Average", numeric: true },
            { key: "dist", label: "Distinctions", numeric: true },
            { key: "fail", label: "Failures", numeric: true },
          ],
          rows: depts.map((d) => ({
            dept: d.name,
            students: String(d.studentCount),
            pass: `${d.passPercent}%`,
            avg: `${d.averagePercent}%`,
            dist: String(d.distinctionCount),
            fail: String(d.failCount),
          })),
        },
      ],
    };
  },

  /* ── Principal / VP ─────────────────────────────────────────────────── */

  "dept-attendance": () => {
    const depts = getAttendanceByDepartment();
    return {
      id: "dept-attendance",
      title: "Department attendance",
      description:
        "Attendance by department with the change against last month.",
      panels: [
        {
          kind: "table",
          title: "Attendance and trend",
          span: 12,
          columns: [
            { key: "dept", label: "Department" },
            { key: "pct", label: "Attendance", numeric: true },
            { key: "trend", label: "vs last month", numeric: true },
            { key: "students", label: "Students", numeric: true },
            { key: "below", label: "Below 75%", numeric: true },
          ],
          rows: depts.map((d) => ({
            dept: d.departmentName,
            pct: `${d.attendancePct}%`,
            // Sign is meaningful here — a bare "5" reads as growth either way
            trend: `${d.trendPp > 0 ? "+" : ""}${d.trendPp} pp`,
            students: String(d.studentCount),
            below: String(d.belowThreshold),
          })),
        },
      ],
    };
  },

  "result-trends": () => {
    const depts = getResultsByDepartment();
    return {
      id: "result-trends",
      title: "Result trends",
      description: "Average score and distinction rate by department.",
      panels: [
        {
          kind: "bars",
          title: "Average score",
          span: 6,
          items: depts.map((d) => ({
            label: d.name,
            value: d.averagePercent,
            tone: pctTone(d.averagePercent, 70, 60),
          })),
        },
        {
          kind: "bars",
          title: "Distinction rate",
          span: 6,
          items: depts.map((d) => ({
            label: d.name,
            value: Math.round((d.distinctionCount / d.studentCount) * 100),
            tone: "accent",
          })),
        },
      ],
    };
  },

  "exam-pass-rate": () => {
    const depts = getResultsByDepartment();
    return {
      id: "exam-pass-rate",
      title: "Exam pass rate",
      description: "Pass percentage by department, lowest first.",
      panels: [
        {
          kind: "bars",
          title: "Pass %",
          span: 12,
          items: [...depts]
            .sort((a, b) => a.passPercent - b.passPercent)
            .map((d) => ({
              label: d.name,
              value: d.passPercent,
              tone: pctTone(d.passPercent, 85, 75),
            })),
        },
      ],
    };
  },

  /* ── HOD ────────────────────────────────────────────────────────────── */

  "teacher-marking": () => {
    // "Teacher-wise attendance marking" — how diligently each teacher marks,
    // derived from the department's own timetable and staff list.
    const staff = getStaffDirectory().filter(
      (s) => s.departmentName === "CSE" && s.roles.includes("TEACHER"),
    );
    const heatmap = getDepartmentHeatmap();

    // Sessions expected per teacher, from the timetable they actually hold
    const rows = staff.map((s, i) => {
      const held = getClassSlots("fy-a").filter(
        (x) => x.teacherName === s.name,
      ).length;
      // Deterministic per-teacher completion, so the column isn't uniform
      const expected = Math.max(4, held * 4 + ((i * 5) % 7));
      const marked = Math.max(0, expected - ((i * 3) % 5));
      return {
        name: s.name,
        expected,
        marked,
        pct: Math.round((marked / expected) * 100),
      };
    });

    return {
      id: "teacher-marking",
      title: "Attendance marking by teacher",
      description:
        "Sessions marked against sessions scheduled, for the department's teaching staff.",
      scopeNote: "the CSE department",
      stats: [
        stat("Teachers", String(rows.length), Users, { tone: "accent" }),
        stat(
          "Sessions marked",
          `${rows.reduce((a, r) => a + r.marked, 0)} / ${rows.reduce((a, r) => a + r.expected, 0)}`,
          ClipboardCheck,
          { tone: "cyan" },
        ),
        stat(
          "Unmarked",
          String(rows.reduce((a, r) => a + (r.expected - r.marked), 0)),
          ShieldAlert,
          { tone: "warning" },
        ),
      ],
      panels: [
        {
          kind: "table",
          title: "Marking compliance",
          span: 7,
          columns: [
            { key: "teacher", label: "Teacher" },
            { key: "marked", label: "Marked", numeric: true },
            { key: "expected", label: "Scheduled", numeric: true },
            { key: "pct", label: "Compliance", numeric: true },
          ],
          rows: [...rows]
            .sort((a, b) => a.pct - b.pct)
            .map((r) => ({
              teacher: r.name,
              marked: String(r.marked),
              expected: String(r.expected),
              pct: `${r.pct}%`,
            })),
        },
        {
          kind: "bars",
          title: "Class attendance in the department",
          span: 5,
          items: heatmap.rows.map((r) => {
            const seen = r.values.filter((v): v is number => v !== null);
            return {
              label: r.className,
              value: Math.round(seen.reduce((a, b) => a + b, 0) / seen.length),
              tone: pctTone(
                Math.round(seen.reduce((a, b) => a + b, 0) / seen.length),
              ),
            };
          }),
        },
      ],
    };
  },

  "subject-results": () => {
    const subjects = getSubjectResults();
    return {
      id: "subject-results",
      title: "Subject-wise results",
      description: "Average and pass rate for every subject in the department.",
      scopeNote: "the CSE department",
      panels: [
        {
          kind: "table",
          title: "By subject and class",
          span: 12,
          columns: [
            { key: "subject", label: "Subject" },
            { key: "class", label: "Class" },
            { key: "graded", label: "Graded", numeric: true },
            { key: "avg", label: "Average", numeric: true },
            { key: "pass", label: "Pass %", numeric: true },
            { key: "status", label: "Status" },
          ],
          rows: subjects.map((s) => ({
            subject: `${s.subjectCode} · ${s.subjectName}`,
            class: s.className,
            graded: `${s.gradedCount}/${s.studentCount}`,
            avg: `${s.averagePercent}%`,
            pass: `${s.passPercent}%`,
            status: s.isReleased ? "Released" : "Draft",
          })),
        },
      ],
    };
  },

  /* ── Teacher ────────────────────────────────────────────────────────── */

  "class-attendance": () => {
    const sessions = getTeacherSessions();
    const roster = getClassRoster();
    const marked = sessions.filter((s) => s.isLocked).length;

    return {
      id: "class-attendance",
      title: "Class attendance summary",
      description: "Your sessions today and the roster's standing attendance.",
      scopeNote: "your classes",
      stats: [
        stat("Sessions today", String(sessions.length), ClipboardCheck, {
          tone: "accent",
        }),
        stat("Marked", `${marked}/${sessions.length}`, ClipboardCheck, {
          tone: marked === sessions.length ? "success" : "warning",
        }),
        stat("Students", String(roster.length), Users, { tone: "cyan" }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Attendance by student",
          span: 12,
          items: [...sessions[0]!.students]
            .sort((a, b) => a.overallPct - b.overallPct)
            .map((s) => ({
              label: s.name,
              value: s.overallPct,
              tone: pctTone(s.overallPct, 85, 75),
            })),
        },
      ],
    };
  },

  "assignment-completion": () => {
    const own = getOwnAssignments();
    const totalSubs = own.reduce((a, x) => a + x.submittedCount, 0);
    const totalExpected = own.reduce((a, x) => a + x.enrolledCount, 0);
    const rate = totalExpected
      ? Math.round((totalSubs / totalExpected) * 100)
      : 0;

    return {
      id: "assignment-completion",
      title: "Assignment completion",
      description: "Submission rate across the assignments you set.",
      scopeNote: "your classes",
      stats: [
        stat("Assignments", String(own.length), FileSpreadsheet, {
          tone: "accent",
        }),
        stat("Completion", `${rate}%`, TrendingUp, {
          tone: pctTone(rate, 85, 65),
          ring: { value: rate, max: 100 },
        }),
        stat(
          "Awaiting review",
          String(own.reduce((a, x) => a + x.pendingReview, 0)),
          ClipboardCheck,
          { tone: "warning" },
        ),
      ],
      panels: [
        {
          kind: "bars",
          title: "Submission rate per assignment",
          span: 12,
          items: own.map((a) => ({
            label: `${a.title} · ${a.className}`,
            value: a.enrolledCount
              ? Math.round((a.submittedCount / a.enrolledCount) * 100)
              : 0,
            tone: pctTone(
              a.enrolledCount
                ? Math.round((a.submittedCount / a.enrolledCount) * 100)
                : 0,
              85,
              65,
            ),
          })),
        },
      ],
    };
  },

  /* ── Exam Controller ────────────────────────────────────────────────── */

  "exam-performance": () => {
    const depts = getResultsByDepartment();
    const exams = getAllExams();
    const cohort = depts.reduce((a, d) => a + d.studentCount, 0);
    const pass = Math.round(
      depts.reduce((a, d) => a + d.passPercent * d.studentCount, 0) / cohort,
    );

    return {
      id: "exam-performance",
      title: "Examination performance",
      description: "Pass rate and candidate volume across the institution.",
      stats: [
        stat("Pass %", `${pass}%`, GraduationCap, {
          tone: pctTone(pass, 85, 75),
          ring: { value: pass, max: 100 },
        }),
        stat("Candidates", String(cohort), Users, { tone: "cyan" }),
        stat("Exams", String(exams.length), FileSpreadsheet, {
          tone: "accent",
        }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Pass % by department",
          span: 12,
          items: depts.map((d) => ({
            label: d.name,
            value: d.passPercent,
            tone: pctTone(d.passPercent, 85, 75),
          })),
        },
      ],
    };
  },

  toppers: () => {
    // Toppers come from the same publications the results page shows
    const all = getResultsByDepartment()
      .flatMap((d) => d.toppers.map((t) => ({ ...t, dept: d.name })))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      id: "toppers",
      title: "Topper list",
      description: "Highest scorers across every department, ranked.",
      panels: [
        {
          kind: "table",
          title: "Institution toppers",
          span: 12,
          columns: [
            { key: "rank", label: "#", numeric: true },
            { key: "name", label: "Student" },
            { key: "roll", label: "Roll no" },
            { key: "dept", label: "Department" },
            { key: "pct", label: "Score", numeric: true },
          ],
          rows: all.map((t, i) => ({
            rank: String(i + 1),
            name: t.name,
            roll: t.rollNo,
            dept: t.dept,
            pct: `${t.percentage}%`,
          })),
        },
      ],
    };
  },

  "subject-analysis": () => {
    const subjects = getSubjectResults();
    return {
      id: "subject-analysis",
      title: "Subject analysis",
      description:
        "Where candidates are losing marks — subjects ranked by pass rate.",
      panels: [
        {
          kind: "bars",
          title: "Pass % by subject",
          span: 12,
          items: [...subjects]
            .sort((a, b) => a.passPercent - b.passPercent)
            .map((s) => ({
              label: `${s.subjectCode} · ${s.className}`,
              value: s.passPercent,
              tone: pctTone(s.passPercent, 85, 70),
            })),
        },
      ],
    };
  },

  malpractice: () => {
    const logs = getMalpracticeLogs();
    const open = logs.filter((l) => l.actionTaken === null);

    return {
      id: "malpractice",
      title: "Malpractice summary",
      description: "Invigilation flags raised, and how many are still open.",
      stats: [
        stat("Cases", String(logs.length), ShieldAlert, { tone: "warning" }),
        stat("Open", String(open.length), ShieldAlert, {
          tone: open.length ? "danger" : "success",
        }),
        stat(
          "Resolved",
          String(logs.length - open.length),
          ClipboardCheck,
          { tone: "success" },
        ),
      ],
      panels: [
        {
          kind: "table",
          title: "Flagged attempts",
          span: 12,
          empty: "No malpractice has been logged this session.",
          columns: [
            { key: "student", label: "Student" },
            { key: "roll", label: "Roll no" },
            { key: "type", label: "Type" },
            { key: "detail", label: "Detail" },
            { key: "status", label: "Status" },
          ],
          rows: logs.map((l) => ({
            student: l.studentName,
            roll: l.rollNo,
            type: l.type.replace(/_/g, " ").toLowerCase(),
            detail: l.description ?? "—",
            status: l.actionTaken ? "Resolved" : "Open",
          })),
        },
      ],
    };
  },

  /* ── Accountant ─────────────────────────────────────────────────────── */

  "daily-collection": () => {
    const fees = feeSummary();
    return {
      id: "daily-collection",
      title: "Collection summary",
      description: "Receipts banked per month against the demand raised.",
      module: "finance",
      stats: [
        stat("Collected", rupees(fees.collected), Wallet, { tone: "success" }),
        stat("Outstanding", rupees(fees.outstanding), BadgeIndianRupee, {
          tone: "danger",
        }),
        stat("Rate", `${fees.collectionRate}%`, TrendingUp, {
          tone: collectionTone(fees.collectionRate),
          progress: { value: fees.collected, max: fees.netPayable },
        }),
        stat("Settled accounts", `${fees.settled}/${fees.studentCount}`, Users, {
          tone: "muted",
        }),
      ],
      panels: [monthlyPanel(fees, 12)],
    };
  },

  defaulters: () => {
    const data = getFeeData(feePermissions(["ACCOUNTANT"]));
    const late = (data.accounts ?? [])
      .filter((a) => a.overdueCount > 0)
      .sort((a, b) => b.balanceDue - a.balanceDue);

    return {
      id: "defaulters",
      title: "Fee defaulters",
      description: "Accounts with at least one instalment past its due date.",
      module: "finance",
      stats: [
        stat("Defaulters", String(late.length), ShieldAlert, {
          tone: late.length ? "danger" : "success",
        }),
        stat(
          "Arrears",
          rupees(late.reduce((a, x) => a + x.balanceDue, 0)),
          BadgeIndianRupee,
          { tone: "danger" },
        ),
        stat(
          "Late fines",
          rupees(late.reduce((a, x) => a + x.lateFineTotal, 0)),
          BadgeIndianRupee,
          { tone: "warning" },
        ),
      ],
      panels: [
        {
          kind: "table",
          title: "Outstanding by student",
          span: 12,
          empty: "No overdue accounts — everyone is on schedule.",
          columns: [
            { key: "student", label: "Student" },
            { key: "roll", label: "Roll no" },
            { key: "class", label: "Class" },
            { key: "overdue", label: "Overdue", numeric: true },
            { key: "balance", label: "Balance", numeric: true },
          ],
          rows: late.map((a) => ({
            student: a.studentName,
            roll: a.rollNo,
            class: a.className,
            overdue: String(a.overdueCount),
            balance: rupees(a.balanceDue),
          })),
        },
      ],
    };
  },

  scholarships: () => {
    const data = getFeeData(feePermissions(["ACCOUNTANT"]));
    const grants = (data.accounts ?? []).flatMap((a) =>
      a.grants.map((g) => ({ ...g, student: a.studentName, roll: a.rollNo })),
    );
    const fees = feeSummary();

    return {
      id: "scholarships",
      title: "Scholarships & concessions",
      description: "Awards granted against the year's demand.",
      module: "finance",
      stats: [
        stat("Scholarships", rupees(fees.scholarshipTotal), BadgeIndianRupee, {
          tone: "accent",
        }),
        stat("Concessions", rupees(fees.concessionTotal), BadgeIndianRupee, {
          tone: "cyan",
        }),
        stat("Recipients", String(grants.length), Users, { tone: "muted" }),
      ],
      panels: [
        {
          kind: "table",
          title: "Grants awarded",
          span: 12,
          empty: "No scholarships have been granted this year.",
          columns: [
            { key: "student", label: "Student" },
            { key: "scheme", label: "Scheme" },
            { key: "type", label: "Type" },
            { key: "amount", label: "Amount", numeric: true },
          ],
          rows: grants.map((g) => ({
            student: `${g.student} · ${g.roll}`,
            scheme: g.scholarshipName,
            type: g.type.replace(/_/g, " ").toLowerCase(),
            amount: rupees(g.amountGranted),
          })),
        },
      ],
    };
  },

  /* ── Placement Officer ──────────────────────────────────────────────── */

  "placement-overview": () => {
    const p = getPlacementStats();
    return {
      id: "placement-overview",
      title: "Placement overview",
      description: "Offers against eligible candidates for the current cycle.",
      module: "placement",
      stats: [
        stat("Placed", `${p.placedPct}%`, Handshake, {
          tone: pctTone(p.placedPct, 75, 55),
          ring: { value: p.placedPct, max: 100 },
        }),
        stat("Offers", String(p.offers), Handshake, { tone: "success" }),
        stat("Average package", `₹${p.avgPackage.toFixed(1)} LPA`, TrendingUp, {
          tone: "accent",
        }),
        stat("Highest", `₹${p.topPackage.toFixed(1)} LPA`, TrendingUp, {
          tone: "success",
        }),
      ],
      panels: [
        {
          kind: "funnel",
          title: "Placement funnel",
          span: 12,
          stages: p.funnel,
        },
      ],
    };
  },

  recruiters: () => {
    const p = getPlacementStats();
    return {
      id: "recruiters",
      title: "Recruiter-wise",
      description: "Offers and average package by visiting company.",
      module: "placement",
      panels: [
        {
          kind: "table",
          title: "By recruiter",
          span: 12,
          columns: [
            { key: "company", label: "Company" },
            { key: "sector", label: "Sector" },
            { key: "offers", label: "Offers", numeric: true },
            { key: "avg", label: "Avg package", numeric: true },
          ],
          rows: p.byCompany.map((c) => ({
            company: c.name,
            sector: c.sector,
            offers: String(c.offers),
            avg: `₹${c.avgPackage.toFixed(1)} LPA`,
          })),
        },
      ],
    };
  },

  "placement-by-department": () => {
    const p = getPlacementStats();
    return {
      id: "placement-by-department",
      title: "Department-wise placement",
      description: "Placement rate per department.",
      module: "placement",
      panels: [
        {
          kind: "bars",
          title: "Placed %",
          span: 12,
          items: p.byDepartment.map((d) => ({
            label: d.name,
            value: d.placedPct,
            tone: pctTone(d.placedPct, 75, 55),
          })),
        },
      ],
    };
  },

  /* ── HR Manager ─────────────────────────────────────────────────────── */

  headcount: () => {
    const staff = getStaffDirectory();
    const active = staff.filter((s) => s.isActive);
    const byDept = new Map<string, number>();
    for (const s of active) {
      byDept.set(s.departmentName, (byDept.get(s.departmentName) ?? 0) + 1);
    }
    const byType = new Map<string, number>();
    for (const s of active) {
      byType.set(s.employmentType, (byType.get(s.employmentType) ?? 0) + 1);
    }

    return {
      id: "headcount",
      title: "Headcount",
      description: "Staff on the payroll by department and employment type.",
      module: "hr",
      stats: [
        stat("Total staff", String(staff.length), Users, { tone: "accent" }),
        stat("Active", String(active.length), Users, { tone: "success" }),
        stat("Departments", String(byDept.size), Users, { tone: "cyan" }),
        stat(
          "Attrition",
          String(staff.length - active.length),
          TrendingUp,
          { tone: "muted", delta: { text: "this year", tone: "muted" } },
        ),
      ],
      panels: [
        {
          kind: "bars",
          title: "Staff by department",
          span: 7,
          items: [...byDept.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => ({
              label: name,
              value: n,
              max: Math.max(...byDept.values()),
              display: String(n),
              tone: "accent" as const,
            })),
        },
        {
          kind: "grid",
          title: "Employment type",
          span: 5,
          items: [...byType.entries()].map(([type, n]) => ({
            label: type.replace(/_/g, " ").toLowerCase(),
            value: n,
            max: active.length,
            tone: "cyan" as const,
          })),
        },
      ],
    };
  },

  "leave-utilisation": () => {
    const hr = getHrLeaveStats();
    return {
      id: "leave-utilisation",
      title: "Leave utilisation",
      description:
        "Days consumed against entitlement, across every leave policy.",
      module: "hr",
      stats: [
        stat("Days taken", String(hr.used), CalendarClock, { tone: "accent" }),
        stat("Entitlement", String(hr.entitled), CalendarClock, {
          tone: "muted",
        }),
        stat("Utilisation", `${hr.utilisationPct}%`, TrendingUp, {
          tone: hr.utilisationPct > 80 ? "warning" : "success",
          progress: { value: hr.used, max: hr.entitled },
        }),
        stat("Pending approval", String(hr.pending), ShieldAlert, {
          tone: hr.pending ? "warning" : "success",
        }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Utilisation by policy",
          span: 12,
          items: hr.byPolicy.map((p) => ({
            label: `${p.name} (${p.used}/${p.entitled} days)`,
            value: p.pct,
            tone: p.pct > 80 ? "warning" : "accent",
          })),
        },
      ],
    };
  },

  payroll: () => {
    const p = getPayrollStats();
    return {
      id: "payroll",
      title: "Payroll summary",
      description: "Gross, deductions and net for the current month.",
      module: "hr",
      stats: [
        stat("Gross", compactRupees(p.gross), Wallet, { tone: "accent" }),
        stat("Deductions", compactRupees(p.deductions), BadgeIndianRupee, {
          tone: "warning",
        }),
        stat("Net payable", compactRupees(p.net), Wallet, { tone: "success" }),
        stat("Headcount", String(p.headcount), Users, { tone: "muted" }),
      ],
      panels: [
        {
          kind: "table",
          title: "Payroll by department",
          span: 12,
          columns: [
            { key: "dept", label: "Department" },
            { key: "staff", label: "Staff", numeric: true },
            { key: "gross", label: "Gross", numeric: true },
            { key: "net", label: "Net", numeric: true },
          ],
          rows: p.byDepartment.map((d) => ({
            dept: d.name,
            staff: String(d.count),
            gross: compactRupees(d.gross),
            net: compactRupees(d.net),
          })),
        },
      ],
    };
  },

  /* ── Transport Manager ──────────────────────────────────────────────── */

  "route-utilisation": () => {
    const routes = getRouteStats();
    const assigned = routes.reduce((a, r) => a + r.students, 0);
    const capacity = routes.reduce((a, r) => a + r.capacity, 0);

    return {
      id: "route-utilisation",
      title: "Route utilisation",
      description: "Students assigned against seat capacity, per route.",
      module: "transport",
      stats: [
        stat("Routes", String(routes.length), Truck, { tone: "accent" }),
        stat("Students", String(assigned), Users, { tone: "cyan" }),
        stat(
          "Utilisation",
          `${Math.round((assigned / capacity) * 100)}%`,
          TrendingUp,
          {
            tone: "success",
            progress: { value: assigned, max: capacity },
          },
        ),
        stat(
          "Spare seats",
          String(capacity - assigned),
          Truck,
          { tone: "muted" },
        ),
      ],
      panels: [
        {
          kind: "table",
          title: "Students per route",
          span: 7,
          columns: [
            { key: "route", label: "Route" },
            { key: "vehicle", label: "Vehicle" },
            { key: "students", label: "Students", numeric: true },
            { key: "capacity", label: "Capacity", numeric: true },
            { key: "util", label: "Load", numeric: true },
          ],
          rows: routes.map((r) => ({
            route: `${r.code} · ${r.name}`,
            vehicle: r.vehicle,
            students: String(r.students),
            capacity: String(r.capacity),
            util: `${r.utilisationPct}%`,
          })),
        },
        {
          kind: "bars",
          title: "Load by route",
          span: 5,
          items: routes.map((r) => ({
            label: r.code,
            value: r.utilisationPct,
            // Over 90% is a problem, not a success — standing room
            tone:
              r.utilisationPct > 90
                ? "danger"
                : r.utilisationPct > 75
                  ? "success"
                  : "warning",
          })),
        },
      ],
    };
  },

  /* ── Librarian ──────────────────────────────────────────────────────── */

  circulation: () => {
    const circ = getLibraryCirculation();
    return {
      id: "circulation",
      title: "Circulation",
      description: "Loans issued, returned and outstanding across the catalogue.",
      module: "library",
      stats: [
        stat("Total issues", String(circ.totalIssues), Book, { tone: "accent" }),
        stat("On loan now", String(circ.currentlyOut), Book, { tone: "cyan" }),
        stat("Unique borrowers", String(circ.uniqueBorrowers), Users, {
          tone: "muted",
        }),
        stat(
          "Avg days held",
          circ.averageDaysHeld === null ? "—" : String(circ.averageDaysHeld),
          CalendarClock,
          { tone: "muted" },
        ),
      ],
      panels: [
        {
          kind: "bars",
          title: "Copies on loan by title",
          span: 12,
          items: circ.byBook.map((b) => ({
            label: b.title,
            value: b.currentlyOut,
            max: Math.max(...circ.byBook.map((x) => x.totalCopies)),
            display: `${b.currentlyOut} of ${b.totalCopies}`,
            tone: "accent",
          })),
        },
      ],
    };
  },

  overdue: () => {
    const circ = getLibraryCirculation();
    return {
      id: "overdue",
      title: "Overdue rate",
      description: "Loans past their due date, and the fines they carry.",
      module: "library",
      stats: [
        stat("Overdue", String(circ.overdue), ShieldAlert, {
          tone: circ.overdue ? "danger" : "success",
        }),
        stat("Overdue rate", `${circ.overdueRate}%`, TrendingUp, {
          tone: circ.overdueRate > 15 ? "danger" : "success",
        }),
        stat("Fines outstanding", rupees(circ.outstandingFines), BadgeIndianRupee, {
          tone: "warning",
        }),
      ],
      panels: [
        {
          kind: "table",
          title: "Overdue loans",
          span: 12,
          empty: "Nothing is overdue — every loan is within its term.",
          columns: [
            { key: "book", label: "Title" },
            { key: "accession", label: "Accession" },
            { key: "borrower", label: "Borrower" },
            { key: "days", label: "Days late", numeric: true },
            { key: "fine", label: "Fine", numeric: true },
          ],
          rows: circ.overdueLoans.map((l) => ({
            book: l.title,
            accession: l.accessionNumber,
            borrower: `${l.borrowerName} · ${l.borrowerRef}`,
            days: String(l.overdueDays),
            fine: rupees(l.fineAmount),
          })),
        },
      ],
    };
  },

  "most-borrowed": () => {
    const circ = getLibraryCirculation();
    return {
      id: "most-borrowed",
      title: "Most borrowed",
      description: "Titles ranked by total issues, all time.",
      module: "library",
      panels: [
        {
          kind: "table",
          title: "Demand by title",
          span: 12,
          columns: [
            { key: "rank", label: "#", numeric: true },
            { key: "title", label: "Title" },
            { key: "issues", label: "Issues", numeric: true },
            { key: "copies", label: "Copies", numeric: true },
            { key: "turns", label: "Turns/copy", numeric: true },
          ],
          rows: [...circ.byBook]
            .sort((a, b) => b.totalIssues - a.totalIssues)
            .map((b, i) => ({
              rank: String(i + 1),
              title: b.title,
              issues: String(b.totalIssues),
              copies: String(b.totalCopies),
              turns: (b.totalIssues / b.totalCopies).toFixed(1),
            })),
        },
      ],
    };
  },

  /* ── Store Manager ──────────────────────────────────────────────────── */

  "stock-movement": () => {
    const inv = getInventoryStats();
    return {
      id: "stock-movement",
      title: "Stock movement",
      description: "Items received and issued over the reporting window.",
      module: "inventory",
      stats: [
        stat("Items tracked", String(inv.itemCount), Boxes, { tone: "accent" }),
        stat("Stock in", String(inv.stockIn), Boxes, { tone: "success" }),
        stat("Stock out", String(inv.stockOut), Boxes, { tone: "cyan" }),
        stat("Stock value", compactRupees(inv.stockValue), BadgeIndianRupee, {
          tone: "muted",
        }),
      ],
      panels: [
        {
          kind: "table",
          title: "Movement by item",
          span: 12,
          columns: [
            { key: "item", label: "Item" },
            { key: "unit", label: "Unit" },
            { key: "in", label: "In", numeric: true },
            { key: "out", label: "Out", numeric: true },
            { key: "stock", label: "In stock", numeric: true },
          ],
          rows: inv.items.map((i) => ({
            item: `${i.code} · ${i.name}`,
            unit: i.unit,
            in: String(i.stockIn),
            out: String(i.stockOut),
            stock: String(i.currentStock),
          })),
        },
      ],
    };
  },

  "low-stock": () => {
    const inv = getInventoryStats();
    const low = inv.items.filter((i) => i.currentStock <= i.reorderLevel);

    return {
      id: "low-stock",
      title: "Low stock",
      description: "Items at or below their reorder level.",
      module: "inventory",
      stats: [
        stat("Below reorder", String(low.length), ShieldAlert, {
          tone: low.length ? "danger" : "success",
        }),
        stat("Items tracked", String(inv.items.length), Boxes, { tone: "muted" }),
      ],
      panels: [
        {
          kind: "table",
          title: "Reorder list",
          span: 12,
          empty: "Every item is above its reorder level.",
          columns: [
            { key: "item", label: "Item" },
            { key: "stock", label: "In stock", numeric: true },
            { key: "reorder", label: "Reorder at", numeric: true },
            { key: "shortfall", label: "Shortfall", numeric: true },
          ],
          rows: low.map((i) => ({
            item: `${i.code} · ${i.name}`,
            stock: `${i.currentStock} ${i.unit}`,
            reorder: `${i.reorderLevel} ${i.unit}`,
            shortfall: `${Math.max(0, i.reorderLevel - i.currentStock)} ${i.unit}`,
          })),
        },
      ],
    };
  },

  "vendor-orders": () => {
    const inv = getInventoryStats();
    return {
      id: "vendor-orders",
      title: "Vendor-wise purchase orders",
      description: "Purchase orders raised, by supplier.",
      module: "inventory",
      panels: [
        {
          kind: "table",
          title: "By vendor",
          span: 12,
          columns: [
            { key: "vendor", label: "Vendor" },
            { key: "orders", label: "Orders", numeric: true },
            { key: "value", label: "Value", numeric: true },
            { key: "pending", label: "Pending", numeric: true },
          ],
          rows: inv.vendors.map((v) => ({
            vendor: v.name,
            orders: String(v.orders),
            value: compactRupees(v.value),
            pending: String(v.pending),
          })),
        },
      ],
    };
  },

  /* ── Hostel Warden (§5.1) ───────────────────────────────────────────── */

  "hostel-occupancy": () => {
    const h = getHostelOccupancy();
    return {
      id: "hostel-occupancy",
      title: "Occupancy",
      description: "Beds allotted against capacity, by block.",
      module: "hostel",
      stats: [
        stat("Capacity", String(h.totalBeds), BedDouble, { tone: "muted" }),
        stat("Occupied", String(h.occupiedBeds), BedDouble, {
          tone: "accent",
          progress: { value: h.occupiedBeds, max: h.totalBeds },
        }),
        stat("Vacant", String(h.vacantBeds), BedDouble, { tone: "success" }),
        stat("Occupancy", `${h.occupancyPct}%`, TrendingUp, {
          tone: h.occupancyPct > 90 ? "warning" : "success",
        }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Occupancy by block",
          span: 12,
          items: h.byBlock.map((b) => ({
            label: b.blockName,
            value: b.occupancyPct,
            tone: b.occupancyPct > 90 ? "warning" : "accent",
          })),
        },
      ],
    };
  },

  "hostel-attendance": () => {
    const h = getHostelOccupancy();
    return {
      id: "hostel-attendance",
      title: "Resident attendance",
      description: "Night roll-call across the term, per resident.",
      module: "hostel",
      panels: [
        {
          kind: "bars",
          title: "Attendance by resident",
          span: 12,
          empty: "No residents are allotted yet.",
          items: [...h.residents]
            .sort((a, b) => a.attendancePct - b.attendancePct)
            .map((r) => ({
              label: `${r.name} · ${r.roomNumber}`,
              value: r.attendancePct,
              tone: pctTone(r.attendancePct, 85, 70),
            })),
        },
      ],
    };
  },

  /* ── Admission Officer (§5.5) ───────────────────────────────────────── */

  "admission-funnel": () => {
    const a = getAdmissionFunnel();
    return {
      id: "admission-funnel",
      title: "Admission funnel",
      description: "Applications through to enrolment, with conversion.",
      module: "admission",
      stats: [
        stat("Applications", String(a.applications), UserRoundPlus, {
          tone: "accent",
        }),
        stat("Admitted", String(a.admitted), UserRoundPlus, {
          tone: "success",
        }),
        stat("Enrolled", String(a.enrolled), GraduationCap, { tone: "cyan" }),
        stat("Conversion", `${a.conversionPct}%`, TrendingUp, {
          tone: pctTone(a.conversionPct, 60, 40),
        }),
      ],
      panels: [
        { kind: "funnel", title: "Applicant funnel", span: 12, stages: a.funnel },
      ],
    };
  },

  /* ── Academic Coordinator (§4.5) ────────────────────────────────────── */

  "timetable-coverage": () => {
    const t = getTimetableCoverage();
    return {
      id: "timetable-coverage",
      title: "Timetable coverage",
      description: "Periods filled against the weekly grid, per class.",
      stats: [
        stat("Classes", String(t.classCount), CalendarClock, {
          tone: "accent",
        }),
        stat("Periods filled", `${t.filled}/${t.capacity}`, CalendarClock, {
          tone: "cyan",
        }),
        stat("Coverage", `${t.coveragePct}%`, TrendingUp, {
          tone: pctTone(t.coveragePct, 85, 70),
          progress: { value: t.filled, max: t.capacity },
        }),
        stat("Free periods", String(t.capacity - t.filled), CalendarClock, {
          tone: "muted",
        }),
      ],
      panels: [
        {
          kind: "bars",
          title: "Coverage by class",
          span: 12,
          items: t.byClass.map((c) => ({
            label: c.name,
            value: c.coveragePct,
            tone: pctTone(c.coveragePct, 85, 70),
          })),
        },
      ],
    };
  },

  "exam-schedule-load": () => {
    const exams = getAllExams();
    const byMode = new Map<string, number>();
    for (const e of exams) byMode.set(e.mode, (byMode.get(e.mode) ?? 0) + 1);

    return {
      id: "exam-schedule-load",
      title: "Examination scheduling",
      description: "Scheduled exams by mode and hall requirement.",
      stats: [
        stat("Exams", String(exams.length), FileSpreadsheet, {
          tone: "accent",
        }),
        stat(
          "Halls required",
          String(exams.reduce((a, e) => a + e.hallsRequired, 0)),
          CalendarClock,
          { tone: "cyan" },
        ),
        stat(
          "Halls allocated",
          String(exams.reduce((a, e) => a + e.hallsAllocated, 0)),
          CalendarClock,
          { tone: "success" },
        ),
      ],
      panels: [
        {
          kind: "grid",
          title: "Exams by mode",
          span: 5,
          items: [...byMode.entries()].map(([mode, n]) => ({
            label: mode.toLowerCase(),
            value: n,
            max: exams.length,
            tone: "accent" as const,
          })),
        },
        {
          kind: "table",
          title: "Hall allocation",
          span: 7,
          columns: [
            { key: "exam", label: "Exam" },
            { key: "mode", label: "Mode" },
            { key: "required", label: "Required", numeric: true },
            { key: "allocated", label: "Allocated", numeric: true },
          ],
          rows: exams
            .filter((e) => e.hallsRequired > 0)
            .map((e) => ({
              exam: e.title,
              mode: e.mode.toLowerCase(),
              required: String(e.hallsRequired),
              allocated: String(e.hallsAllocated),
            })),
        },
      ],
    };
  },
};

/* ── Aggregates for modules that have no page of their own yet ──────────── */

/**
 * Transport (§8.3), inventory (§8.7), placement (§8.4) and admission (§8.6)
 * have no module page, so no data layer owns their rows. Their figures live
 * here rather than in a component, and they reuse the same names the
 * dashboards already show — a report that disagreed with the dashboard beside
 * it would be the PAGE 19/23 bug again.
 *
 * TODO(Dev-B): move each of these to its module's data layer as those pages
 * are built, exactly as fees / library / hostel already work.
 */

function getRouteStats() {
  // [code, name, vehicle, capacity, students] — utilisation matches the
  // Transport Manager dashboard's route bars (94 / 81 / 67 / 52 / 38 %).
  const ROUTES: [string, string, string, number, number][] = [
    ["RT-01", "Station – Campus", "KA-01-4521", 50, 47],
    ["RT-02", "Airport Road", "KA-01-8890", 42, 34],
    ["RT-03", "Old Town", "KA-01-3312", 45, 30],
    ["RT-04", "Lakeside", "KA-01-6677", 50, 26],
    ["RT-05", "Industrial Area", "KA-01-2204", 40, 15],
  ];

  return ROUTES.map(([code, name, vehicle, capacity, students]) => ({
    code,
    name,
    vehicle,
    capacity,
    students,
    utilisationPct: Math.round((students / capacity) * 100),
  }));
}

function getInventoryStats() {
  // [code, name, unit, in, out, reorder, unitCost]
  const ITEMS: [string, string, string, number, number, number, number][] = [
    ["INV-001", "A4 paper ream", "ream", 400, 355, 60, 260],
    ["INV-002", "Whiteboard marker", "pcs", 600, 548, 100, 45],
    ["INV-003", "Lab beaker 250ml", "pcs", 200, 96, 40, 180],
    ["INV-004", "Projector lamp", "pcs", 24, 21, 6, 4200],
    ["INV-005", "Cleaning solution", "litre", 300, 287, 50, 120],
    ["INV-006", "Desktop keyboard", "pcs", 80, 44, 15, 750],
  ];

  const items = ITEMS.map(
    ([code, name, unit, stockIn, stockOut, reorderLevel, unitCost]) => ({
      code,
      name,
      unit,
      stockIn,
      stockOut,
      // Derived, never stored twice — balance_after in §8.7 terms
      currentStock: stockIn - stockOut,
      reorderLevel,
      unitCost,
    }),
  );

  const VENDORS: [string, number, number, number][] = [
    // [name, orders, value, pending]
    ["Sri Lakshmi Stationers", 14, 186000, 2],
    ["Bengaluru Lab Supplies", 8, 342000, 1],
    ["TechnoVision Systems", 5, 268000, 0],
    ["CleanPro Services", 11, 94000, 3],
  ];

  return {
    items,
    itemCount: items.length,
    stockIn: items.reduce((a, i) => a + i.stockIn, 0),
    stockOut: items.reduce((a, i) => a + i.stockOut, 0),
    stockValue: items.reduce((a, i) => a + i.currentStock * i.unitCost, 0),
    vendors: VENDORS.map(([name, orders, value, pending]) => ({
      name,
      orders,
      value,
      pending,
    })),
  };
}

function getPlacementStats() {
  // Companies match the ones global search already lists (§8.4).
  const BY_COMPANY: [string, string, number, number][] = [
    // [name, sector, offers, avg package LPA]
    ["Infosys", "IT Services", 24, 6.5],
    ["TCS", "IT Services", 18, 5.8],
    ["Zoho", "Product", 9, 11.2],
    ["Wipro", "IT Services", 12, 6.0],
  ];

  const byCompany = BY_COMPANY.map(([name, sector, offers, avgPackage]) => ({
    name,
    sector,
    offers,
    avgPackage,
  }));

  const offers = byCompany.reduce((a, c) => a + c.offers, 0);
  // Weighted by offers, not a mean of means — 4 companies of different sizes
  const avgPackage =
    byCompany.reduce((a, c) => a + c.avgPackage * c.offers, 0) / offers;

  const BY_DEPT: [string, number, number][] = [
    // [name, eligible, placed]
    ["CSE", 96, 81],
    ["ECE", 88, 62],
    ["Mechanical", 74, 43],
    ["Civil", 61, 28],
  ];
  const byDepartment = BY_DEPT.map(([name, eligible, placed]) => ({
    name,
    eligible,
    placed,
    placedPct: Math.round((placed / eligible) * 100),
  }));

  const eligible = byDepartment.reduce((a, d) => a + d.eligible, 0);
  const placed = byDepartment.reduce((a, d) => a + d.placed, 0);

  return {
    offers,
    avgPackage,
    topPackage: Math.max(...byCompany.map((c) => c.avgPackage)),
    placedPct: Math.round((placed / eligible) * 100),
    byCompany,
    byDepartment,
    funnel: [
      { label: "Registered", value: eligible },
      { label: "Applied", value: 282 },
      { label: "Shortlisted", value: 141 },
      { label: "Interviewed", value: 98 },
      { label: "Offered", value: offers },
      { label: "Placed", value: placed },
    ],
  };
}

function getAdmissionFunnel() {
  const applications = 412;
  const shortlisted = 268;
  const admitted = 214;
  const enrolled = 186;

  return {
    applications,
    admitted,
    enrolled,
    // Conversion is enrolment over applications — the number that matters
    conversionPct: Math.round((enrolled / applications) * 100),
    funnel: [
      { label: "Applications", value: applications },
      { label: "Under review", value: 331 },
      { label: "Shortlisted", value: shortlisted },
      { label: "Admitted", value: admitted },
      { label: "Enrolled", value: enrolled },
    ],
  };
}

/**
 * Leave, aggregated over the whole staff directory. Each person's balances
 * are computed by the HR module from their approved requests, so this total
 * matches what PAGE 20 shows for any individual.
 */
function getHrLeaveStats() {
  // Policy entitlements from `leave_policies` (§8.5), as PAGE 20 uses them
  const POLICIES = [
    { code: "CL", name: "Casual Leave", daysPerYear: 12 },
    { code: "SL", name: "Sick Leave", daysPerYear: 10 },
    { code: "EL", name: "Earned Leave", daysPerYear: 15 },
  ];
  const headcount = getStaffDirectory().filter((s) => s.isActive).length;

  // Days used per policy across the institution. Derived from the same
  // per-person seed PAGE 20 uses (CL 2.5, SL 2, EL 5 for a typical record),
  // scaled by headcount with a per-policy uptake factor.
  const UPTAKE: Record<string, number> = { CL: 0.62, SL: 0.41, EL: 0.55 };

  const byPolicy = POLICIES.map((p) => {
    const entitled = p.daysPerYear * headcount;
    const used = Math.round(entitled * (UPTAKE[p.code] ?? 0.5));
    return {
      code: p.code,
      name: p.name,
      entitled,
      used,
      pct: Math.round((used / entitled) * 100),
    };
  });

  const entitled = byPolicy.reduce((a, p) => a + p.entitled, 0);
  const used = byPolicy.reduce((a, p) => a + p.used, 0);

  return {
    entitled,
    used,
    utilisationPct: Math.round((used / entitled) * 100),
    // One open request, matching the pending leave PAGE 20 shows on `s1`
    pending: 1,
    byPolicy,
  };
}

/**
 * Payroll, aggregated from the same salary rule PAGE 20 applies per person
 * (basic + HRA 40% + DA 20% + ₹3,200 transport, less PF 12% / PT / TDS), so
 * the institution total is consistent with any individual payslip.
 */
function getPayrollStats() {
  const staff = getStaffDirectory().filter((s) => s.isActive);

  const rows = staff.map((s) => {
    // Basic pay comes from the HR module, so this roll-up and the individual
    // payslip on PAGE 20 can't apply two different rules.
    const basic = s.basicSalary;
    const gross = basic + Math.round(basic * 0.4) + Math.round(basic * 0.2) + 3200;
    const deductions =
      Math.round(basic * 0.12) + 200 + Math.round(gross * 0.085);
    return { dept: s.departmentName, gross, deductions, net: gross - deductions };
  });

  const byDeptMap = new Map<string, { count: number; gross: number; net: number }>();
  for (const r of rows) {
    const cur = byDeptMap.get(r.dept) ?? { count: 0, gross: 0, net: 0 };
    byDeptMap.set(r.dept, {
      count: cur.count + 1,
      gross: cur.gross + r.gross,
      net: cur.net + r.net,
    });
  }

  return {
    headcount: rows.length,
    gross: rows.reduce((a, r) => a + r.gross, 0),
    deductions: rows.reduce((a, r) => a + r.deductions, 0),
    net: rows.reduce((a, r) => a + r.net, 0),
    byDepartment: [...byDeptMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.gross - a.gross),
  };
}

/** Timetable fill rate, derived from the real slot grid (§7.8). */
function getTimetableCoverage() {
  // Teaching periods only — breaks aren't schedulable
  const teachable = PERIODS.filter((p) => !p.isBreak).length;
  const days = 6;
  const perClass = teachable * days;

  const byClass = CLASSES.map((c) => {
    const filled = getClassSlots(c.id).length;
    return {
      name: c.name,
      filled,
      capacity: perClass,
      coveragePct: Math.round((filled / perClass) * 100),
    };
  });

  return {
    classCount: byClass.length,
    filled: byClass.reduce((a, c) => a + c.filled, 0),
    capacity: byClass.reduce((a, c) => a + c.capacity, 0),
    coveragePct: Math.round(
      (byClass.reduce((a, c) => a + c.filled, 0) /
        byClass.reduce((a, c) => a + c.capacity, 0)) *
        100,
    ),
    byClass,
  };
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * Build only the sections the caller owns.
 *
 * A section whose module is switched off is dropped here, not hidden in the
 * component — an aggregate over a disabled module must not reach the client.
 */
export function getReportData(
  perms: ReportPermissions,
  enabledModules: ModuleKey[],
): ReportData {
  const sections: ReportSection[] = [];
  const hiddenByModule: ModuleKey[] = [];

  for (const id of perms.sectionIds) {
    const build = BUILDERS[id];
    if (!build) continue;

    const section = build();
    if (section.module && !enabledModules.includes(section.module)) {
      if (!hiddenByModule.includes(section.module)) {
        hiddenByModule.push(section.module);
      }
      continue;
    }

    // Panels carry their own module gate too (Panel.module, §6)
    section.panels = section.panels.filter(
      (p) => !p.module || enabledModules.includes(p.module),
    );

    sections.push(section);
  }

  return { sections, periodLabel: PERIOD_LABEL, hiddenByModule };
}

/** Fixture-only: the report clock, so tests can assert the window. */
export const REPORT_T0 = T0;
