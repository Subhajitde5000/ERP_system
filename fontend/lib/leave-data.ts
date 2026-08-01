import type { ModuleKey } from "@/types/auth";
import type {
  AttendanceLeave,
  HostelLeave,
  LeaveData,
  LeavePermissions,
  LeaveSection,
  LeaveStatus,
  StaffLeave,
} from "@/types/leave";
import { leaveDays } from "./leave";
import { getClassRoster, type RosterStudent } from "./attendance-data";
import {
  getStaffDirectory,
  getStaffLeave,
  LEAVE_POLICIES,
} from "./staff-detail-data";
import { getAllHostelLeave } from "./hostel-data";

/**
 * Leave data source — PAGE 13 (C-RB-13).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): three endpoints, because these are three tables:
 *
 *   GET   /api/v1/attendance/leaves?scope=          attendance_leaves  §7.1
 *   POST  /api/v1/attendance/leaves                 student applies
 *   PATCH /api/v1/attendance/leaves/:id/review      teacher/HOD decides
 *   GET   /api/v1/hr/leaves?scope=                  leave_requests     §8.5
 *   POST  /api/v1/hr/leaves                         staff applies
 *   PATCH /api/v1/hr/leaves/:id/review              HR decides
 *   PATCH /api/v1/hr/leave-balances/:staffId        HR edits entitlement
 *   GET   /api/v1/hostel/leaves                     hostel_leave_requests §8.2
 *   PATCH /api/v1/hostel/leaves/:id/review          warden decides
 *
 * Approving is a mutation on someone else's row, so the backend must re-check
 * the caller's scope on the PATCH — the UI hiding a button is not a control.
 *
 * **Every row is read from the module that owns it**: staff leave and the
 * policy table from the HR module (`getStaffLeave`, `LEAVE_POLICIES`), hostel
 * leave from the hostel module (`getAllHostelLeave`), and students from the
 * shared roster. The only rows defined here are the student attendance
 * leaves, because `attendance-data` models them per-student for one student
 * and this page needs the class-wide queue.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/** The signed-in student, matching every other module's demo identity. */
const OWN_STUDENT_ID = "s1";
/** The signed-in staff member, matching the staff-detail fixture. */
const OWN_STAFF_ID = "s1";

/* ── Student attendance leaves (§7.1) ───────────────────────────────────── */

/**
 * [studentId, from daysAgo, to daysAgo, reason, document, status, reviewer]
 *
 * `s1`'s two rows are the ones `/attendance` already shows for the signed-in
 * student, so the two pages tell the same story. The rest give the Teacher and
 * HOD a queue with something pending to act on — the recurring lesson that a
 * fixture state which hides the role's primary action is a bug.
 */
type LeaveSeed = [
  string,
  number,
  number,
  string,
  string | null,
  LeaveStatus,
  string | null,
];

const ATTENDANCE_SEED: LeaveSeed[] = [
  // Aryan — mirrors getSelfAttendance()'s two leaves exactly
  ["s1", 8, 7, "Medical — viral fever, certificate attached", "medical-certificate.pdf", "APPROVED", "Priya Sharma"],
  ["s1", -2, -3, "Family function out of station", null, "PENDING", null],
  // Pending — the Teacher's queue
  ["s2", -1, -2, "Sister's wedding in Mangaluru.", null, "PENDING", null],
  ["s3", -4, -6, "Dengue — hospitalised, discharge summary attached.", "discharge-summary.pdf", "PENDING", null],
  // Other classes / departments, for the HOD and institution queues
  ["s5", -3, -4, "Attending state-level football selection.", "selection-letter.pdf", "PENDING", null],
  ["s6", 12, 10, "Chickenpox — advised 3 days rest.", "medical-certificate.pdf", "APPROVED", "Kavita Menon"],
  ["s7", 20, 20, "Passport appointment.", null, "REJECTED", "Priya Sharma"],
  ["s9", 30, 28, "Family bereavement.", null, "APPROVED", "Kavita Menon"],
  ["s10", -5, -5, "Campus placement drive at another institute.", null, "PENDING", null],
];

/** Which class each roster student sits in, for the Teacher's class fence. */
function classOf(student: RosterStudent): string {
  // The roster owns `className` (FY-BSc-A etc.); the teacher's timetable uses
  // the short form (FY-A). Map once here rather than duplicating the roster.
  return student.className.replace("-BSc", "");
}

