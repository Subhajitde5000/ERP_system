import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { BookDetailView } from "@/components/library/book-detail";
import { bookPermissions } from "@/lib/library";
import { getBook, getBookDetail } from "@/lib/library-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getBook(id)?.title ?? "Book" };
}

/**
 * Library book detail — role_based_shared_pages.md PAGE 24 (C-RB-24).
 *
 * "One URL. Different actions." The Librarian manages the title; everyone
 * else reads the catalogue entry.
 *
 * The permission object is passed *into* the data layer, so a reader's
 * payload carries no accession numbers, borrower names or issue history —
 * circulation records say who read what, which is not catalogue data.
 */
export default async function BookDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);

  if (!getBook(id)) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        // The library is an optional module (§3)
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

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const detail = getBookDetail(id, perms);
        if (!detail) notFound();

        return <BookDetailView detail={detail} perms={perms} />;
      }}
    </InstitutionShell>
  );
}
