import type { InstitutionRole } from "@/types/auth";
import type {
  EditableField,
  HrProfile,
  ProfilePermissions,
  ProfileSection,
} from "@/types/profile";

/**
 * Profile field permissions — role_based_shared_pages.md PAGE 4.
 *
 * Same data-driven approach as notices and discussion: the matrix lives here,
 * the form just reads `editable.has(field)`. That keeps the allow-list in one
 * place and gives the backend an exact list to mirror.
 *
 * TODO(Dev-A): `PATCH /api/v1/users/me` must re-validate this allow-list —
 * this is UX only, never the security boundary.
 */

/** PAGE 4: every role can change these three on their own profile. */
const SELF_EDIT: EditableField[] = ["name", "phone", "avatar"];

/** Institution Admin — "All fields + role assignments / Full edit". */
const ADMIN_EDIT: EditableField[] = [
  ...SELF_EDIT,
  "email",
  "gender",
  "dateOfBirth",
  "address",
  "employeeCode",
  "studentRollNo",
  "isActive",
  "roleAssignments",
];

/** HR Manager — self-edit plus the extended HR record. */
const HR_EDIT: EditableField[] = [...SELF_EDIT, "hr"];

/** Roles that carry an employee code + designation (all non-student/parent). */
const STUDENT_ROLES: InstitutionRole[] = ["STUDENT"];
const PARENT_ROLES: InstitutionRole[] = ["PARENT"];

/**
 * Resolve what the viewer may see and edit on **their own** profile.
 * Multi-role users get the union of editable fields and sections.
 */
export function profilePermissions(
  roles: InstitutionRole[],
): ProfilePermissions {
  const editable = new Set<EditableField>();
  const sections = new Set<ProfileSection>();
  const notes: string[] = [];

  for (const role of roles) {
    const isStudent = STUDENT_ROLES.includes(role);
    const isParent = PARENT_ROLES.includes(role);

    if (role === "INSTITUTION_ADMIN") {
      ADMIN_EDIT.forEach((f) => editable.add(f));
      sections.add("roleAssignments");
      notes.push("You have full edit access, including role assignments.");
    } else if (role === "HR_MANAGER") {
      HR_EDIT.forEach((f) => editable.add(f));
      sections.add("hr");
      notes.push("You can edit extended HR details.");
    } else {
      SELF_EDIT.forEach((f) => editable.add(f));
    }

    // Role-specific sections
    if (isStudent) sections.add("student");
    else if (isParent) sections.add("children");
    else sections.add("staff");
  }

  sections.add("security");

  return {
    editable,
    sections: [...sections],
    note:
      notes[0] ??
      "You can update your name, phone number and profile photo. Contact your institution admin to change anything else.",
  };
}

/** Field-level guard used by the form. */
export function canEdit(
  perms: ProfilePermissions,
  field: EditableField,
): boolean {
  return perms.editable.has(field);
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

export const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  VISITING: "Visiting",
};

export const ENROLLMENT_LABELS: Record<string, string> = {
  ENROLLED: "Enrolled",
  ALUMNI: "Alumni",
  SUSPENDED: "Suspended",
  TRANSFERRED: "Transferred",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

/**
 * Mask sensitive HR values — PAN, bank account, PF (§11 audit & security).
 *
 * Applied on the **server** before the payload is sent: revealing must be a
 * fresh authenticated request, never a client-side toggle over data that was
 * already shipped in the HTML.
 */
export function maskTail(value: string | null, visible = 4): string | null {
  if (!value) return null;
  if (value.length <= visible) return value;
  return `${"•".repeat(Math.max(4, value.length - visible))}${value.slice(-visible)}`;
}

/**
 * Redact the sensitive columns of an HR record.
 *
 * TODO(Dev-B): the real `GET /users/me` should return these already masked and
 * expose a separate audited endpoint (e.g. `GET /users/:id/hr/reveal`) that
 * logs who unmasked what — see §11.
 */
export function redactHr(hr: HrProfile): HrProfile {
  return {
    ...hr,
    panNumber: maskTail(hr.panNumber, 4),
    bankAccountNo: maskTail(hr.bankAccountNo, 4),
    pfNumber: maskTail(hr.pfNumber, 5),
  };
}
