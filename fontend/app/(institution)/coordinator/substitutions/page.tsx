import { CoordinatorPage } from "@/components/coordinator/coordinator-page";
import { SubstitutionBoardView } from "@/components/coordinator/substitution-board";
import { getSubstitutionBoard } from "@/lib/coordinator-data";

export const metadata = {
  title: "Substitutions · xyz.com",
  description: "Cover arranged for teachers who are away.",
};

/**
 * C-AC-05 — Substitution Management.
 * "List of today's / upcoming substitutions"
 */
export default async function SubstitutionsPage({
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
      {({ canEdit }) => (
        // `canEdit` is resolved on the server and baked into the payload, so a
        // read-only role never receives the create link at all.
        <SubstitutionBoardView board={getSubstitutionBoard(canEdit)} />
      )}
    </CoordinatorPage>
  );
}