function buildAttendanceLeaves(): AttendanceLeave[] {
  const roster = getClassRoster();

  return ATTENDANCE_SEED.map(
    ([studentId, fromAgo, toAgo, reason, documentName, status, reviewer], i) => {
      const student = roster.find((s) => s.id === studentId);
      const fromDate = on(fromAgo);
      const toDate = on(toAgo);

      return {
        id: `al-${i + 1}`,
        kind: "ATTENDANCE" as const,
        studentId,
        studentName: student?.name ?? "Unknown",
        rollNo: student?.rollNo ?? "—",
        className: student ? classOf(student) : "—",
        departmentName: student?.departmentName ?? "—",
        fromDate,
        toDate,
        // Derived — §7.1 has no total_days column
        totalDays: leaveDays(fromDate, toDate),
        reason,
        documentName,
        status,
        reviewedByName: reviewer,
        reviewedAt: status === "PENDING" ? null : at(Math.max(1, fromAgo - 1)),
        appliedAt: at(fromAgo + 3),
      };
    },
  );
}

/* ── Staff HR leave (§8.5) ──────────────────────────────────────────────── */

/**
 * The institution-wide staff queue.
 *
 * Each person's rows come from `getStaffLeave()`, the same function the staff
 * detail page uses, so a request shown here is byte-for-byte the request shown
 * there. Only the applicant's identity is joined on.
 */
/**
 * Reasons and dates for the pending applicants.
 *
 * `getStaffLeave()` returns the *same* seed row for every person, which is
 * right on PAGE 20 (one record at a time) and wrong here: four identical
 * "Family function out of station · 2–3 Aug" rows stacked in one queue read
 * as a rendering bug rather than four real applications. Each applicant gets
 * their own reason and window; everything else still comes from the HR module.
 */
const PENDING_OVERRIDE: Record<string, { reason: string; from: number; to: number; policy: [string, string] }> = {
  s1: { reason: "Family function out of station.", from: -4, to: -5, policy: ["CL", "Casual Leave"] },
  s6: { reason: "Daughter's school admission interview.", from: -1, to: -1, policy: ["CL", "Casual Leave"] },
  s10: { reason: "Post-operative recovery — fitness certificate to follow.", from: -8, to: -14, policy: ["SL", "Sick Leave"] },
  s13: { reason: "Annual family holiday, booked in March.", from: -18, to: -24, policy: ["EL", "Earned Leave"] },
};

/** Who signs off staff leave (§5.4). */
const HR_APPROVER = { id: "s10", name: "Anita Desai" };

function buildStaffLeaves(): StaffLeave[] {
  return getStaffDirectory()
    .filter((s) => s.isActive)
    .flatMap((staff) =>
      getStaffLeave(staff.id).requests.map((r) => {
        const override =
          r.status === "PENDING" ? PENDING_OVERRIDE[staff.id] : undefined;

        return {
          ...r,
          ...(override
            ? {
                reason: override.reason,
                fromDate: on(override.from),
                toDate: on(override.to),
                totalDays: leaveDays(on(override.from), on(override.to)),
                policyCode: override.policy[0],
                policyName: override.policy[1],
              }
            : {}),
          kind: "STAFF" as const,
          // Ids are per-person in the HR fixture; qualify them for one queue
          id: `${staff.id}-${r.id}`,
          staffId: staff.id,
          staffName: staff.name,
          departmentName: staff.departmentName,
          designation: staff.designation,
        };
      }),
    );
}

/* ── Hostel leave (§8.2) ────────────────────────────────────────────────── */

