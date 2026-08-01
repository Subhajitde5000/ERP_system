import { LibraryPage } from "@/components/library/library-page";
import { EResourcesView } from "@/components/library/e-resources";
import { getEResources } from "@/lib/library-data";

export const metadata = {
  title: "E-resources · xyz.com",
  description: "Journals, e-books and papers held digitally.",
};

/** C-LB-08 — E-Resources. Readers are the audience, so no manage gate. */
export default async function EResourcesPage({
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
    <LibraryPage search={search}>
      {({ canManage }) => <EResourcesView shelf={getEResources(canManage)} />}
    </LibraryPage>
  );
}
