import { notFound } from "next/navigation";

import { LibraryPage } from "@/components/library/library-page";
import { ReturnForm } from "@/components/library/return-form";
import { getOpenLoanIds, getReturnContext } from "@/lib/library-data";

export const metadata = {
  title: "Return a book · xyz.com",
  description: "Check a copy back in and settle any fine.",
};

/**
 * C-LB-05 — Return Book.
 *
 * A 404 rather than a 403 for an unknown or already-closed loan: the id is a
 * specific person's borrowing record, so the URL space must not be probeable.
 * The same call PAGE C-TC-16 makes for a submission.
 */
export default async function ReturnBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  if (!getOpenLoanIds().includes(id)) notFound();

  const search = {
    tenant: typeof sp.tenant === "string" ? sp.tenant : undefined,
    role: typeof sp.role === "string" ? sp.role : undefined,
    roles: typeof sp.roles === "string" ? sp.roles : undefined,
    modules: typeof sp.modules === "string" ? sp.modules : undefined,
  };

  return (
    <LibraryPage
      search={search}
      requireManage
      deniedMessage="Recording returns is the Librarian's desk."
    >
      {() => {
        const context = getReturnContext(id);
        if (!context) notFound();
        return <ReturnForm context={context} />;
      }}
    </LibraryPage>
  );
}
