import type { ModuleKey } from "@/types/auth";
import type { BillingCycle } from "@/types/platform";
import { ROOT_DOMAIN } from "./tenant";

/**
 * Small helpers shared by the platform data layer.
 *
 * Kept separate from `lib/navigation.ts` because that module imports Lucide
 * icons, which drags a client-only dependency into server data files — and
 * separate from `lib/platform.ts` for the same reason.
 */

/** Acronyms that a plain capitalise would mangle ("Hr", "Ai"). */
const ACRONYMS: Partial<Record<ModuleKey, string>> = { hr: "HR" };

/** Human label for a module key. */
export function moduleLabel(key: ModuleKey): string {
  return ACRONYMS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** The platform's root domain, for display. */
export const ROOT_DOMAIN_LABEL = ROOT_DOMAIN;

/**
 * Normalise a charge to a month so mixed billing cycles can be summed.
 *
 * A yearly commitment is still recurring revenue every month. Lives here
 * rather than in `lib/sales.ts` because `platform-data` needs it too, and
 * two implementations of MRR would eventually disagree.
 */
export function toMrr(amount: number, cycle: BillingCycle): number {
  return cycle === "YEARLY" ? Math.round(amount / 12) : amount;
}
