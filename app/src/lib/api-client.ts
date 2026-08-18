/**
 * Shared HTTP plumbing — ported from fontend/lib/api-client.ts.
 *
 * The backend envelope is identical: `{ success, data, message }`, the same
 * error class and the same FastAPI 422 shape.
 */

/** The envelope every endpoint returns (architecture doc, §API conventions). */
export interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

/** A failed request, carrying the HTTP status so callers can branch on 401/409. */
export class APIError extends Error {
  status: number;
  constructor(message: string, status: number, name = "APIError") {
    super(message);
    this.name = name;
    this.status = status;
  }
}

/**
 * Flatten a FastAPI error body into one readable line.
 *
 * Validation failures arrive as `detail: [{ loc, msg }, …]`; rendering that
 * object directly gives the user "[object Object]", so it becomes
 * "slug: string too short; adminEmail: invalid".
 */
export function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.[d.loc.length - 1] ?? "field";
        return `${field}: ${d.msg ?? "invalid"}`;
      })
      .join("; ");
  }
  if (typeof detail === "string") return detail;

  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;

  return `Request failed (${status})`;
}

/**
 * Perform one API call and unwrap the envelope.
 *
 * @param url         absolute URL
 * @param init        fetch init; `Content-Type: application/json` is added
 * @param token       bearer token, when the endpoint is authenticated
 * @param errorName   name for thrown errors
 * @param refreshFn   optional — called once on a 401 to obtain a fresh token,
 *                    after which the request is retried automatically.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  token?: string | null,
  errorName = "APIError",
  refreshFn?: (() => Promise<string | null>) | null,
): Promise<T> {
  const buildHeaders = (t?: string | null): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  });

  // ── First attempt ──────────────────────────────────────────────────────────
  const res = await fetch(url, { ...init, headers: buildHeaders(token) });

  // Fast path — success or a non-401 error that refresh cannot fix.
  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    return (body as Envelope<T>).data as T;
  }

  // ── 401 + refreshFn → attempt a silent token refresh then retry once ───────
  if (res.status === 401 && refreshFn) {
    await res.json().catch(() => ({}));
    const newToken = await refreshFn();
    if (newToken) {
      const retryRes = await fetch(url, { ...init, headers: buildHeaders(newToken) });
      const retryBody = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new APIError(errorMessage(retryBody, retryRes.status), retryRes.status, errorName);
      }
      return (retryBody as Envelope<T>).data as T;
    }
  }

  // ── Non-retryable error ────────────────────────────────────────────────────
  const body = await res.json().catch(() => ({}));
  throw new APIError(errorMessage(body, res.status), res.status, errorName);
}