function buildHostelLeaves(): HostelLeave[] {
  return getAllHostelLeave().map((r) => ({
    id: r.id,
    kind: "HOSTEL" as const,
    studentId: r.studentId,
    studentName: r.studentName,
    rollNo: r.rollNo,
    roomNumber: r.roomNumber,
    blockName: r.blockName,
    fromDate: r.fromDate,
    toDate: r.toDate,
    totalDays: leaveDays(r.fromDate, r.toDate),
    reason: r.reason,
    destination: r.destination,
    contactDuringLeave: r.contactDuringLeave,
    status: r.status,
    reviewedByName: r.reviewedByName,
    reviewedAt: r.status === "PENDING" ? null : r.appliedAt,
    appliedAt: r.appliedAt,
  }));
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * Build only the sections the caller owns.
 *
 * The scope is applied here, before a row is created: a Teacher's payload
 * contains their own classes' requests and nothing else, so there are no
 * hidden rows for devtools to find. This is the recurring lesson from
 * PAGE 4 / 20 / 21 / 22 / 23 / 24 / 12.
 */
export function getLeaveData(
  perms: LeavePermissions,
  sections: LeaveSection[],
  enabledModules: ModuleKey[],
): LeaveData {
  const keys = new Set(sections.map((s) => s.key));
  const data: LeaveData = { hiddenByModule: [] };

  for (const s of perms.sections) {
    if (s.module && !enabledModules.includes(s.module) && !data.hiddenByModule.includes(s.module)) {
      data.hiddenByModule.push(s.module);
    }
  }

  /* Student / parent — own attendance leaves only */
  if (keys.has("OWN_ATTENDANCE")) {
    data.ownAttendance = buildAttendanceLeaves()
      .filter((l) => l.studentId === OWN_STUDENT_ID)
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  }

  /* Any staff member — own HR leave and entitlement */
  if (keys.has("OWN_STAFF")) {
    const own = getStaffLeave(OWN_STAFF_ID);
    const me = getStaffDirectory().find((s) => s.id === OWN_STAFF_ID);

    data.ownStaff = {
      requests: own.requests.map((r) => ({
        ...r,
        kind: "STAFF" as const,
        id: `${OWN_STAFF_ID}-${r.id}`,
        staffId: OWN_STAFF_ID,
        staffName: me?.name ?? "You",
        departmentName: me?.departmentName ?? "—",
        designation: me?.designation ?? "—",
      })),
      balances: own.balances,
    };
    data.policies = LEAVE_POLICIES.map(({ code, name, daysPerYear }) => ({
      code,
      name,
      daysPerYear,
    }));
  }

  /* Approver queue — student attendance leave, scoped before it is built */
  if (keys.has("REVIEW_ATTENDANCE")) {
    let rows = buildAttendanceLeaves();

    // HOD: own department only (§4.4)
    if (perms.departmentScope) {
      rows = rows.filter((l) => l.departmentName === perms.departmentScope);
    }
    // Teacher: own classes only
    if (perms.classScope) {
      rows = rows.filter((l) => perms.classScope!.includes(l.className));
    }

    // Pending first — the queue exists to be worked through
    data.reviewAttendance = rows.sort(byPendingThenRecent);
  }

  /* Approver queue — staff HR leave */
  if (keys.has("REVIEW_STAFF")) {
    // Nobody signs off their own leave. The HR Manager's own request belongs
    // in their "My leave" section, where it correctly shows as awaiting
    // someone else — the same separation-of-duties rule the appraisal cycle
    // already applies (§8.5: a head can't be their own reviewer).
    // TODO(Dev-A): the real rule is `staff_id != :callerId`, escalating to the
    // Principal when the applicant *is* the HR Manager.
    data.reviewStaff = buildStaffLeaves()
      .filter((r) => r.staffId !== HR_APPROVER.id)
      .sort(byPendingThenRecent);
  }

  /* Approver queue — hostel */
  if (keys.has("REVIEW_HOSTEL")) {
    data.reviewHostel = buildHostelLeaves().sort(byPendingThenRecent);
  }

  return data;
}

/** Pending first, then most recently applied. */
function byPendingThenRecent(
  a: { status: string; appliedAt?: string; fromDate: string },
  b: { status: string; appliedAt?: string; fromDate: string },
): number {
  const pending = (x: { status: string }) => (x.status === "PENDING" ? 0 : 1);
  if (pending(a) !== pending(b)) return pending(a) - pending(b);
  return (b.appliedAt ?? b.fromDate).localeCompare(a.appliedAt ?? a.fromDate);
}

/**
 * Pending counts per section, for the badge on each tab.
 * Computed from the already-scoped rows, so a badge can't advertise work the
 * caller cannot open.
 */
export function pendingCounts(data: LeaveData): Record<string, number> {
  const count = (rows?: { status: string }[]) =>
    (rows ?? []).filter((r) => r.status === "PENDING").length;

  return {
    OWN_ATTENDANCE: count(data.ownAttendance),
    OWN_STAFF: count(data.ownStaff?.requests),
    REVIEW_ATTENDANCE: count(data.reviewAttendance),
    REVIEW_STAFF: count(data.reviewStaff),
    REVIEW_HOSTEL: count(data.reviewHostel),
  };
}
