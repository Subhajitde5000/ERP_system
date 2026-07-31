import type { ModuleKey } from "@/types/auth";
import { ROOT_DOMAIN } from "./tenant";

/**
 * Small helpers shared by the platform data layer.
 *
 * Kept separate from `lib/navigation.ts` because that module imports Lucide
 * icons, which drags a client-only dependency into server data files.
 */

/** Acronyms that a plain capitalise would mangle ("Hr", "Ai"). */
const ACRONYMS: Partial<Record<ModuleKey, string>> = { hr: "HR" };

/** Human label for a module key. */
export function moduleLabel(key: ModuleKey): string {
  return ACRONYMS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** The platform's root domain, for display. */
export const ROOT_DOMAIN_LABEL = ROOT_DOMAIN;
