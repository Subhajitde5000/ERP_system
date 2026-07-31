import type { InstitutionRole } from "@/types/auth";
import type { RoleAssignment } from "@/types/profile";
import type {
  SalaryComponent,
  StaffAppraisal,
  StaffAttendance,
  StaffAttendanceMonth,
  StaffDetail,
  StaffDetailPermissions,
  StaffDocument,
  StaffLeaveBalance,
  StaffLeaveRequest,
  StaffPayslip,
  StaffSalary,
  StaffSubject,
  StaffSummary,
  StaffTab,
} from "@/types/staff-detail";
import { maskTail } from "./profile";
import { getTeacherSlots } from "./timetable-data";

/**
 * Staff detail data source — role_based_shared_pages.md PAGE 20 (C-RB-20).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with `GET /api/v1/hr/staff/:id?sections=…`.
 *
 *   profile     → users (§5.5) + staff_profiles (§8.5)
 *   roles       → role_assignments (§5.6)
 *   subjects    → teacher_subjects (§6.5) joined to timetable_slots (§7.8)
 *   attendance  → attendance_sessions marked by this teacher (§7.1)
 *   leave       → leave_policies + leave_requests (§8.5)
 *   salary      → salary_structures (§8.5)
 *   payslips    → payroll_runs + payslips (§8.5)
 *   documents   → staff_documents (§8.5)
 *   appraisals  → appraisal_cycles + appraisals (§8.5)
 *
 * The endpoint must return **only** the sections the caller's role owns —
 * `getStaffDetail` mirrors that below, so nothing confidential ever reaches
 * the RSC payload (the PAGE 4 bug: a client-side mask still ships the value).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAhead: number) =>
  new Date(T0 + daysAhead * DAY).toISOString().slice(0, 10);

/* ── Identity ───────────────────────────────────────────────────────────── */

/**
 * The staff roster.
 *
 * Names, subjects and departments are the same people who already appear in
 * the timetable, attendance and assignment fixtures — so a link from any of
 * those pages opens the right record instead of one hard-coded demo person.
 * `s3` sits in ECE on purpose, to exercise the HOD's department fence.
 */
type StaffSeed = Omit<StaffSummary, "attendancePct"> & {
  /** Name as it appears in `timetable_slots.teacher_name` */
  timetableName: string | null;
};

