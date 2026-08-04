/**
 * Shared HTTP plumbing for every backend client.
 *
 * `lib/institution.ts`, `lib/owner.ts` and `lib/platform-api.ts` each talk to a
 * different API surface with a different token, but the transport is identical:
 * the same `{ success, data, message }` envelope, the same error class, the
 * same FastAPI 422 shape. That was three copies of the same twenty lines.
 *
 * Each client still owns what genuinely differs — its base path and how it
 * supplies a token — and passes that in.
 *
 * ## 401 refresh retry
 *
 * When a caller passes a `refreshFn`, a single 401 response triggers a silent
 * token refresh and one automatic retry. If the refresh itself fails, or the
 * retry still returns 401, the original APIError propagates normally so the
 * shell can redirect to login.
 *
 * To avoid a thundering-herd problem (many parallel requests all racing to
 * refresh), each domain shares a single in-flight refresh promise via
 * `createRefreshGuard()`. Concurrent 401s wait for the same refresh, then
 * retry with the new token rather than each kicking off their own refresh.
 */

/** The envelope every endpoint returns (architecture doc, §API conventions). */
export interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

// ── snake_case → camelCase conversion ─────────────────────────────────────────

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Mirrors the toCamel helper in lib/signup.ts so every API surface
 * (owner, platform, institution) returns consistent camelCase keys to the UI.
 */
export function toCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        toCamel(v),
      ]),
    );
  }
  return value;
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

// ── Refresh concurrency guard ─────────────────────────────────────────────────

/**
 * Returns a `guard` function. Call `guard(fn)` instead of calling `fn()`
 * directly. If a refresh is already in flight, all concurrent callers await
 * the same promise so `fn` is only invoked once, no matter how many 401s
 * arrive simultaneously.
 *
 * Usage (one guard instance per auth domain):
 *
 *   const guardTenantRefresh = createRefreshGuard();
 *   const newToken = await guardTenantRefresh(refreshAccessToken);
 */
export function createRefreshGuard() {
  let inflight: Promise<string | null> | null = null;

  return function guard(
    refreshFn: () => Promise<string | null>,
  ): Promise<string | null> {
    if (!inflight) {
      inflight = refreshFn().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}

// ── One guard per auth domain (module-level singletons) ───────────────────────

/** Shared by the tenant/institution and platform clients (same _accessToken slot). */
export const guardTenantRefresh = createRefreshGuard();

/** Owned exclusively by the owner client. */
export const guardOwnerRefresh = createRefreshGuard();

// ── Core fetch helper ─────────────────────────────────────────────────────────

/**
 * Perform one API call and unwrap the envelope.
 *
 * @param url         absolute URL
 * @param init        fetch init; `Content-Type: application/json` is added
 * @param token       bearer token, when the endpoint is authenticated
 * @param errorName   name for thrown errors, so callers can still tell clients
 *                    apart in logs (`PlatformAPIError`, `InstitutionAPIError`…)
 * @param refreshFn   optional — called once on a 401 to obtain a fresh token,
 *                    after which the request is retried automatically.
 *                    Should be `refreshAccessToken` (tenant/platform) or
 *                    `refreshOwnerToken` (owner). Pass `null` / omit for
 *                    unauthenticated requests where retrying makes no sense.
 * @param guard       the concurrency guard for this auth domain — prevents
 *                    multiple parallel 401s from each triggering their own
 *                    refresh. Defaults to `guardTenantRefresh`; owner calls
 *                    should pass `guardOwnerRefresh`.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  token?: string | null,
  errorName = "APIError",
  refreshFn?: (() => Promise<string | null>) | null,
  guard: ReturnType<typeof createRefreshGuard> = guardTenantRefresh,
  camelCase = false,
): Promise<T> {
  const buildHeaders = (t?: string | null): Record<string, string> => ({
    // FormData sets its own multipart boundary — a manual Content-Type would break it.
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  });

  // ── First attempt ──────────────────────────────────────────────────────────
  const res = await fetch(url, {
    ...init,
    headers: buildHeaders(token),
    credentials: "include",
  });

  // Fast path — success or a non-401 error that refresh cannot fix.
  if (res.ok) {
    const body = await res.json().catch(() => ({}));
    const data = (body as Envelope<T>).data;
    return (camelCase ? toCamel(data) : data) as T;
  }

  // ── 401 + refreshFn → attempt a silent token refresh then retry once ───────
  if (res.status === 401 && refreshFn) {
    // Drain the body so the connection can be reused.
    await res.json().catch(() => ({}));

    const newToken = await guard(refreshFn);

    if (newToken) {
      // ── Retry ──────────────────────────────────────────────────────────────
      const retryRes = await fetch(url, {
        ...init,
        headers: buildHeaders(newToken),
        credentials: "include",
      });

      const retryBody = await retryRes.json().catch(() => ({}));
      if (!retryRes.ok) {
        throw new APIError(
          errorMessage(retryBody, retryRes.status),
          retryRes.status,
          errorName,
        );
      }
      const data = (retryBody as Envelope<T>).data;
      return (camelCase ? toCamel(data) : data) as T;
    }

    // Refresh returned null (session truly expired) — fall through to throw.
  }

  // ── Non-retryable error ────────────────────────────────────────────────────
  const body = await res.json().catch(() => ({}));
  throw new APIError(errorMessage(body, res.status), res.status, errorName);
}
