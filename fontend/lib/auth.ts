import { AuthError } from "@/types/auth";
import type { AuthErrorCode, LoginCredentials, LoginResponse } from "@/types/auth";

/**
 * Auth API client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-A): swap the stub below for the real NestJS endpoint.
 *
 *   POST /api/v1/auth/login
 *   body: { identifier, password, remember, tenantId }
 *   → 200 LoginResponse | 401 INVALID_CREDENTIALS
 *     404 TENANT_NOT_FOUND | 403 MODULE_DISABLED
 *
 * Replace `login()` with the api.ts client call, e.g.
 *
 *   export async function login(c: LoginCredentials): Promise<LoginResponse> {
 *     return api.post<LoginResponse>("/api/v1/auth/login", c);
 *   }
 *
 * The UI already renders every state in design §7 off `AuthError.code`, so no
 * component changes are needed once this function talks to the real API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Map an HTTP status to the error codes the UI knows how to render. */
export function codeFromStatus(status: number): AuthErrorCode {
  switch (status) {
    case 401:
    case 422:
      return "INVALID_CREDENTIALS";
    case 403:
      return "MODULE_DISABLED";
    case 404:
      return "TENANT_NOT_FOUND";
    case 423:
      return "ACCOUNT_LOCKED";
    default:
      return "UNKNOWN";
  }
}

export const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: "Invalid email or password",
  TENANT_NOT_FOUND: "Institution not found. Check subdomain.",
  MODULE_DISABLED:
    "Your module access is disabled. Contact your institution admin.",
  ACCOUNT_LOCKED:
    "Account locked after too many attempts. Try again in 15 minutes.",
  NETWORK_ERROR: "Can't reach the server. Check your connection and retry.",
  UNKNOWN: "Something went wrong. Please try again.",
};

/**
 * Sign a user in.
 *
 * Currently a stub: it resolves after a short delay so loading/disabled states
 * are exercised, then throws so nothing pretends to be authenticated. Delete
 * the stub body and call the real endpoint when auth lands.
 */
export async function login(
  credentials: LoginCredentials,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  // ── STUB START — remove when the API is live ──────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (signal?.aborted) throw new AuthError("UNKNOWN", "Request cancelled");

  throw new AuthError(
    "NETWORK_ERROR",
    "Auth API not connected yet — see lib/auth.ts (Dev-A, A-11).",
  );
  // ── STUB END ──────────────────────────────────────────────────────────────

  /* Real implementation:

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": credentials.tenantId,
      },
      credentials: "include",
      body: JSON.stringify(credentials),
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = (body?.code as AuthErrorCode) ?? codeFromStatus(res.status);
      throw new AuthError(code, body?.message ?? ERROR_MESSAGES[code]);
    }

    return (await res.json()) as LoginResponse;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError("NETWORK_ERROR", ERROR_MESSAGES.NETWORK_ERROR);
  }
  */
}

/**
 * Request a password reset link.
 * TODO(Dev-A): POST /api/v1/auth/forgot-password
 */
export async function requestPasswordReset(
  identifier: string,
  tenantId: string,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  // Always resolve: never reveal whether an account exists.
  void identifier;
  void tenantId;
}