const STAFF: StaffSeed[] = [
  {
    id: "s1",
    name: "Priya Sharma",
    timetableName: "Priya Sharma",
    employeeCode: "EMP-2019-0142",
    designation: "Assistant Professor",
    departmentName: "CSE",
    email: "priya.s@abc-college.edu",
    phone: "+91 98450 55678",
    gender: "FEMALE",
    dateOfBirth: "1988-11-02",
    address: "14, MG Road, Bengaluru, Karnataka 560001",
    employmentType: "FULL_TIME",
    dateOfJoining: "2019-06-12",
    dateOfLeaving: null,
    qualification: "M.Tech (CSE), PhD pursuing",
    experienceYears: 11,
    isActive: true,
  },
  {
    id: "s2",
    name: "Arun Kumar",
    timetableName: "Arun Kumar",
    employeeCode: "EMP-2021-0233",
    designation: "Assistant Professor",
    departmentName: "CSE",
    email: "arun.k@abc-college.edu",
    phone: "+91 98450 61234",
    gender: "MALE",
    dateOfBirth: "1991-04-19",
    address: "88, Jayanagar 4th Block, Bengaluru, Karnataka 560041",
    employmentType: "FULL_TIME",
    dateOfJoining: "2021-07-05",
    dateOfLeaving: null,
    qualification: "M.Tech (Information Systems)",
    experienceYears: 7,
    isActive: true,
  },
  {
    // ECE — a HOD scoped to CSE must be refused this record
    id: "s3",
    name: "Sunil Rao",
    timetableName: "Sunil Rao",
    employeeCode: "EMP-2017-0088",
    designation: "Associate Professor",
    departmentName: "ECE",
    email: "sunil.r@abc-college.edu",
    phone: "+91 98450 70345",
    gender: "MALE",
    dateOfBirth: "1982-09-27",
    address: "3, Malleshwaram 8th Cross, Bengaluru, Karnataka 560003",
    employmentType: "FULL_TIME",
    dateOfJoining: "2017-01-09",
    dateOfLeaving: null,
    qualification: "PhD (Signal Processing)",
    experienceYears: 16,
    isActive: true,
  },
  {
    // Non-teaching, so the Subjects tab has a real empty state
    id: "s4",
    name: "Fatima Sheikh",
    timetableName: null,
    employeeCode: "EMP-2020-0311",
    designation: "Chief Librarian",
    departmentName: "Library",
    email: "fatima.s@abc-college.edu",
    phone: "+91 98451 10123",
    gender: "FEMALE",
    dateOfBirth: "1986-02-14",
    address: "27, Indiranagar 100ft Road, Bengaluru, Karnataka 560038",
    employmentType: "FULL_TIME",
    dateOfJoining: "2020-02-17",
    dateOfLeaving: null,
    qualification: "M.Lib.I.Sc",
    experienceYears: 9,
    isActive: true,
  },

  /* ────────────────────────────────────────────────────────────────────────
   * The rest of the payroll.
   *
   * These people were already named across the other fixtures — Kavita Menon
   * heads CSE in the search departments list, Meena Thomas and Neha Rathi
   * teach in the timetable, Anita Desai reviews every leave request, Meera
   * Krishnan is the admin on the notice board, Ganesh Bhat is the account the
   * audit log deactivates. They had no `users` row, so the directory would
   * have had to invent a second list of people to show anybody. Adding them
   * to the one owner instead means a name resolves to the same person on
   * every page.
   *
   * `s1`–`s4` keep the full HR fixture (salary, payslips, appraisals); these
   * carry the identity fields the directory and the profile tab need.
   * ──────────────────────────────────────────────────────────────────────── */

  {
    id: "s5",
    name: "Kavita Menon",
    timetableName: null,
    employeeCode: "EMP-2015-0031",
    designation: "Professor & Head — CSE",
    departmentName: "CSE",
    email: "kavita.m@abc-college.edu",
    phone: "+91 98450 44219",
    gender: "FEMALE",
    dateOfBirth: "1976-06-08",
    address: "5, Sadashivanagar, Bengaluru, Karnataka 560080",
    employmentType: "FULL_TIME",
    dateOfJoining: "2015-07-01",
    dateOfLeaving: null,
    qualification: "PhD (Computer Science)",
    experienceYears: 22,
    isActive: true,
  },
  {
    id: "s6",
    name: "Meena Thomas",
    timetableName: "Meena Thomas",
    employeeCode: "EMP-2022-0407",
    designation: "Assistant Professor",
    departmentName: "CSE",
    email: "meena.t@abc-college.edu",
    phone: "+91 98450 78812",
    gender: "FEMALE",
    dateOfBirth: "1993-01-23",
    address: "62, Koramangala 5th Block, Bengaluru, Karnataka 560095",
    employmentType: "FULL_TIME",
    dateOfJoining: "2022-06-20",
    dateOfLeaving: null,
    qualification: "M.Tech (CSE)",
    experienceYears: 5,
    isActive: true,
  },
  {
    id: "s7",
    name: "Neha Rathi",
    timetableName: "Neha Rathi",
    employeeCode: "EMP-2023-0512",
    designation: "Assistant Professor",
    departmentName: "CSE",
    email: "neha.r@abc-college.edu",
    phone: "+91 98450 90344",
    gender: "FEMALE",
    dateOfBirth: "1994-09-12",
    address: "18, HSR Layout Sector 2, Bengaluru, Karnataka 560102",
    employmentType: "FULL_TIME",
    dateOfJoining: "2023-07-10",
    dateOfLeaving: null,
    qualification: "M.Tech (Software Engineering)",
    experienceYears: 4,
    isActive: true,
  },
  {
    // Visiting faculty — the only non-FULL_TIME row, so the employment-type
    // column and the HR filter have something to distinguish
    id: "s8",
    name: "Latha Venkat",
    timetableName: "Latha Venkat",
    employeeCode: "EMP-2024-0603",
    designation: "Visiting Faculty — Mathematics",
    departmentName: "CSE",
    email: "latha.v@abc-college.edu",
    phone: "+91 98450 33127",
    gender: "FEMALE",
    dateOfBirth: "1980-03-30",
    address: "9, Rajajinagar 2nd Stage, Bengaluru, Karnataka 560010",
    employmentType: "VISITING",
    dateOfJoining: "2024-06-03",
    dateOfLeaving: null,
    qualification: "PhD (Mathematics)",
    experienceYears: 18,
    isActive: true,
  },
  {
    id: "s9",
    name: "Meera Krishnan",
    timetableName: null,
    employeeCode: "EMP-2018-0004",
    designation: "Institution Administrator",
    departmentName: "Administration",
    email: "meera.k@abc-college.edu",
    phone: "+91 98451 00012",
    gender: "FEMALE",
    dateOfBirth: "1983-12-05",
    address: "31, Basavanagudi, Bengaluru, Karnataka 560004",
    employmentType: "FULL_TIME",
    dateOfJoining: "2018-04-02",
    dateOfLeaving: null,
    qualification: "MBA (Education Management)",
    experienceYears: 15,
    isActive: true,
  },
  {
    id: "s10",
    name: "Anita Desai",
    timetableName: null,
    employeeCode: "EMP-2019-0077",
    designation: "HR Manager",
    departmentName: "Administration",
    email: "anita.d@abc-college.edu",
    phone: "+91 98451 00456",
    gender: "FEMALE",
    dateOfBirth: "1985-07-19",
    address: "44, Jayanagar 7th Block, Bengaluru, Karnataka 560070",
    employmentType: "FULL_TIME",
    dateOfJoining: "2019-01-14",
    dateOfLeaving: null,
    qualification: "MBA (HR), PGDM",
    experienceYears: 13,
    isActive: true,
  },
  {
    id: "s11",
    name: "Deepak Iyer",
    timetableName: null,
    employeeCode: "EMP-2016-0052",
    designation: "Examination Controller",
    departmentName: "Examination",
    email: "deepak.i@abc-college.edu",
    phone: "+91 98451 00789",
    gender: "MALE",
    dateOfBirth: "1979-04-11",
    address: "7, Vijayanagar, Bengaluru, Karnataka 560040",
    employmentType: "FULL_TIME",
    dateOfJoining: "2016-08-22",
    dateOfLeaving: null,
    qualification: "M.Sc, M.Ed",
    experienceYears: 19,
    isActive: true,
  },
  {
    id: "s12",
    name: "Suresh Patil",
    timetableName: null,
    employeeCode: "EMP-2020-0198",
    designation: "Accountant",
    departmentName: "Accounts",
    email: "suresh.p@abc-college.edu",
    phone: "+91 98451 01234",
    gender: "MALE",
    dateOfBirth: "1987-10-02",
    address: "22, Banashankari 2nd Stage, Bengaluru, Karnataka 560070",
    employmentType: "FULL_TIME",
    dateOfJoining: "2020-09-01",
    dateOfLeaving: null,
    qualification: "M.Com, CA (Inter)",
    experienceYears: 11,
    isActive: true,
  },
  {
    id: "s13",
    name: "Ramesh Gowda",
    timetableName: "Ramesh Gowda",
    employeeCode: "EMP-2021-0264",
    designation: "Hostel Warden — Block A",
    departmentName: "Hostel",
    email: "ramesh.g@abc-college.edu",
    phone: "+91 98451 21234",
    gender: "MALE",
    dateOfBirth: "1981-05-16",
    address: "Block A Warden's Quarters, ABC College Campus, Bengaluru 560064",
    employmentType: "FULL_TIME",
    dateOfJoining: "2021-03-15",
    dateOfLeaving: null,
    qualification: "B.P.Ed",
    experienceYears: 14,
    isActive: true,
  },
  {
    id: "s14",
    name: "Vikram Nair",
    timetableName: null,
    employeeCode: "EMP-2022-0331",
    designation: "Placement Officer",
    departmentName: "Placement",
    email: "vikram.n@abc-college.edu",
    phone: "+91 98451 05566",
    gender: "MALE",
    dateOfBirth: "1988-08-24",
    address: "12, Whitefield Main Road, Bengaluru, Karnataka 560066",
    employmentType: "FULL_TIME",
    dateOfJoining: "2022-01-10",
    dateOfLeaving: null,
    qualification: "MBA (Marketing)",
    experienceYears: 10,
    isActive: true,
  },
  {
    // Deactivated — the audit log already records Meera deactivating him, so
    // the directory must show that account as inactive rather than absent.
    // Gives the admin's status filter and "reactivate" affordance real data.
    id: "s15",
    name: "Ganesh Bhat",
    timetableName: null,
    employeeCode: "EMP-2019-0155",
    designation: "Store Manager",
    departmentName: "Stores",
    email: "ganesh.b@abc-college.edu",
    phone: "+91 98451 07788",
    gender: "MALE",
    dateOfBirth: "1984-02-27",
    address: "8, Yeshwanthpur, Bengaluru, Karnataka 560022",
    employmentType: "FULL_TIME",
    dateOfJoining: "2019-11-04",
    dateOfLeaving: "2026-07-28",
    qualification: "B.Com",
    experienceYears: 12,
    isActive: false,
  },
];

