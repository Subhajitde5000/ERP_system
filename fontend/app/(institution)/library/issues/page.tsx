import { LibraryPage } from "@/components/library/library-page";
import { CirculationDeskView } from "@/components/library/circulation-desk";
import { getCirculationDesk } from "@/lib/library-data";

export const metadata = {
  title: "Issued books · xyz.com",
  description: "Every copy currently on loan.",
};

/** C-LB-06 — Issued Books List. */
export default async function IssuedBooksPage({
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
    <LibraryPage
      search={search}
      requireManage
      deniedMessage={"Who has borrowed which book is the Librarian's record. You can see your own loans on your profile."}
    >
      {({ canManage }) => (
        <CirculationDeskView
          desk={getCirculationDesk(canManage)}
          initialTab="OUT"
          title="Issued books"
          description="Every copy on loan, most overdue first."
        />
      )}
    </LibraryPage>
  );
}
