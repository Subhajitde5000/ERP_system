import { LibraryPage } from "@/components/library/library-page";
import { BookCatalogueView } from "@/components/library/book-catalogue";
import { getBookCatalogue } from "@/lib/library-data";

export const metadata = {
  title: "Book catalogue · xyz.com",
  description: "Every title the library holds, with live availability.",
};

/** C-LB-02 — Book Catalogue. */
export default async function BookCataloguePage({
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
      {({ canManage }) => (
        <BookCatalogueView catalogue={getBookCatalogue(canManage)} />
      )}
    </LibraryPage>
  );
}
