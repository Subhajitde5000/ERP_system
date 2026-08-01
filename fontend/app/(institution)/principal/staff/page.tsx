import type { Metadata } from "next";

import { LeadershipDirectoryPage } from "@/components/user-directory/leadership-directory-page";
import { leadershipStaffDirectory } from "@/lib/user-directory";

export const metadata: Metadata = {
  title: "Staff Directory",
  description: "All teachers, HODs and coordinators.",
};

/**
 * C-PR-05 — Staff Directory.
 * "All teachers, HODs, coordinators — view profiles"
 *
 * The staff half of what `/users` shows leadership as one merged list, with
 * the columns a staff list actually needs. Same component, same data layer,
 * narrower audience.
 */
export default async function PrincipalStaffPage({
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
      backHref="/principal/dashboard"
    />
  );
}
