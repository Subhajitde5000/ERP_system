import { LibraryPage } from "@/components/library/library-page";
import { IssueForm } from "@/components/library/issue-form";
import { getIssueFormContext } from "@/lib/library-data";

export const metadata = {
  title: "Issue a book · xyz.com",
  description: "Lend a copy to a student or member of staff.",
};

/**
 * C-LB-04 — Issue Book.
 *
 * `requireManage` refuses anyone without circulation rights, so the borrower
 * list — every student and staff member with their live loan counts — is
 * never built for a reader and never reaches the browser.
 */
export default async function IssueBookPage({
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
      deniedMessage="Issuing books is the Librarian's desk. You can browse the catalogue and see what you have on loan."
    >
      {() => <IssueForm context={getIssueFormContext()} />}
    </LibraryPage>
  );
}
