import type { InstitutionRole } from "./auth";

/**
 * Profile contracts — role_based_shared_pages.md PAGE 4 (C-RB-04).
 * Mirrors `users` (DB §5.5), `staff_profiles` (§8.5),
 * `parent_student_links` (§6.7) and `role_assignments` (§5.6).
 */

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "VISITING";

/** Core `users` row — common to every role. */
export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  address: string | null;
  /** Staff only */
  employeeCode: string | null;
  /** Students only */
  studentRollNo: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
}

/** Staff-facing extras — department + designation (PAGE 4). */
export interface StaffInfo {
  designation: string;
  departmentName: string;
}

/** Student-facing extras — class + enrolment status (PAGE 4). */
export interface StudentInfo {
  className: string;
  enrollmentStatus: "ENROLLED" | "ALUMNI" | "SUSPENDED" | "TRANSFERRED";
  academicYear: string;
}

/** A child linked to a parent account (DB §6.7). */
export interface LinkedChild {
  id: string;
  name: string;
  className: string;
  rollNo: string;
  relation: string;
  isPrimary: boolean;
}

/** Extended HR record — HR Manager only (DB §8.5). */
export interface HrProfile {
  employmentType: EmploymentType;
  dateOfJoining: string;
  dateOfLeaving: string | null;
  qualification: string | null;
  experienceYears: number;
  panNumber: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  pfNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/** A role grant shown in the Institution Admin view (DB §5.6). */
export interface RoleAssignment {
  role: InstitutionRole;
  scopeType: "DEPARTMENT" | "CLASS" | "SUBJECT" | null;
  scopeName: string | null;
  assignedAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

/** Response of `GET /users/me` — sections vary by role (PAGE 4). */
export interface ProfileData {
  user: UserProfile;
  staff?: StaffInfo;
  student?: StudentInfo;
  children?: LinkedChild[];
  hr?: HrProfile;
  roleAssignments?: RoleAssignment[];
}

/**
 * Which fields a viewer may edit.
 *
 * PAGE 4 gives most roles "Name, phone, avatar only", Institution Admin full
 * edit, and HR Manager full HR edit. Expressed as a field set rather than a
 * boolean so the form can disable individual inputs and the backend has an
 * exact allow-list to mirror.
 */
export type EditableField =
  | "name"
  | "phone"
  | "avatar"
  | "email"
  | "gender"
  | "dateOfBirth"
  | "address"
  | "employeeCode"
  | "studentRollNo"
  | "isActive"
  | "roleAssignments"
  | "hr";

/** Optional sections rendered below the identity card. */
export type ProfileSection =
  | "staff"
  | "student"
  | "children"
  | "hr"
  | "roleAssignments"
  | "security";

export interface ProfilePermissions {
  /** Fields this viewer may change */
  editable: Set<EditableField>;
  /** Sections this viewer may see */
  sections: ProfileSection[];
  /** Explains the edit scope under the page heading */
  note: string;
}