/** Confidential half of `staff_profiles` — raw values, never sent unmasked. */
const BANKING_RAW: Record<string, StaffBankingRaw> = {
  s1: {
    panNumber: "AFZPK7190K",
    bankAccountNo: "50100234567890",
    bankIfsc: "HDFC0001234",
    bankName: "HDFC Bank",
    pfNumber: "KN/BNG/0012345/678",
    emergencyContactName: "Arvind Sharma",
    emergencyContactPhone: "+91 98450 55679",
  },
  s2: {
    panNumber: "BQWPK4471M",
    bankAccountNo: "38104477219003",
    bankIfsc: "SBIN0004221",
    bankName: "State Bank of India",
    pfNumber: "KN/BNG/0012345/902",
    emergencyContactName: "Latha Kumar",
    emergencyContactPhone: "+91 98450 61235",
  },
  s3: {
    panNumber: "CDTPR9032H",
    bankAccountNo: "91820011764432",
    bankIfsc: "ICIC0000188",
    bankName: "ICICI Bank",
    pfNumber: "KN/BNG/0012345/104",
    emergencyContactName: "Shobha Rao",
    emergencyContactPhone: "+91 98450 70346",
  },
  s4: {
    panNumber: "EKLPS2288J",
    bankAccountNo: "20033198765412",
    bankIfsc: "KKBK0008012",
    bankName: "Kotak Mahindra Bank",
    pfNumber: "KN/BNG/0012345/551",
    emergencyContactName: "Imran Sheikh",
    emergencyContactPhone: "+91 98451 10124",
  },
};

