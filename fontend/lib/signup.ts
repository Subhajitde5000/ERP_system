/**
 * Signup API client — public self-service checkout (Step 1–8 of the
 * institution-admin journey). All calls are anonymous and hit the FastAPI
 * backend at NEXT_PUBLIC_API_URL.
 */

import { API_BASE_URL } from "./auth";

export interface PlanInfo {
  id: string;
  name: string;
  slug: string;
  maxStudents: number;
  maxTeachers: number;
  maxStorageGb: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  allowedModules: ModuleInfo["key"][];
  isActive: boolean;
}

export interface ModuleInfo {
  key: string;
  name: string;
  description: string | null;
  isCore: boolean;
  priceMonthly: number;
}

export interface Catalog {
  plans: PlanInfo[];
  modules: ModuleInfo[];
}

export interface SubdomainCheck {
  slug: string;
  available: boolean;
  url: string;
  suggestions: string[];
}

export interface PriceLine {
  label: string;
  amount: number;
}

export interface CouponResult {
  code: string;
  discountType: string;
  value: number;
  message: string;
}

export interface Quote {
  mode: "PURCHASE" | "TRIAL";
  planSlug: string;
  billingCycle: "MONTHLY" | "YEARLY";
  moduleKeys: string[];
  currency: string;
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  total: number;
  coupon: CouponResult | null;
}

export interface OwnerDraft {
  name: string;
  email: string;
}

export interface InstitutionDraft {
  name: string;
  type: "SCHOOL" | "COLLEGE";
  email: string;
  phone: string | null;
  country: string;
  state: string | null;
  city: string | null;
  address: string | null;
}

export interface Order {
  id: string;
  mode: "PURCHASE" | "TRIAL";
  planSlug: string;
  moduleKeys: string[];
  billingCycle: "MONTHLY" | "YEARLY";
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  couponCode: string | null;
  status: string;
  institutionName: string;
  urlSlug: string;
  loginUrl: string;
  createdAt: string;
}

export interface ProvisionedTenant {
  id: string;
  slug: string;
  name: string;
  loginUrl: string;
}

export interface ProvisionedSubscription {
  status: string;
  amount: number;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
}

export interface ProvisionedInvoice {
  number: string;
  status: string;
  issuedAt: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
}

export interface WelcomeEmail {
  to: string;
  subject: string;
  status: string;
}

export interface ProvisionResult {
  orderId: string;
  mode: "PURCHASE" | "TRIAL";
  tenant: ProvisionedTenant;
  subscription: ProvisionedSubscription;
  invoice: ProvisionedInvoice | null;
  ownerEmail: string;
  platformDashboardUrl: string;
  adminEmail: string;
  enabledModules: string[];
  welcomeEmail: WelcomeEmail;
  steps: string[];
}

/** The 12 setup-wizard steps, in order. */
export const SETUP_STEPS = [
  "Institution Profile",
  "Upload Logo",
  "Academic Year",
  "Departments",
  "Programs/Courses",
  "Classes & Sections",
  "Subjects",
  "Invite Staff",
  "Import Students",
  "Configure Modules",
  "Branding",
  "Finish",
] as const;

export type SetupStepName = (typeof SETUP_STEPS)[number];


function toCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamel);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      toCamel(val),
    ]),
  );
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? body?.message ?? `Request failed (${res.status})`);
  }
  const envelope = (await res.json()) as { success: boolean; data: T; message: string };
  if (!envelope.success) throw new Error(envelope.message);
  return toCamel(envelope.data) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.detail ?? payload?.message ?? `Request failed (${res.status})`);
  }
  const envelope = (await res.json()) as { success: boolean; data: T; message: string };
  if (!envelope.success) throw new Error(envelope.message);
  return toCamel(envelope.data) as T;
}

/** GET /api/v1/public/catalog — plans + modules for the pricing page. */
export async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch(`${API_BASE_URL}/api/v1/public/catalog`);
  if (!res.ok) throw new Error("Catalogue unavailable");
  const envelope = (await res.json()) as { data: Catalog };
  return toCamel(envelope.data) as Catalog;
}

/** GET /api/v1/public/subdomains/check?slug=green */
export async function checkSubdomain(slug: string): Promise<SubdomainCheck> {
  return getJson<SubdomainCheck>(
    `${API_BASE_URL}/api/v1/public/subdomains/check?slug=${encodeURIComponent(slug)}`,
  );
}

/** POST /api/v1/public/quote — live price calculation. */
export async function fetchQuote(params: {
  mode: "PURCHASE" | "TRIAL";
  plan: string;
  modules: string[];
  cycle: "MONTHLY" | "YEARLY";
  coupon?: string | null;
}): Promise<Quote> {
  const query = new URLSearchParams({
    mode: params.mode,
    plan: params.plan,
    modules: params.modules.join(","),
    cycle: params.cycle,
  });
  if (params.coupon) query.set("coupon", params.coupon);
  return getJson<Quote>(`${API_BASE_URL}/api/v1/public/quote?${query}`);
}

/** POST /api/v1/public/orders — create the checkout draft. */
export async function createOrder(payload: {
  mode: "PURCHASE" | "TRIAL";
  planSlug: string;
  moduleKeys: string[];
  billingCycle: "MONTHLY" | "YEARLY";
  couponCode: string | null;
  owner: OwnerDraft;
  institution: InstitutionDraft;
  urlSlug: string;
  password: string;
}): Promise<Order> {
  return postJson<Order>(`${API_BASE_URL}/api/v1/public/orders`, payload);
}

/** POST /api/v1/public/orders/{id}/pay — pay + auto-provision. */
export async function payOrder(
  orderId: string,
  method: string,
  gatewayRef?: string,
): Promise<ProvisionResult> {
  return postJson<ProvisionResult>(
    `${API_BASE_URL}/api/v1/public/orders/${orderId}/pay`,
    { method, gateway_ref: gatewayRef },
  );
}

/** GET /api/v1/public/orders/{id} — success-page payload (idempotent). */
export async function fetchOrderResult(orderId: string): Promise<ProvisionResult> {
  return getJson<ProvisionResult>(
    `${API_BASE_URL}/api/v1/public/orders/${encodeURIComponent(orderId)}`,
  );
}

/** Fetch once, then serve from memory — the catalogue is static-ish. */
let _catalogCache: Catalog | null = null;

export async function getCatalog(): Promise<Catalog> {
  if (_catalogCache) return _catalogCache;
  const catalog = await fetchCatalog();
  _catalogCache = catalog;
  return catalog;
}

/** INR formatting used across the checkout (₹7,999 / ₹10,800). */
export function formatINR(value: number | string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
