"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keep the `?role=` / `?roles=` / `?modules=` / `?tenant=` preview params
 * across a client-side navigation.
 *
 * Without a backend these params *are* the session, so a `<Link>` that drops
 * them lands the reviewer on a different identity — usually a 404 or a 403,
 * because the default role rarely owns the page they were just on. Server
 * components get them from `searchParams`; client links have to rebuild them.
 *
 * The institution shell, the platform shell and the role switcher each grew
 * their own copy of this loop. This is the same list in one place, shaped for
 * building an href rather than hidden form fields.
 */
const PREVIEW_KEYS = ["tenant", "role", "roles", "modules"] as const;

export function usePreviewHref(): (href: string) => string {
  const params = useSearchParams();

  return useCallback(
    (href: string) => {
      const carry = new URLSearchParams();
      for (const key of PREVIEW_KEYS) {
        const value = params.get(key);
        if (value !== null) carry.set(key, value);
      }

      const query = carry.toString();
      if (!query) return href;
      // Respect an href that already carries its own query string
      return `${href}${href.includes("?") ? "&" : "?"}${query}`;
    },
    [params],
  );
}
