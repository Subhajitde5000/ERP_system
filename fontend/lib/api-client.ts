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
 * @param url        absolute URL
 * @param init       fetch init; `Content-Type: application/json` is added
 * @param token      bearer token, when the endpoint is authenticated
 * @param errorName  name for thrown errors, so callers can still tell clients
 *                   apart in logs (`PlatformAPIError`, `InstitutionAPIError`…)
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  token?: string | null,
  errorName = "APIError",
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
    credentials: "include",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new APIError(errorMessage(body, res.status), res.status, errorName);

  return (body as Envelope<T>).data;
}
