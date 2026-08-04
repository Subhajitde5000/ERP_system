/**
 * Institution admin API client — the real backend behind the /admin console.
 *
 * Every call is tenant-scoped: the backend resolves the tenant from the JWT,
 * so no slug is sent. The access token comes from the tenant auth store in
 * `lib/auth.ts` (in-memory). 401s are surfaced so the shell can redirect to
 * the institution login.
 */

import { API_BASE_URL, getAccessToken, refreshAccessToken } from "./auth";
import { APIError, requestJson, guardTenantRefresh } from "./api-client";

const BASE = `${API_BASE_URL}/api/v1/institution`;

/** Re-exported so admin pages can `catch (e) { if (e instanceof …) }`. */
export { APIError as InstitutionAPIError };

const call = <T>(path: string, init: RequestInit = {}): Promise<T> =>
  requestJson<T>(
    `${BASE}${path}`,
    init,
    getAccessToken(),
    "InstitutionAPIError",
    refreshAccessToken,
    guardTenantRefresh,
  );

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  tenant_id: string;
  name: string;
  slug: string;
  type: string;
  academic_year: string | null;
  counts: Record<string, number>;
  enabled_modules: string[];
  onboarding_complete: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  hod_id: string | null;
  hod_name: string | null;
  is_active: boolean;
  class_count: number;
  staff_count: number;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  roles: string[];
  department_id: string | null;
  department_name: string | null;
}

export interface StudentEnrollment {
  id: string;
  class_id: string;
  class_name: string;
  roll_number: string | null;
}

export interface Student {
  id: string;
  name: string;
  email: string | null;
  roll_no: string | null;
  gender: string | null;
  is_active: boolean;
  enrollment: StudentEnrollment | null;
}

export interface ClassRow {
  id: string;
  name: string;
  code: string;
  department_id: string;
  department_name: string | null;
  academic_year_id: string;
  academic_year_name: string | null;
  max_strength: number;
  room_no: string | null;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  is_active: boolean;
  enrolled_count: number;
  subject_count: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  roll_number: string | null;
  status: string;
  enrollment_date: string;
}

export interface StudentCreate {
  name: string;
  roll_no: string;
  email?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  date_of_birth?: string;
  class_id?: string;
}

export interface BulkUploadRowIssue {
  row: number;
  message: string;
}

export interface BulkUploadResult {
  total: number;
  created: number;
  errors: BulkUploadRowIssue[];
  warnings: BulkUploadRowIssue[];
}

export interface ModuleRow {
  key: string;
  name: string;
  is_core: boolean;
  is_enabled: boolean;
  price_monthly: number;
}

export interface SettingsInfo {
  timezone: string;
  currency: string;
  onboarding_complete: boolean;
}

export interface InstitutionProfile {
  id: string;
  name: string;
  slug: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  website: string | null;
  logo_url: string | null;
  timezone: string;
  plan_name: string | null;
  subscription_status: string | null;
}

// ── Calls ────────────────────────────────────────────────────────────────────

export const fetchDashboard = () => call<DashboardSummary>("/dashboard");

export const fetchAcademicYears = () => call<AcademicYear[]>("/academic-years");
export const createAcademicYear = (payload: Partial<AcademicYear> & { name: string; start_date: string; end_date: string }) =>
  call<AcademicYear>("/academic-years", { method: "POST", body: JSON.stringify(payload) });
export const updateAcademicYear = (id: string, payload: Partial<AcademicYear>) =>
  call<AcademicYear>(`/academic-years/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteAcademicYear = (id: string) =>
  call<null>(`/academic-years/${id}`, { method: "DELETE" });

export const fetchDepartments = () => call<Department[]>("/departments");
export const createDepartment = (payload: { name: string; code: string; description?: string }) =>
  call<Department>("/departments", { method: "POST", body: JSON.stringify(payload) });
export const updateDepartment = (id: string, payload: { hod_id?: string | null; name?: string; description?: string; is_active?: boolean }) =>
  call<Department>(`/departments/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export const fetchStaff = () => call<StaffMember[]>("/staff");
export const uploadStaff = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return call<BulkUploadResult>("/staff/bulk", { method: "POST", body: form });
};
export const inviteStaff = (payload: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  departmentId?: string;
}) =>
  call<StaffMember>("/staff", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      department_id: payload.departmentId,
    }),
  });
export const assignStaffRole = (userId: string, roleName: string, departmentId?: string) =>
  call<StaffMember>(`/staff/${userId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ role_name: roleName, department_id: departmentId }),
  });
export const revokeStaffRole = (userId: string, roleName: string, departmentId?: string) =>
  call<StaffMember>(
    `/staff/${userId}/roles/${encodeURIComponent(roleName)}${
      departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : ""
    }`,
    { method: "DELETE" },
  );

export const fetchStudents = () => call<Student[]>("/students");
export const uploadStudents = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return call<BulkUploadResult>("/students/bulk", { method: "POST", body: form });
};
export const createStudent = (payload: StudentCreate) =>
  call<Student>("/students", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      roll_no: payload.roll_no,
      email: payload.email || undefined,
      gender: payload.gender || undefined,
      date_of_birth: payload.date_of_birth || undefined,
      class_id: payload.class_id || undefined,
    }),
  });

export const fetchClasses = () => call<ClassRow[]>("/classes");
export const fetchEnrollments = () => call<Enrollment[]>("/enrollments");
export const createEnrollment = (payload: {
  student_id: string;
  class_id: string;
  roll_number?: string;
}) =>
  call<Enrollment>("/enrollments", {
    method: "POST",
    body: JSON.stringify({
      student_id: payload.student_id,
      class_id: payload.class_id,
      roll_number: payload.roll_number || undefined,
    }),
  });

export const fetchModules = () => call<ModuleRow[]>("/modules");
export const toggleModule = (key: string, enabled: boolean) =>
  call<ModuleRow>(`/modules/${key}`, { method: "PUT", body: JSON.stringify({ enabled }) });

export const fetchSettings = () => call<SettingsInfo>("/settings");
export const updateSettings = (payload: Partial<SettingsInfo>) =>
  call<SettingsInfo>("/settings", { method: "PUT", body: JSON.stringify(payload) });

export const fetchProfile = () => call<InstitutionProfile>("/profile");
export const updateProfile = (payload: Partial<InstitutionProfile>) =>
  call<InstitutionProfile>("/profile", { method: "PUT", body: JSON.stringify(payload) });
