import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { DirectoryView } from "@/components/user-directory/directory-view";
import {
  canUseLeadershipDirectory,
  leadershipDirectoryDenial,
} from "@/lib/user-directory";
import { getDirectoryData } from "@/lib/user-directory-data";
import type { DirectoryPermissions } from "@/types/user-directory";

/**
 * Server wrapper for the Principal's and Vice Principal's focused
 * directories — C-PR-05, C-PR-06 and C-VP-07.
 *
 * All three are the same page with a different audience, so the guard and the
 * data call live here once. The permission object is passed *into*
 * `getDirectoryData()`, which applies the audience as a server-side filter —
 * a staff directory's RSC payload contains no student rows at all, rather
 * than students hidden by CSS.
 *
 * §4.3 gives the Principal academic authority and no user-management grant,
 * so every preset here carries `actions: ["VIEW_PROFILE"]` and nothing else.
 */
export function LeadershipDirectoryPage({
  search,
  perms,
  title,
  backHref,
}: {
  search: {
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  };
  perms: DirectoryPermissions;
  /** Page heading — "Staff Directory" or "Student Directory" */
  title: string;
  /** Where the 403's escape hatch points — the caller's own dashboard */
  backHref: string;
}) {
  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        if (!canUseLeadershipDirectory(session.roles)) {
          return (
            <PermissionDenied
              message={leadershipDirectoryDenial(session.roles)}
              backHref={backHref}
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <DirectoryView
            perms={perms}
            data={getDirectoryData(perms)}
            title={title}
          />
        );
      }}
    </InstitutionShell>
  );
}
