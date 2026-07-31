import type { Tenant } from "@/types/auth";

/**
 * Subdomain → tenant resolution.
 *
 * Production wiring is Dev-A / A-11 TenantMiddleware (design §11). Until the
 * tenant API exists this resolves from the Host header and validates the slug
 * against a local fixture so the "Tenant Not Found" state (§7) is reachable.
 */

/** Root domain; override per-environment with NEXT_PUBLIC_ROOT_DOMAIN. */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "xyz.com";

/** Hosts that never carry a tenant slug. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** Reserved subdomains that map to the platform console, not an institution. */
const PLATFORM_SLUGS = new Set(["app", "admin", "www", "api"]);

/**
 * TODO(Dev-A): replace with GET /api/v1/tenants/by-slug/:slug
 * Demo fixture so the tenant badge + not-found state render without a backend.
 */
const KNOWN_TENANTS: Record<string, Omit<Tenant, "host" | "slug">> = {
  "abc-college": {
    name: "ABC College",
    type: "COLLEGE",
    logoUrl: null,
    ssoProvider: "Google Workspace",
  },
  "dps-school": {
    name: "DPS School",
    type: "SCHOOL",
    logoUrl: null,
  },
  "nova-university": {
    name: "Nova University",
    type: "UNIVERSITY",
    logoUrl: null,
    ssoProvider: "Microsoft Entra ID",
  },
};

/** The platform console tenant (app.xyz.com). */
function platformTenant(host: string): Tenant {
  return {
    slug: "app",
    name: "xyz.com Platform",
    host,
    type: "PLATFORM",
    isPlatform: true,
    logoUrl: null,
  };
}

/**
 * Extract the tenant slug from a host header.
 * Returns null for localhost, bare apex domains and reserved subdomains.
 */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;

  // Strip port and normalise
  const hostname = host.split(":")[0]!.toLowerCase().trim();
  if (!hostname || LOCAL_HOSTS.has(hostname)) return null;

  // Support *.localhost for local multi-tenant testing
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && !PLATFORM_SLUGS.has(sub) ? sub : null;
  }

  const rootParts = ROOT_DOMAIN.split(".").length;
  const parts = hostname.split(".");
  if (parts.length <= rootParts) return null; // apex, e.g. xyz.com

  const sub = parts.slice(0, parts.length - rootParts).join(".");
  return sub || null;
}

/**
 * Resolve a Host header into the tenant the login page should render for.
 *
 * @param host  Raw Host header, e.g. "abc-college.xyz.com"
 * @param slugOverride  Optional ?tenant= query value, for local development
 */
export function resolveTenant(
  host: string | null | undefined,
  slugOverride?: string | null,
): Tenant {
  const displayHost = (host ?? ROOT_DOMAIN).split(":")[0]!.toLowerCase();
  const slug = slugOverride?.trim().toLowerCase() || slugFromHost(host);

  // No subdomain → platform console
  if (!slug) return platformTenant(displayHost);
  if (PLATFORM_SLUGS.has(slug)) return platformTenant(displayHost);

  const match = KNOWN_TENANTS[slug];
  const badgeHost = slugOverride ? `${slug}.${ROOT_DOMAIN}` : displayHost;

  // Unknown slug → "Institution not found. Check subdomain." (§7)
  if (!match) {
    return {
      slug,
      name: slug,
      host: badgeHost,
      type: "COLLEGE",
      notFound: true,
      logoUrl: null,
    };
  }

  return { slug, host: badgeHost, ...match };
}

/** Human label for the identifier field — colleges use roll numbers. */
export function identifierLabel(tenant: Tenant): string {
  if (tenant.isPlatform) return "Work email";
  return "Email or Roll Number";
}

export function identifierPlaceholder(tenant: Tenant): string {
  if (tenant.isPlatform) return "you@xyz.com";
  if (tenant.type === "SCHOOL") return "you@school.edu or ADM1024";
  return "you@college.edu or ROLL123";
}
