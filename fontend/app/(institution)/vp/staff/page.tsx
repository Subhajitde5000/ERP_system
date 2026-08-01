import type { Metadata } from "next";

import { LeadershipDirectoryPage } from "@/components/user-directory/leadership-directory-page";
import { leadershipStaffDirectory } from "@/lib/user-directory";

export const metadata: Metadata = {
  title: "Staff Directory",
  description: "Staff profiles.",
};

/**
 * C-VP-07 — Staff Directory (Vice Principal).
 * "View staff profiles"
 *
 * The doc describes this identically to C-PR-05, and §4.3 says the VP is
 * "same as Principal but with scope limited to duties delegated" — nothing
 * narrows *staff visibility* specifically. So it is the same preset behind
 * its own documented route, not a copy.
 *
 * The VP's real limits (no final result approval) live on the results page,
 * which already models them.
 */
export default async function VpStaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <LeadershipDirectoryPage
      search={search}
      perms={leadershipStaffDirectory()}
      title="Staff Directory"
      backHref="/vice-principal/dashboard"
    />
  );
}