/** Banks the derived records are spread across, so the column isn't uniform. */
const BANKS: [string, string][] = [
  ["HDFC Bank", "HDFC0001234"],
  ["State Bank of India", "SBIN0004221"],
  ["ICICI Bank", "ICIC0000188"],
  ["Kotak Mahindra Bank", "KKBK0008012"],
  ["Axis Bank", "UTIB0002210"],
  ["Canara Bank", "CNRB0001905"],
];

/**
 * Banking for the staff added after the original four.
 *
 * Derived from the employee code rather than hand-written: fifteen more
 * hand-typed PAN/account/PF triples is fifteen more chances to paste the same
 * account number onto two people. Everything here is fake by construction and
 * is masked before it leaves the server anyway.
 */
function deriveBanking(seed: StaffSeed): StaffBankingRaw {
  const n = Number(seed.id.slice(1));
  const initials = seed.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .padEnd(2, "X")
    .slice(0, 2);
  const [bankName, bankIfsc] = BANKS[n % BANKS.length]!;
  const surname = seed.name.split(" ").pop() ?? seed.name;

  return {
    // PAN format: 5 letters, 4 digits, 1 letter (§8.5 `pan_number`)
    panNumber: `A${initials}P${initials[0]}${String(1000 + n * 137).slice(0, 4)}${initials[1]}`,
    bankAccountNo: String(50100000000000 + n * 987654321).slice(0, 14),
    bankIfsc,
    bankName,
    pfNumber: `KN/BNG/0012345/${String(100 + n * 43).padStart(3, "0")}`,
    emergencyContactName: `${["Anil", "Rekha", "Prakash", "Sushma"][n % 4]} ${surname}`,
    // One digit off the staff member's own number — a household landline
    emergencyContactPhone: seed.phone.replace(/(\d)$/, (d) =>
      String((Number(d) + 1) % 10),
    ),
  };
}

/** Banking for any staff member, explicit rows first. */
function bankingFor(seed: StaffSeed): StaffBankingRaw {
  return BANKING_RAW[seed.id] ?? deriveBanking(seed);
}

