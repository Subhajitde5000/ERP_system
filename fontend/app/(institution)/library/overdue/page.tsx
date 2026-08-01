import { LibraryPage } from "@/components/library/library-page";
import { CirculationDeskView } from "@/components/library/circulation-desk";
import { getCirculationDesk } from "@/lib/library-data";

export const metadata = {
  title: "Overdue books · xyz.com",
  description: "Loans past their due date, with fines owed.",
};

/**
 * C-LB-07 — Overdue List.
 *
 * The same desk as C-LB-06 opened on the overdue tab. Overdue is a *filter*
 * over the loans, not a separate query — two screens reading two sources
 * would eventually disagree about how many books are late.
 */
export default async function OverduePage({
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
      deniedMessage={"Overdue loans name the borrower, which is the Librarian's record. You can see your own loans on your profile."}
    >
      {({ canManage }) => (
        <CirculationDeskView
          desk={getCirculationDesk(canManage)}
          initialTab="OVERDUE"
          title="Overdue books"
          description="Loans past their due date, with the fine each has accrued."
        />
      )}
    </LibraryPage>
  );
}
