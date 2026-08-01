import { CoordinatorPage } from "@/components/coordinator/coordinator-page";
import { SubstitutionForm } from "@/components/coordinator/substitution-form";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { getSubstitutionFormContext } from "@/lib/coordinator-data";

export const metadata = {
  title: "Add substitution · xyz.com",
  description: "Assign a substitute teacher for a period on a date.",
};

/**
 * C-AC-06 — Add Substitution.
 * "Assign substitute teacher for a specific slot + date"
 *
 * Arranging cover is an edit, so the read-only roles that may *view* the
 * board (HOD, Principal, Teacher…) are refused here. §4.5 gives the
 * substitution grant to the Academic Coordinator alone.
 */
export default async function NewSubstitutionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = {
    tenant: typeof params.tenant === "string" ? params.tenant : undefined,
    role: typeof params.role === "string" ? params.role : undefined,
    roles: typeof params.roles === "string" ? params.roles : undefined,
    modules: typeof params.modules === "string" ? params.modules : undefined,
  };

  return (
    <CoordinatorPage search={search}>
      {({ canEdit }) =>
        canEdit ? (
          <SubstitutionForm context={getSubstitutionFormContext()} />
        ) : (
          // The form context is never built for a read-only role, so the
          // teacher list and grid never reach the browser.
          <PermissionDenied
            message="Arranging cover is the Academic Coordinator's job. You can view the substitutions that are already in place."
            backHref="/coordinator/substitutions"
            backLabel="Back to Substitutions"
          />
        )
      }
    </CoordinatorPage>
  );
}