type StaffBankingRaw = {
  panNumber: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankName: string;
  pfNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

/* ── Roles (§5.6) ───────────────────────────────────────────────────────── */

/** Extra grants beyond the base role implied by the designation. */
const EXTRA_ROLES: Record<string, RoleAssignment[]> = {
  s1: [
    {
      role: "MENTOR",
      scopeType: "CLASS",
      scopeName: "FY-A",
      assignedAt: "2024-04-01T00:00:00.000Z",
      expiresAt: null,
      isActive: true,
    },
    {
      // An expiring grant, so "manage roles" has something real to revoke
      role: "EXAM_CONTROLLER",
      scopeType: null,
      scopeName: null,
      assignedAt: "2026-06-01T00:00:00.000Z",
      expiresAt: "2026-08-31T00:00:00.000Z",
      isActive: true,
    },
  ],
  s3: [
    {
      role: "HOD",
      scopeType: "DEPARTMENT",
      scopeName: "ECE",
      assignedAt: "2022-04-01T00:00:00.000Z",
      expiresAt: null,
      isActive: true,
    },
  ],
};

/**
 * Base grant, keyed by employee code so it can't drift from the person.
 *
 * It used to be keyed by department, which was fine while the roster was four
 * teachers but would have labelled the HR Manager, the Accountant and the
 * Warden "Teacher" the moment the directory listed them. Anyone not named
 * here teaches — that is the default for an academic department.
 */
const BASE_ROLE: Record<string, RoleAssignment["role"]> = {
  s4: "LIBRARIAN",
  s5: "HOD",
  s9: "INSTITUTION_ADMIN",
  s10: "HR_MANAGER",
  s11: "EXAM_CONTROLLER",
  s12: "ACCOUNTANT",
  s13: "HOSTEL_WARDEN",
  s14: "PLACEMENT_OFFICER",
  s15: "STORE_MANAGER",
};

/** Roles whose authority is institution-wide rather than department-scoped. */
const UNSCOPED_ROLES: RoleAssignment["role"][] = [
  "INSTITUTION_ADMIN",
  "HR_MANAGER",
  "EXAM_CONTROLLER",
  "ACCOUNTANT",
  "PLACEMENT_OFFICER",
  "STORE_MANAGER",
  "LIBRARIAN",
];

function buildRoles(seed: StaffSeed): RoleAssignment[] {
  const role = BASE_ROLE[seed.id] ?? "TEACHER";
  const scoped = !UNSCOPED_ROLES.includes(role);

  const base: RoleAssignment = {
    role,
    scopeType: scoped ? "DEPARTMENT" : null,
    scopeName: scoped ? seed.departmentName : null,
    assignedAt: `${seed.dateOfJoining}T00:00:00.000Z`,
    expiresAt: null,
    // `role_assignments.is_active` is per-grant and survives deactivation —
    // it is `users.is_active` (§5.5) that stops sign-in. Conflating them made
    // a deactivated person show zero roles, which contradicts the deactivate
    // dialog's own promise that the grants stay assigned.
    isActive: true,
  };

  return [base, ...(EXTRA_ROLES[seed.id] ?? [])];
}

/* ── Subjects taught — derived from the timetable (§6.5 + §7.8) ─────────── */

const SUBJECT_ROLE: Record<string, StaffSubject["roleInSubject"]> = {
  CS301: "TEACHER",
  CS201: "TEACHER",
};

/**
 * Built from `getTeacherSlots()` rather than hand-listed: the weekly period
 * count and the class list then can't drift from the timetable grid, which is
 * the mistake that produced 6 phantom clashes on PAGE 10.
 */
function buildSubjects(timetableName: string | null): StaffSubject[] {
  if (!timetableName) return [];

  const bySubject = new Map<string, StaffSubject>();

  for (const slot of getTeacherSlots(timetableName)) {
    if (!slot.subjectCode || !slot.subjectName) continue;

    const existing = bySubject.get(slot.subjectCode);
    if (existing) {
      existing.weeklyPeriods += 1;
      if (!existing.classNames.includes(slot.className)) {
        existing.classNames.push(slot.className);
      }
      continue;
    }

    bySubject.set(slot.subjectCode, {
      subjectCode: slot.subjectCode,
      subjectName: slot.subjectName,
      roleInSubject: SUBJECT_ROLE[slot.subjectCode] ?? "TEACHER",
      classNames: [slot.className],
      weeklyPeriods: 1,
    });
  }

  return [...bySubject.values()].sort(
    (a, b) => b.weeklyPeriods - a.weeklyPeriods,
  );
}

/* ── Attendance ─────────────────────────────────────────────────────────── */

/** [year, month, workingDays, presentDays, leaveDays, lopDays] */
const MONTH_ROWS: [number, number, number, number, number, number][] = [
  [2026, 7, 26, 24, 2, 0],
  [2026, 6, 25, 23, 2, 0],
  [2026, 5, 26, 25, 1, 0],
  [2026, 4, 24, 21, 2, 1],
  [2026, 3, 26, 26, 0, 0],
  [2026, 2, 24, 22, 1.5, 0.5],
];

const MONTHS: StaffAttendanceMonth[] = MONTH_ROWS.map(
  ([year, month, workingDays, presentDays, leaveDays, lopDays]) => ({
    year,
    month,
    workingDays,
    presentDays,
    leaveDays,
    lopDays,
  }),
);

/**
 * @param shift Days added to (or removed from) each month's present count,
 *              so different staff show different percentages.
 */
function buildAttendance(shift = 0): StaffAttendance {
  const months: StaffAttendanceMonth[] = MONTHS.map((m) => {
    const presentDays = Math.min(
      m.workingDays,
      Math.max(0, m.presentDays + shift),
    );
    // Days that stop being present become leave, so the row still balances
    const leaveDays = Math.max(0, m.workingDays - presentDays - m.lopDays);
    return { ...m, presentDays, leaveDays };
  });

  const worked = months.reduce((a, m) => a + m.workingDays, 0);
  const present = months.reduce((a, m) => a + m.presentDays, 0);

  return {
    months,
    overallPct: Math.round((present / worked) * 100),
    recent: [
      { date: on(0), status: "PRESENT" },
      { date: on(-1), status: "PRESENT" },
      { date: on(-2), status: "ON_LEAVE" },
      { date: on(-3), status: "ON_LEAVE" },
      { date: on(-4), status: "PRESENT" },
      { date: on(-5), status: "HOLIDAY" },
      { date: on(-6), status: "PRESENT" },
      { date: on(-7), status: "PRESENT" },
      { date: on(-8), status: "ABSENT" },
      { date: on(-9), status: "PRESENT" },
    ],
  };
}

/* ── Leave (§8.5) ───────────────────────────────────────────────────────── */

/** `leave_policies` for this tenant. */
const POLICIES = [
  { code: "CL", name: "Casual Leave", daysPerYear: 12, carriedForward: 0 },
  { code: "SL", name: "Sick Leave", daysPerYear: 10, carriedForward: 0 },
  { code: "EL", name: "Earned Leave", daysPerYear: 15, carriedForward: 4 },
];

const LEAVE_SEED: StaffLeaveRequest[] = [
  {
    id: "lr-1",
    policyCode: "CL",
    policyName: "Casual Leave",
    fromDate: on(4),
    toDate: on(5),
    totalDays: 2,
    reason: "Family function out of station.",
    // Mid-workflow on purpose, so the HR Manager's approve/reject actions are
    // demoable — the PAGE 19 lesson about fixture state hiding the main flow.
    status: "PENDING",
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    documentName: null,
  },
  {
    id: "lr-2",
    policyCode: "SL",
    policyName: "Sick Leave",
    fromDate: on(-27),
    toDate: on(-26),
    totalDays: 2,
    reason: "Viral fever — medical certificate attached.",
    status: "APPROVED",
    reviewedByName: "Anita Desai",
    reviewedAt: at(25),
    reviewNote: "Approved. Get well soon.",
    documentName: "medical-certificate.pdf",
  },
  {
    id: "lr-3",
    policyCode: "EL",
    policyName: "Earned Leave",
    fromDate: on(-88),
    toDate: on(-84),
    totalDays: 5,
    reason: "Annual family holiday.",
    status: "APPROVED",
    reviewedByName: "Anita Desai",
    reviewedAt: at(92),
    reviewNote: null,
    documentName: null,
  },
  {
    id: "lr-4",
    policyCode: "CL",
    policyName: "Casual Leave",
    fromDate: on(-118),
    toDate: on(-118),
    totalDays: 0.5,
    reason: "Half day — school admission for daughter.",
    status: "APPROVED",
    reviewedByName: "Anita Desai",
    reviewedAt: at(120),
    reviewNote: null,
    documentName: null,
  },
  {
    id: "lr-5",
    policyCode: "EL",
    policyName: "Earned Leave",
    fromDate: on(-140),
    toDate: on(-134),
    totalDays: 7,
    reason: "Extended personal travel.",
    status: "REJECTED",
    reviewedByName: "Anita Desai",
    reviewedAt: at(145),
    reviewNote: "Clashes with the mid-term examination window.",
    documentName: null,
  },
];

/**
 * Balances are *computed* from the approved requests, never stored — a
 * hand-written balance that disagreed with the history would be the same class
 * of bug as the phantom timetable clashes.
 */
/**
 * Only `s1` has the pending request, so the HR Manager's approve / reject
 * actions are demoable on one record without every staff member looking like
 * they are mid-application.
 */
function buildLeaveRequests(id: string): StaffLeaveRequest[] {
  return id === "s1"
    ? LEAVE_SEED
    : LEAVE_SEED.filter((r) => r.status !== "PENDING");
}

function buildBalances(requests: StaffLeaveRequest[]): StaffLeaveBalance[] {
  return POLICIES.map((p) => {
    const used = requests.filter(
      (r) => r.policyCode === p.code && r.status === "APPROVED",
    ).reduce((a, r) => a + r.totalDays, 0);

    return {
      policyCode: p.code,
      policyName: p.name,
      daysPerYear: p.daysPerYear,
      carriedForward: p.carriedForward,
      used,
      balance: p.daysPerYear + p.carriedForward - used,
    };
  });
}

/* ── Payroll (§8.5) ─────────────────────────────────────────────────────── */

/**
 * Built from basic pay: HRA 40%, DA 20%, PF 12% of basic — so every component
 * and both totals stay internally consistent for any staff member.
 */
function buildSalary(basic: number): StaffSalary {
  const earnings: SalaryComponent[] = [
    { name: "Basic", amount: basic },
    { name: "HRA", amount: Math.round(basic * 0.4) },
    { name: "DA", amount: Math.round(basic * 0.2) },
    { name: "Transport allowance", amount: 3200 },
  ];

  const gross = earnings.reduce((a, c) => a + c.amount, 0);

  const deductions: SalaryComponent[] = [
    { name: "PF", amount: Math.round(basic * 0.12) },
    { name: "Professional tax", amount: 200 },
    { name: "TDS", amount: Math.round(gross * 0.085) },
  ];

  const totalDeductions = deductions.reduce((a, c) => a + c.amount, 0);

  return {
    effectiveFrom: "2026-04-01",
    earnings,
    deductions,
    gross,
    net: gross - totalDeductions,
  };
}

const PAYSLIP_STATUS: Record<number, StaffPayslip["status"]> = {
  7: "PROCESSED", // current month, not yet paid
  6: "PAID",
  5: "PAID",
  4: "LOCKED",
};

/**
 * Payslips are derived from the salary structure and the attendance months,
 * with loss-of-pay pro-rated on basic — so April's 1 LOP day visibly reduces
 * the net, instead of every month showing an identical figure.
 */
function buildPayslips(
  salary: StaffSalary,
  attendance: StaffAttendance,
): StaffPayslip[] {
  const totalDeductions = salary.deductions.reduce((a, c) => a + c.amount, 0);

  return attendance.months
    .filter((m) => m.month >= 4)
    .map((m) => {
      const perDay = salary.gross / m.workingDays;
      const lopAmount = Math.round(perDay * m.lopDays);
      const gross = salary.gross - lopAmount;

      return {
        id: `ps-${m.year}-${m.month}`,
        year: m.year,
        month: m.month,
        status: PAYSLIP_STATUS[m.month] ?? "PAID",
        workingDays: m.workingDays,
        presentDays: m.presentDays,
        leaveDays: m.leaveDays,
        lopDays: m.lopDays,
        gross,
        totalDeductions,
        net: gross - totalDeductions,
        fileName:
          PAYSLIP_STATUS[m.month] === "PROCESSED"
            ? null
            : `payslip-${m.year}-${String(m.month).padStart(2, "0")}.pdf`,
      };
    });
}

/* ── Documents + appraisals (§8.5) ──────────────────────────────────────── */

/** [type, file, uploader, days ago] — offsets are relative to date of joining. */
const DOCUMENT_SEED: [StaffDocument["documentType"], string, string, number][] = [
  ["OFFER_LETTER", "offer-letter", "Anita Desai", 3],
  ["CONTRACT", "employment-contract", "Anita Desai", -1],
  ["CERTIFICATE", "degree-certificate", "self", 20],
  ["ID_PROOF", "aadhaar-masked", "self", 20],
];

function buildDocuments(seed: StaffSeed): StaffDocument[] {
  const joined = Date.parse(seed.dateOfJoining);
  const year = seed.dateOfJoining.slice(0, 4);

  return DOCUMENT_SEED.map(([documentType, stem, uploader, offset], i) => ({
    id: `doc-${seed.id}-${i + 1}`,
    documentType,
    fileName: `${stem}-${documentType === "CONTRACT" ? "2024-renewal" : year}.pdf`,
    uploadedByName: uploader === "self" ? seed.name : uploader,
    uploadedAt: new Date(
      // Contract is the 2024 renewal; the rest cluster around joining
      documentType === "CONTRACT" ? T0 - 480 * DAY : joined + offset * DAY,
    ).toISOString(),
  }));
}

/** [cycle, self, reviewer, final, rating, status, days ago] */
const APPRAISAL_SEED: [
  string,
  number | null,
  number | null,
  number | null,
  string | null,
  StaffAppraisal["status"],
  number,
][] = [
  ["Appraisal 2025-26", 8.5, null, null, null, "SUBMITTED", 9],
  ["Appraisal 2024-25", 8, 8.4, 8.2, "Excellent", "CLOSED", 380],
  ["Appraisal 2023-24", 7.5, 7.2, 7.35, "Good", "CLOSED", 745],
];

const APPRAISAL_COMMENTS: Record<string, string> = {
  "Appraisal 2024-25":
    "Consistently strong student feedback. Took on the FY-A mentor group mid-year without dropping teaching load.",
  "Appraisal 2023-24":
    "Solid year. Encouraged to publish and to lead a lab section.",
};

/**
 * The reviewer is the department head (§8.5: `appraisals.reviewer_id`).
 * A head can't review themselves, so HR reviews them instead.
 */
const REVIEWER: Record<string, string> = {
  CSE: "Kavita Menon",
  ECE: "Sunil Rao",
  Library: "Anita Desai",
};

/** HR Manager — reviews the department heads. */
const HR_REVIEWER = "Anita Desai";

function buildAppraisals(id: string): StaffAppraisal[] {
  const seed = byId(id);
  if (!seed) return [];

  const head = REVIEWER[seed.departmentName];
  const reviewer =
    !head || head === seed.name ? HR_REVIEWER : head;
  const joined = Date.parse(seed.dateOfJoining);

  return APPRAISAL_SEED.filter(
    // No appraisal for a cycle that closed before they joined
    ([, , , , , , daysAgo]) => T0 - daysAgo * DAY > joined,
  ).map(([cycleName, selfScore, reviewerScore, finalScore, rating, status, daysAgo], i) => ({
    id: `ap-${id}-${i + 1}`,
    cycleName,
    reviewerName: reviewer,
    selfScore,
    reviewerScore,
    finalScore,
    rating,
    status,
    comments: finalScore !== null ? (APPRAISAL_COMMENTS[cycleName] ?? null) : null,
    submittedAt: at(daysAgo),
  }));
}

/* ── Assembly ───────────────────────────────────────────────────────────── */

/**
 * Records vary per person so the page can't look identical for everyone:
 * `s1` is mid-workflow (pending leave, submitted appraisal, unpaid month),
 * `s4` is non-teaching, `s2` and `s3` are steady state.
 *
 * Anyone without an explicit entry gets a shift derived from their id, so the
 * roster doesn't show one identical percentage down the column.
 */
const ATTENDANCE_SHIFT: Record<string, number> = {
  s1: 0,
  s2: -1,
  s3: 1,
  s4: -2,
};

function attendanceShift(id: string): number {
  const explicit = ATTENDANCE_SHIFT[id];
  if (explicit !== undefined) return explicit;
  // -2…+1, deterministic per id
  return ((Number(id.slice(1)) * 7) % 4) - 2;
}

/**
 * Basic pay. Explicit for the four original records; derived from experience
 * for the rest, so a 22-year professor isn't paid the same as a first-year
 * lecturer and nobody falls back to one shared placeholder figure.
 */
const BASIC: Record<string, number> = {
  s1: 62000,
  s2: 54000,
  s3: 78000,
  s4: 46000,
};

function basicPay(seed: StaffSeed): number {
  const explicit = BASIC[seed.id];
  if (explicit !== undefined) return explicit;
  // ₹34k floor plus ₹2k per year of experience, rounded to the nearest ₹500
  return Math.round((34000 + seed.experienceYears * 2000) / 500) * 500;
}

function byId(id: string): StaffSeed | undefined {
  return STAFF.find((s) => s.id === id);
}

export function getStaffDetail(
  id: string,
  perms: StaffDetailPermissions,
  /** Tabs after the module filter — a disabled module must not ship data */
  tabs: StaffTab[] = perms.tabs,
): StaffDetail | undefined {
  const seed = byId(id);
  if (!seed) return undefined;

  const keys = new Set(tabs.map((t) => t.key));
  const attendance = buildAttendance(attendanceShift(id));
  const salary = buildSalary(basicPay(seed));
  const leaveRequests = buildLeaveRequests(id);

  // `timetableName` is a fixture-only join key — it must not ship to the client
  const { timetableName, ...summary } = seed;
  void timetableName;
  const detail: StaffDetail = {
    summary: { ...summary, attendancePct: attendance.overallPct },
  };

  // Confidential — masked on the server (§11); an omitted section is absent
  // from the payload, not merely hidden by CSS.
  const raw = bankingFor(seed);
  if (perms.canViewBanking && keys.has("PROFILE")) {
    detail.banking = {
      ...raw,
      panNumber: maskTail(raw.panNumber, 4),
      bankAccountNo: maskTail(raw.bankAccountNo, 4),
      pfNumber: maskTail(raw.pfNumber, 5),
    };
  }

  if (keys.has("ROLES")) detail.roles = buildRoles(seed);
  if (keys.has("SUBJECTS")) detail.subjects = buildSubjects(seed.timetableName);
  if (keys.has("ATTENDANCE")) detail.attendance = attendance;
  if (keys.has("LEAVE_HISTORY") || keys.has("LEAVE_BALANCE")) {
    detail.leaveRequests = leaveRequests;
  }
  if (keys.has("LEAVE_BALANCE")) {
    detail.leaveBalances = buildBalances(leaveRequests);
  }
  if (keys.has("SALARY")) detail.salary = salary;
  if (keys.has("PAYSLIPS")) detail.payslips = buildPayslips(salary, attendance);
  if (keys.has("DOCUMENTS")) detail.documents = buildDocuments(seed);
  if (keys.has("APPRAISALS")) detail.appraisals = buildAppraisals(id);

  return detail;
}

/**
 * Department of a staff member, used to enforce the HOD's "own dept" fence
 * before any section is built, and to 404 unknown ids.
 * TODO(Dev-B): on the real endpoint this is a `WHERE` clause, not a UI check.
 */
export function getStaffDepartment(id: string): string | undefined {
  return byId(id)?.departmentName;
}

/**
 * Directory rows — used by pages that list staff (PAGE 12) or link into a
 * staff record (search, PAGE 17).
 *
 * This is the identity half of `users` (§5.5) plus the non-confidential half
 * of `staff_profiles` (§8.5) and the grants from `role_assignments` (§5.6).
 * Nothing from the HR/banking/salary side is included — a list of people is
 * not the place to ship a PAN number, and PAGE 20 already owns that surface
 * behind its own permission check.
 */
export interface StaffDirectoryRow {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  departmentName: string;
  email: string;
  phone: string;
  employmentType: StaffSummary["employmentType"];
  dateOfJoining: string;
  experienceYears: number;
  /**
   * Basic pay (§8.5 `salary_structures.basic_salary`). Exposed so payroll
   * roll-ups don't re-implement `basicPay()` and drift from the payslip the
   * staff detail page renders for the same person.
   */
  basicSalary: number;
  isActive: boolean;
  /** Roles actually held, base grant first (§5.6) */
  roles: InstitutionRole[];
  /** `users.last_login_at` — null when the account has never signed in */
  lastLoginAt: string | null;
}

/**
 * Last sign-in per staff member (§5.5 `last_login_at`).
 *
 * Derived from the id so the column has spread instead of one repeated
 * timestamp, with two deliberate cases the admin needs to be able to spot:
 * the deactivated account, and the visiting lecturer who has never logged in.
 */
function lastLoginFor(seed: StaffSeed): string | null {
  if (!seed.isActive) return at(4); // last seen just before deactivation
  if (seed.employmentType === "VISITING") return null; // never signed in
  const n = Number(seed.id.slice(1));
  // 0–6 days ago, plus a stable time of day
  const hoursAgo = (n * 11) % 168;
  return new Date(T0 - hoursAgo * 60 * 60 * 1000).toISOString();
}

export function getStaffDirectory(): StaffDirectoryRow[] {
  return STAFF.map((seed) => {
    const { timetableName, ...summary } = seed;
    void timetableName;

    return {
      ...summary,
      // Derived here so payroll roll-ups (PAGE 14) and the individual payslip
      // (PAGE 20) can never apply two different salary rules.
      basicSalary: basicPay(seed),
      // Grants still on the record. A deactivated account keeps its roles —
      // they simply stop granting access — so this is not filtered by
      // `seed.isActive`; the UI greys the chips instead.
      roles: buildRoles(seed)
        .filter((r) => r.isActive)
        .map((r) => r.role),
      lastLoginAt: lastLoginFor(seed),
    };
  });
}

/** Resolve a timetable/assignment teacher name to a staff id, if we have one. */
export function findStaffIdByName(name: string): string | undefined {
  return STAFF.find((s) => s.timetableName === name)?.id;
}

/** Roles that may appear in the Institution Admin's role picker (§5.6). */
export const ASSIGNABLE_ROLES: InstitutionRole[] = [
  "TEACHER",
  "MENTOR",
  "HOD",
  "EXAM_CONTROLLER",
  "ACADEMIC_COORDINATOR",
];
