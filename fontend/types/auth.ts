/**
 * Shared auth/tenant contracts — xyz.com ERP + LMS
 * Mirrors the login API payload in login_page_design.md §8.
 */

/**
 * Platform-level roles — served from app.xyz.com.
 * Ref: role_based_system_design.md §2.1
 */
export type PlatformRole =
  | "SUPER_ADMIN"
  | "SUPPORT_STAFF"
  | "SALES_EXECUTIVE"
  | "FINANCE_MANAGER";

/**
 * The 18 institution roles — served from <tenant>.xyz.com.
 * Ref: role_based_system_design.md §2.2, packages/shared-types/roles.ts
 */
export type InstitutionRole =
  | "INSTITUTION_ADMIN"
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "HOD"
  | "TEACHER"
  | "MENTOR"
  | "EXAM_CONTROLLER"
  | "ACADEMIC_COORDINATOR"
  | "ACCOUNTANT"
  | "STUDENT"
  | "PARENT"
  | "LIBRARIAN"
  | "HOSTEL_WARDEN"
  | "TRANSPORT_MANAGER"
  | "PLACEMENT_OFFICER"
  | "HR_MANAGER"
  | "ADMISSION_OFFICER"
  | "STORE_MANAGER";

/** All roles supported by the platform. */
export type Role = PlatformRole | InstitutionRole;

/**
 * The 16 module keys — 8 core (always on) + 8 optional (toggleable).
 * Ref: packages/shared-types/modules.ts
 */
export type ModuleKey =
  // Core — always enabled
  | "attendance"
  | "examination"
  | "assignment"
  | "notice"
  | "discussion"
  | "content"
  | "results"
  | "timetable"
  // Optional — toggled per tenant in Settings → Modules
  | "library"
  | "hostel"
  | "transport"
  | "placement"
  | "hr"
  | "admission"
  | "inventory"
  | "finance";

export type TenantType = "SCHOOL" | "COLLEGE" | "UNIVERSITY" | "PLATFORM";

export interface Tenant {
  /** Subdomain slug, e.g. "abc-college" */
  slug: string;
  /** Display name, e.g. "ABC College" */
  name: string;
  /** Full host shown in the badge, e.g. "abc-college.xyz.com" */
  host: string;
  type: TenantType;
  logoUrl?: string | null;
  /** true when the slug did not resolve to a known institution (§7) */
  notFound?: boolean;
  /** true for the platform console at app.xyz.com */
  isPlatform?: boolean;
  /** Optional SSO provider label, e.g. "Google Workspace" */
  ssoProvider?: string | null;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

/** Response shape of POST /api/v1/auth/login — design §8 */
export interface LoginResponse {
  user: AuthUser;
  roles: Role[];
  enabledModules: ModuleKey[];
  tenant: {
    name: string;
    logo_url?: string | null;
    type: TenantType;
  };
  accessToken?: string;
}

export interface LoginCredentials {
  /** Email address or roll number */
  identifier: string;
  password: string;
  remember: boolean;
  /** Resolved from the subdomain before the request is sent */
  tenantId: string;
}

/** Error codes the UI renders distinct states for — design §7 */
export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "TENANT_NOT_FOUND"
  | "MODULE_DISABLED"
  | "ACCOUNT_LOCKED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
