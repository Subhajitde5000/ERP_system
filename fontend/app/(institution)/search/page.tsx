import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { SearchView } from "@/components/search/search-view";
import { searchPermissions } from "@/lib/search";
import { overflowFor, search } from "@/lib/search-data";
import type { SearchKind } from "@/types/search";

export const metadata: Metadata = {
  title: "Search",
  description: "Search across everything your role can open.",
};

/**
 * Global search — role_based_shared_pages.md PAGE 17 (C-RB-17).
 *
 * "One URL. Results scoped by role."
 *
 * Every role gets the page — the doc says the bar is "available to all roles"
 * — so there is no 403 here. Scoping happens on the *kinds*: the query only
 * ever runs against the caller's own entity kinds, so nothing is fetched and
 * then filtered away in the browser.
 *
 * Search is a shortcut, never a privilege escalation: notices and discussion
 * threads are read through their own permission-scoped data layers, so a hit
 * can't surface a record the owning page would hide.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search_ = await searchParams;
  const query = (search_.q ?? "").slice(0, 120);

  return (
    <InstitutionShell search={search_}>
      {({ session }) => {
        const perms = searchPermissions(session.roles);
        const results = search(query, perms, session.roles);

        // How many hits each kind had beyond the per-kind cap, so the UI can
        // say "+ 3 more" instead of silently truncating.
        const overflow: Partial<Record<SearchKind, number>> = {};
        for (const kind of results.kinds) {
          const extra = overflowFor(kind, query, session.roles);
          if (extra > 0) overflow[kind] = extra;
        }

        return (
          <SearchView perms={perms} results={results} overflow={overflow} />
        );
      }}
    </InstitutionShell>
  );
}
