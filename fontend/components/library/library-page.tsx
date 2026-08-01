import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { bookPermissions } from "@/lib/library";
import type { BookPermissions } from "@/types/library";
import type { DashboardSession } from "@/types/dashboard";

/**
 * Server wrapper for the library console — C-LB-02, C-LB-04…C-LB-08.
 *
 * Two gates every library page needs, applied once here rather than
 * copy-pasted into five route files where the sixth would forget one:
 *
 *   1. `library` is an **optional module** (§3) — off for a tenant that has
 *      not enabled it, regardless of role.
 *   2. `bookPermissions()` (PAGE 24) decides who reads and who circulates.
 *
 * `requireManage` marks the pages that are actions rather than views. Issuing
 * a book, recording a return and editing the catalogue all need
 * `canCirculate` / `canEditBook`; a Student reaching `/library/issues/new`
 * gets the same refusal as a Student reaching another reader's history.
 */
export function LibraryPage({
  search,
  requireManage,
  deniedMessage,
  children,
}: {
  search: {
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  };
  /** Refuse anyone without circulation rights (C-LB-04, C-LB-05). */
  requireManage?: boolean;
  /** Shown when `requireManage` refuses; defaults to a circulation message. */
  deniedMessage?: string;
  children: (ctx: {
    session: DashboardSession;
    perms: BookPermissions;
    /** Librarian (or Admin) — the pages' single edit flag. */
    canManage: boolean;
  }) => React.ReactNode;
}) {
  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        // 1. Optional module (§3)
        if (!session.enabledModules.includes("library")) {
          return (
            <PermissionDenied
              message="The Library module is switched off for this institution."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const perms = bookPermissions(session.roles);

        // 2. Role (PAGE 24)
        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const canManage = perms.canCirculate || perms.canEditBook;

        if (requireManage && !canManage) {
          return (
            <PermissionDenied
              message={
                deniedMessage ??
                "Issuing and returning books is the Librarian's desk. You can browse the catalogue."
              }
              backHref="/library/books"
              backLabel="Back to the catalogue"
            />
          );
        }

        return children({ session, perms, canManage });
      }}
    </InstitutionShell>
  );
}
