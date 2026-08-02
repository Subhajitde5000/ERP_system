import type { InstitutionRole } from "@/types/auth";
import type { ProfileData } from "@/types/profile";

/**
 * Profile data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): replace with the real endpoints (PAGE 4, C-RB-04).
 *
 *   GET   /api/v1/users/me            → fields filtered by role, server-side
 *   PATCH /api/v1/users/me            → allow-list must mirror lib/profile.ts
 *   POST  /api/v1/storage/presign     → avatar upload (module: 'avatar')
 *   PATCH /api/v1/users/me/password   → change password
 *
 * Shapes below match the API response exactly, so swapping this file for a
 * fetch is a one-line change in the page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STAFF_ROLES_WITH_DEPT: Partial<
  Record<InstitutionRole, { designation: string; departmentName: string }>
> = {
  INSTITUTION_ADMIN: { designation: "Institution Administrator", departmentName: "Administration" },
  PRINCIPAL: { designation: "Principal", departmentName: "Administration" },
  VICE_PRINCIPAL: { designation: "Vice Principal", departmentName: "Administration" },
  HOD: { designation: "Head of Department", departmentName: "CSE" },
  TEACHER: { designation: "Assistant Professor", departmentName: "CSE" },
  MENTOR: { designation: "Assistant Professor · Mentor", departmentName: "CSE" },
  EXAM_CONTROLLER: { designation: "Examination Controller", departmentName: "Examination Cell" },
  ACADEMIC_COORDINATOR: { designation: "Academic Coordinator", departmentName: "Academics" },
  ACCOUNTANT: { designation: "Senior Accountant", departmentName: "Accounts" },
  LIBRARIAN: { designation: "Chief Librarian", departmentName: "Library" },
  HOSTEL_WARDEN: { designation: "Hostel Warden", departmentName: "Hostel" },
  TRANSPORT_MANAGER: { designation: "Transport Manager", departmentName: "Transport" },
  PLACEMENT_OFFICER: { designation: "Placement Officer", departmentName: "Placement Cell" },
  HR_MANAGER: { designation: "HR Manager", departmentName: "Human Resources" },
  ADMISSION_OFFICER: { designation: "Admission Officer", departmentName: "Admissions" },
  STORE_MANAGER: { designation: "Store Manager", departmentName: "Stores" },
};

/** Demo contact details, keyed off the role so each profile looks distinct. */
const CONTACTS: Partial<Record<InstitutionRole, { email: string; phone: string }>> = {
  INSTITUTION_ADMIN: { email: "meera.k@abc-college.edu", phone: "+91 98450 11234" },
  PRINCIPAL: { email: "principal@abc-college.edu", phone: "+91 98450 22345" },
  HOD: { email: "kavita.m@abc-college.edu", phone: "+91 98450 44567" },
  TEACHER: { email: "priya.s@abc-college.edu", phone: "+91 98450 55678" },
  MENTOR: { email: "rajiv.n@abc-college.edu", phone: "+91 98450 66789" },
  EXAM_CONTROLLER: { email: "deepak.i@abc-college.edu", phone: "+91 98450 77890" },
  ACADEMIC_COORDINATOR: { email: "latha.v@abc-college.edu", phone: "+91 98450 88901" },
  ACCOUNTANT: { email: "suresh.p@abc-college.edu", phone: "+91 98450 99012" },
  LIBRARIAN: { email: "fatima.s@abc-college.edu", phone: "+91 98451 10123" },
  HOSTEL_WARDEN: { email: "ramesh.g@abc-college.edu", phone: "+91 98451 21234" },
  TRANSPORT_MANAGER: { email: "mohan.j@abc-college.edu", phone: "+91 98451 32345" },
  PLACEMENT_OFFICER: { email: "vikram.n@abc-college.edu", phone: "+91 98451 43456" },
  HR_MANAGER: { email: "anita.d@abc-college.edu", phone: "+91 98451 54567" },
  ADMISSION_OFFICER: { email: "neha.r@abc-college.edu", phone: "+91 98451 65678" },
  STORE_MANAGER: { email: "ganesh.b@abc-college.edu", phone: "+91 98451 76789" },
  STUDENT: { email: "aryan.mehta@abc-college.edu", phone: "+91 98451 87890" },
  PARENT: { email: "rao.family@gmail.com", phone: "+91 98451 98901" },
};

/**
 * Build the profile for the signed-in user.
 * Mirrors `GET /users/me`, which returns only the sections the role owns.
 *
 * @param role   Active role — drives contact details and the identity card
 * @param name   Display name
 * @param roles  All held roles; a multi-role user sees the union of sections
 */
export function getProfile(
  role: InstitutionRole,
  name: string,
  roles: InstitutionRole[] = [role],
): ProfileData {
  const contact = CONTACTS[role] ?? {
    email: "user@abc-college.edu",
    phone: "+91 98450 00000",
  };
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  const staffMeta = STAFF_ROLES_WITH_DEPT[role];

  const data: ProfileData = {
    user: {
      id: "u-self",
      name,
      email: contact.email,
      phone: contact.phone,
      avatarUrl: null,
      gender: isStudent || isParent ? "MALE" : "FEMALE",
      dateOfBirth: isStudent ? "2006-03-14" : "1988-11-02",
      address: "14, MG Road, Bengaluru, Karnataka 560001",
      employeeCode: staffMeta ? "EMP-2019-0142" : null,
      studentRollNo: isStudent ? "ROLL142" : null,
      isActive: true,
      emailVerifiedAt: "2026-01-12T09:00:00.000Z",
      phoneVerifiedAt: isStudent ? null : "2026-01-12T09:04:00.000Z",
      lastLoginAt: "2026-07-29T03:58:00.000Z",
    },
  };

  if (staffMeta) data.staff = staffMeta;

  if (isStudent) {
    data.student = {
      className: "FY-BSc-A",
      enrollmentStatus: "ENROLLED",
      academicYear: "2024-25",
    };
  }

  if (isParent) {
    data.children = [
      {
        id: "s-1",
        name: "Ananya Rao",
        className: "Class 8-B",
        rollNo: "ADM1024",
        relation: "Father",
        isPrimary: true,
      },
      {
        id: "s-2",
        name: "Aditya Rao",
        className: "Class 5-A",
        rollNo: "ADM1188",
        relation: "Father",
        isPrimary: false,
      },
    ];
  }

  // Extended HR record — only returned to HR Manager (PAGE 4)
  if (roles.includes("HR_MANAGER")) {
    data.hr = {
      employmentType: "FULL_TIME",
      dateOfJoining: "2019-06-12",
      dateOfLeaving: null,
      qualification: "MBA (HR), PGDM",
      experienceYears: 11,
      panNumber: "ABCDE1234F",
      bankAccountNo: "50100234567890",
      bankIfsc: "HDFC0001234",
      bankName: "HDFC Bank",
      pfNumber: "KN/BNG/0012345/678",
      emergencyContactName: "Rohan Desai",
      emergencyContactPhone: "+91 98451 54568",
    };
  }

  // Role assignments — Institution Admin sees the full grant list (DB §5.6)
  if (roles.includes("INSTITUTION_ADMIN")) {
    data.roleAssignments = [
      {
        role: "INSTITUTION_ADMIN",
        scopeType: null,
        scopeName: null,
        assignedAt: "2024-04-01T00:00:00.000Z",
        expiresAt: null,
        isActive: true,
      },
      {
        role: "PRINCIPAL",
        scopeType: null,
        scopeName: null,
        assignedAt: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-08-31T00:00:00.000Z",
        isActive: true,
      },
    ];
  }

  return data;
}
