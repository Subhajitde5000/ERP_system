import {
  Building2,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  ScrollText,
  Settings,
  Sprout,
  Ticket,
  TrendingUp,
  Layers,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { PlatformRole } from "@/types/auth";
import type { SubscriptionStatus, TenantRow } from "@/types/platform";
import type { Tone } from "@/types/dashboard";

/**
 * Platform console — role logic and navigation.
 *
 * `role_based_system_design.md` §4.1 defines four platform roles. The Super
 * Admin owns all eight pages (C-SA-01…08); Support owns C-SP-01…04 and Sales
 * owns C-SL-01…04. Finance (C-FM) is not built yet, so that role is routed to
 * its landing page and told what it can reach.
 *
 * §4.1 Super Admin, verbatim:
 *   - Create / suspend / delete institutions
 *   - Configure subscription plans
 *   - Access all institution data (audit-only, no edit)
 *   - Manage platform-level Support, Sales, Finance staff
 *   - View global analytics dashboard
 *
 * The third line is the one that shapes the UI: **audit-only, no edit**. The
 * Super Admin can open any tenant record and read it, but the institution's
 * academic data stays read-only from here — editing a class or a mark happens
 * inside the tenant, by someone with an institution role.
 */

export interface PlatformNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only these roles see the item */
  roles: PlatformRole[];
}

export interface PlatformNavSection {
  title?: string;
  items: PlatformNavItem[];
}

/** The eight Super Admin pages, in doc order (C-SA-01…08). */
const SUPER_ADMIN_ONLY: PlatformRole[] = ["SUPER_ADMIN"];

const NAV: PlatformNavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/platform/dashboard", icon: LayoutDashboard, roles: SUPER_ADMIN_ONLY },
    ],
  },
  {
    title: "Tenants",
    items: [
      { label: "Institutions", href: "/platform/institutions", icon: Building2, roles: SUPER_ADMIN_ONLY },
      { label: "Plans", href: "/platform/plans", icon: Layers, roles: SUPER_ADMIN_ONLY },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Platform Users", href: "/platform/platform-users", icon: UsersRound, roles: SUPER_ADMIN_ONLY },
      { label: "Audit Logs", href: "/platform/audit-logs", icon: ScrollText, roles: SUPER_ADMIN_ONLY },
      { label: "Settings", href: "/platform/settings", icon: Settings, roles: SUPER_ADMIN_ONLY },
    ],
  },
  {
    // C-SP-01…04. The Super Admin sees these too: §4.1 gives them platform-wide
    // oversight, and an escalated ticket has to be reachable from somewhere.
    title: "Support",
    items: [
      {
        label: "Support",
        href: "/platform/support/dashboard",
        icon: LifeBuoy,
        roles: ["SUPPORT_STAFF", "SUPER_ADMIN"],
      },
      {
        label: "Tickets",
        href: "/platform/support/tickets",
        icon: Ticket,
        roles: ["SUPPORT_STAFF", "SUPER_ADMIN"],
      },
    ],
  },
  {
    // C-SL-01…04. The Super Admin sees these too: §4.1 gives them
    // platform-wide oversight, and they own plans and tenant lifecycle
    // (C-SA-03/05), which is the other half of every conversation here.
    title: "Sales",
    items: [
      {
        label: "Sales",
        href: "/platform/sales/dashboard",
        icon: TrendingUp,
        roles: ["SALES_EXECUTIVE", "SUPER_ADMIN"],
      },
      {
        label: "Trials",
        href: "/platform/sales/trials",
        icon: Sprout,
        roles: ["SALES_EXECUTIVE", "SUPER_ADMIN"],
      },
      {
        label: "Subscriptions",
        href: "/platform/sales/subscriptions",
        icon: Receipt,
        roles: ["SALES_EXECUTIVE", "SUPER_ADMIN"],
      },
    ],
  },
  {
    title: "Teams",
    items: [
      // Not built yet — C-FM-01…04.
      { label: "Finance", href: "/platform/finance", icon: Wallet, roles: ["FINANCE_MANAGER"] },
    ],
  },
];

export function getPlatformNav(role: PlatformRole): PlatformNavSection[] {
  return NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SUPPORT_STAFF: "Support Staff",
  SALES_EXECUTIVE: "Sales Executive",
  FINANCE_MANAGER: "Finance Manager",
};

/** Where each non-Super-Admin role's own section will live. */
export const PLATFORM_ROLE_HOME: Record<PlatformRole, string> = {
  SUPER_ADMIN: "/platform/dashboard",
  SUPPORT_STAFF: "/platform/support/dashboard",
  SALES_EXECUTIVE: "/platform/sales/dashboard",
  FINANCE_MANAGER: "/platform/finance",
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
};

export const SUBSCRIPTION_TONE: Record<SubscriptionStatus, Tone> = {
  TRIAL: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELLED: "muted",
};

/**
 * A tenant's effective state.
 *
 * `is_active` (§4.2) and `subscriptions.status` (§4.4) are different columns:
 * a suspended tenant may still hold an ACTIVE subscription, and a cancelled
 * subscription doesn't automatically lock anyone out. Suspension wins, because
 * that is what actually blocks sign-in.
 */
export function tenantState(t: TenantRow): {
  label: string;
  tone: Tone;
} {
  if (!t.isActive) return { label: "Suspended", tone: "danger" };
  return {
    label: SUBSCRIPTION_LABELS[t.status],
    tone: SUBSCRIPTION_TONE[t.status],
  };
}

/** Days until a trial expires; negative once it has. */
export function trialDaysLeft(
  trialEndsAt: string | null,
  now: number,
): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((Date.parse(trialEndsAt) - now) / 86_400_000);
}

/** `-1` means unlimited in `plans` (§4.1) — render it, don't print "-1". */
export function planLimit(value: number): string {
  return value === -1 ? "Unlimited" : value.toLocaleString("en-IN");
}

/**
 * Seat usage against the plan cap, for the capacity bar.
 * Returns null when the plan is unlimited — a progress bar against infinity
 * is meaningless.
 */
export function seatUsage(
  used: number,
  cap: number,
): { pct: number; tone: Tone } | null {
  if (cap === -1) return null;
  const pct = Math.min(100, Math.round((used / cap) * 100));
  return {
    pct,
    tone: pct >= 90 ? "danger" : pct >= 75 ? "warning" : "success",
  };
}

/** Compact money for the platform's INR figures. */
export function compactINR(amount: number): string {
  // Sign outside the symbol, magnitude inside. Every branch below compared
  // against a positive threshold, so a negative fell straight through to the
  // last line and rendered "₹-10000" — ungrouped, with the minus inside the
  // currency. Same fix as `rupees()`.
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(amount);
  if (n >= 10_000_000) return `${sign}₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${sign}₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${sign}₹${Math.round(n / 1_000)}K`;
  return `${sign}₹${n}`;
}

/** Slugify an institution name into a subdomain candidate (C-SA-04). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Reserved subdomains a new tenant may not claim — mirrors `lib/tenant.ts`. */
export const RESERVED_SLUGS = new Set(["app", "admin", "www", "api"]);
