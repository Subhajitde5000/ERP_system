import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { NoticeComposer } from "@/components/notice/notice-composer";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { noticePermissions } from "@/lib/notices";

export const metadata: Metadata = { title: "Post a Notice" };

/**
 * Notice composer — Notice_Board_design.md §5.
 * View-only roles get the 403 state instead of the form.
 */
export default async function NewNoticePage({
  searchParams,
}: {
  searchParams: Promise<{
    tenant?: string;
    role?: string;
    roles?: string;
    modules?: string;
  }>;
}) {
  const search = await searchParams;

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = noticePermissions(session.roles);

        if (!perms.canPost) {
          return (
            <PermissionDenied message="You don't have permission to post notices." />
          );
        }

        return <NoticeComposer perms={perms} />;
      }}
    </InstitutionShell>
  );
}
