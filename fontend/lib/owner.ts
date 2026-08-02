/**
 * Platform Owner API client — the xyz.com customer-account layer.
 *
 * One owner owns many institutions. This client backs the owner signup → verify
 * email → platform dashboard flow: My Institutions, Billing, Subscriptions,
 * Invoices, Payments, Support Tickets and Profile.
 *
 * Token storage mirrors the tenant flow: the short-lived access token lives in
 * memory (never localStorage); the refresh token is persisted under a key
 * separate from the tenant one so the two login systems never collide.
 */

import { API_BASE_URL } from "./auth";
import type {
  BillingSummary,
  OwnerCredentials,
  OwnerInstitution,
  OwnerInvoice,
  OwnerLoginResponse,
  OwnerPayment,
  OwnerProfile,
  OwnerSignupResult,
  OwnerSubscription,
  SupportTicket,
} from "@/types/owner";

const OWNER_REFRESH_KEY = "erp_owner_refresh";
const BASE = `${API_BASE_URL}/api/v1/owner`;

// ── In-memory access token ───────────────────────────────────────────────────
let _ownerAccessToken: string | null = null;

export function setOwnerAccessToken(t: string | null): void {
  _ownerAccessToken = t;
}

export function getOwnerAccessToken(): string | null {
  return _ownerAccessToken;
}

function saveOwnerRefresh(token: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(OWNER_REFRESH_KEY, token);
  }
}
function loadOwnerRefresh(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(OWNER_REFRESH_KEY);
}
function clearOwnerRefresh(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(OWNER_REFRESH_KEY);
  }
}

/** Response envelope shared by every backend endpoint. */
interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

class APIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

async function ownerFetch<T>(
  path: string,
  init: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth && _ownerAccessToken) headers.Authorization = `Bearer ${_ownerAccessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new APIError(body?.detail ?? body?.message ?? `Request failed (${res.status})`, res.status);
  }
  const env = body as Envelope<T>;
  return env.data;
}

// ── Signup & verification ────────────────────────────────────────────────────

export async function ownerSignup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<OwnerSignupResult> {
  return ownerFetch<OwnerSignupResult>("/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function verifyOwnerEmail(token: string): Promise<OwnerProfile> {
  return ownerFetch<OwnerProfile>("/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendOwnerVerification(email: string): Promise<void> {
  await ownerFetch("/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function ownerLogin(
  credentials: OwnerCredentials,
): Promise<OwnerLoginResponse> {
  const data = await ownerFetch<{
    tokens: { access_token: string; refresh_token: string; expires_in: number };
    owner: {
      id: string;
      name: string;
      email: string;
      is_email_verified: boolean;
      is_active: boolean;
      last_login_at: string | null;
      created_at: string;
    };
  }>("/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  setOwnerAccessToken(data.tokens.access_token);
  saveOwnerRefresh(data.tokens.refresh_token);
  return {
    tokens: {
      accessToken: data.tokens.access_token,
      refreshToken: data.tokens.refresh_token,
      expiresIn: data.tokens.expires_in,
    },
    owner: {
      id: data.owner.id,
      name: data.owner.name,
      email: data.owner.email,
      isEmailVerified: data.owner.is_email_verified,
      isActive: data.owner.is_active,
      lastLoginAt: data.owner.last_login_at,
      createdAt: data.owner.created_at,
    },
  };
}

export async function ownerLogout(): Promise<void> {
  const refresh = loadOwnerRefresh();
  if (!refresh) return;
  try {
    await ownerFetch("/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refresh }),
    }, true);
  } finally {
    setOwnerAccessToken(null);
    clearOwnerRefresh();
  }
}

export async function refreshOwnerToken(): Promise<string | null> {
  const refresh = loadOwnerRefresh();
  if (!refresh) return null;
  try {
    const data = await ownerFetch<{ access_token: string; expires_in: number }>(
      "/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refresh }) },
    );
    setOwnerAccessToken(data.access_token);
    return data.access_token;
  } catch {
    setOwnerAccessToken(null);
    clearOwnerRefresh();
    return null;
  }
}

export async function getOwnerMe(): Promise<OwnerProfile | null> {
  if (!_ownerAccessToken) return null;
  try {
    const data = await ownerFetch<{
      id: string;
      name: string;
      email: string;
      is_email_verified: boolean;
      is_active: boolean;
      last_login_at: string | null;
      created_at: string;
    }>("/me", { method: "GET" }, true);
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      isEmailVerified: data.is_email_verified,
      isActive: data.is_active,
      lastLoginAt: data.last_login_at,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

// ── Password reset ───────────────────────────────────────────────────────────

export async function ownerForgotPassword(email: string): Promise<void> {
  await ownerFetch("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  }).catch(() => undefined); // never reveals whether an account exists
}

export async function ownerResetPassword(
  token: string,
  password: string,
): Promise<void> {
  await ownerFetch("/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

// ── Dashboard data ───────────────────────────────────────────────────────────

export async function fetchOwnerInstitutions(): Promise<OwnerInstitution[]> {
  const data = await ownerFetch<{ institutions: OwnerInstitution[] }>(
    "/institutions",
    { method: "GET" },
    true,
  );
  return data.institutions;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return ownerFetch<BillingSummary>("/billing/summary", { method: "GET" }, true);
}

export async function fetchOwnerSubscriptions(): Promise<OwnerSubscription[]> {
  return ownerFetch<OwnerSubscription[]>("/subscriptions", { method: "GET" }, true);
}

export async function fetchOwnerInvoices(): Promise<OwnerInvoice[]> {
  return ownerFetch<OwnerInvoice[]>("/invoices", { method: "GET" }, true);
}

export async function fetchOwnerPayments(): Promise<OwnerPayment[]> {
  return ownerFetch<OwnerPayment[]>("/payments", { method: "GET" }, true);
}

// ── Support tickets ──────────────────────────────────────────────────────────

export async function fetchOwnerTickets(): Promise<SupportTicket[]> {
  return ownerFetch<SupportTicket[]>("/tickets", { method: "GET" }, true);
}

export async function createOwnerTicket(input: {
  subject: string;
  category: string;
  priority?: string;
  tenantId?: string | null;
  message: string;
}): Promise<SupportTicket> {
  return ownerFetch<SupportTicket>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  }, true);
}

export async function replyOwnerTicket(
  ticketId: string,
  message: string,
): Promise<SupportTicket> {
  return ownerFetch<SupportTicket>(`/tickets/${ticketId}/reply`, {
    method: "POST",
    body: JSON.stringify({ message }),
  }, true);
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function updateOwnerProfile(name: string): Promise<OwnerProfile> {
  return ownerFetch<OwnerProfile>("/profile", {
    method: "PUT",
    body: JSON.stringify({ name }),
  }, true);
}

export async function changeOwnerPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await ownerFetch("/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }, true);
}

export { APIError };
