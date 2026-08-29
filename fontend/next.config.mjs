/** @type {import('next').NextConfig} */
/**
 * Security headers (audit issue H7)
 * ---------------------------------
 * Every response now carries a Content-Security-Policy plus hardening
 * headers. The CSP is built from NEXT_PUBLIC_API_URL so connect/websocket
 * calls to the FastAPI backend keep working in every environment.
 *
 * Trade-offs documented:
 *  - script-src keeps 'unsafe-inline' because Next.js bootstraps with inline
 *    scripts; remote script sources are still blocked. Nonce-based hardening
 *    is a tracked follow-up.
 *  - img-src allows https: because tenant logos/attachments may be external.
 *  - Dev mode adds 'unsafe-eval' (required by Next's dev tooling); the
 *    stricter production policy applies to `next build`/`next start`.
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "xyz.com";
const isDev = process.env.NODE_ENV === "development";

/** http + https + ws(s) variants of the API origin for connect-src. */
function apiConnectOrigins(base) {
  const origins = new Set([base]);
  try {
    origins.add(base.replace(/^http:/, "https:"));
    origins.add(base.replace(/^http/, "ws")); // ws: or wss:
  } catch {
    /* malformed base → keep it verbatim; CSP stays valid */
  }
  return [...origins];
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiConnectOrigins(apiBase).join(" ")}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Only force-upgrade when not serving localhost (dev/local previews).
  ...(!isDev && !rootDomain.includes("localhost") ? ["upgrade-insecure-requests"] : []),
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // frame-ancestors in CSP is authoritative; XFO covers very old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // HSTS only makes sense on a real https domain — never on localhost.
  ...(!isDev && !rootDomain.includes("localhost")
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
