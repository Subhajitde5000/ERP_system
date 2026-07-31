import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { DirectoryView } from "@/components/user-directory/directory-view";
import { directoryPermissions } from "@/lib/user-directory";
import { getDirectoryData } from "@/lib/user-directory-data";

export const metadata: Metadata = {
  title: "Users",
  description: "Institution user directory.",
};

/**
 * User directory — role_based_shared_pages.md PAGE 12 (C-RB-12).
 *
 * "One URL. Scope and edit permissions differ per role."
 *
 * One guard runs server-side before any data is built: 11 of the 18 roles
 * have no directory grant at all.
 *
 * The permission object is then passed *into* the data layer, so the audience
 * is applied as a query filter rather than a display filter. A HOD's RSC
 * payload contains their own department's teachers and nothing else — no
 * hidden rows, and no columns (joining date, eligibility, last login) that
 * their role doesn't own.
 */
export default async function UsersPage({
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
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = directoryPermissions(session.roles);

        if (perms.deniedReason) {
          return (
            <PermissionDenied
              message={perms.deniedReason}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return <DirectoryView perms={perms} data={getDirectoryData(perms)} />;
      }}
    </InstitutionShell>
  );
}
