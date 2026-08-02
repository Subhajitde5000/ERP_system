/**
 * Setup wizard API client — first-time institution configuration (Step 10).
 * Authenticated tenant endpoints: GET/PUT /api/v1/setup, POST /api/v1/setup/complete.
 * The access token comes from lib/auth.ts's in-memory store.
 */

import { API_BASE_URL, getAccessToken } from "./auth";

// ── Step payloads (mirror backend app/schemas/setup.py) ──────────────────────

export interface SetupProfile {
  name?: string | null;
  type?: "SCHOOL" | "COLLEGE" | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  website?: string | null;
  timezone?: string | null;
}

export interface SetupAcademicYear {
  name: string;
  start_date: string;
  end_date: string;
}

export interface SetupDepartment {
  name: string;
  code: string;
  description?: string | null;
}

export interface SetupProgram {
  name: string;
  code: string;
}

export interface SetupClass {
  name: string;
  code: string;
  department_code: string;
  program_code?: string | null;
  section?: string | null;
  max_strength: number;
  room_no?: string | null;
}

export interface SetupSubject {
  name: string;
  code: string;
  class_code: string;
  subject_type: "THEORY" | "PRACTICAL" | "ELECTIVE" | "PROJECT";
  credits?: number | null;
  max_marks: number;
  passing_marks: number;
}

export interface SetupStaff {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

export interface SetupStudent {
  name: string;
  email?: string | null;
  roll_no: string;
  class_code: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  date_of_birth?: string | null;
}

export interface SetupBranding {
  logo_url?: string | null;
  primary_color?: string | null;
  tagline?: string | null;
}

export interface SetupState {
  completed: boolean;
  step: number;
  profile?: SetupProfile | null;
  logo?: string | null;
  academic_year?: SetupAcademicYear | null;
  departments: SetupDepartment[];
  programs: SetupProgram[];
  classes: SetupClass[];
  subjects: SetupSubject[];
  staff: SetupStaff[];
  students: SetupStudent[];
  modules: string[];
  branding?: SetupBranding | null;
  meta?: Record<string, unknown>;
}

export interface SetupEntityCounts {
  academic_years: number;
  departments: number;
  classes: number;
  subjects: number;
  staff: number;
  students: number;
  modules: number;
}

export interface SetupResponse {
  tenant_id: string;
  tenant_slug: string;
  state: SetupState;
  entities: SetupEntityCounts;
}

// ── HTTP helpers (authenticated) ─────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAccessToken() ?? ""}`,
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? body?.message ?? `Request failed (${res.status})`);
  }
  const envelope = (await res.json()) as { success: boolean; data: T; message: string };
  if (!envelope.success) throw new Error(envelope.message);
  return envelope.data;
}

/** GET /api/v1/setup — resume the wizard. */
export async function fetchSetupState(): Promise<SetupResponse> {
  return api<SetupResponse>(`${API_BASE_URL}/api/v1/setup`, {
    headers: authHeaders(),
  });
}

/** PUT /api/v1/setup — persist the full state after every step. */
export async function saveSetupState(state: SetupState): Promise<SetupResponse> {
  return api<SetupResponse>(`${API_BASE_URL}/api/v1/setup`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(state),
  });
}

/** POST /api/v1/setup/complete — materialise + unlock the dashboard. */
export async function completeSetup(): Promise<SetupResponse> {
  return api<SetupResponse>(`${API_BASE_URL}/api/v1/setup/complete`, {
    method: "POST",
    headers: authHeaders(),
  });
}
