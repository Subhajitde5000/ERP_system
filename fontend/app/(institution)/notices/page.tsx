import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { NoticeFeed } from "@/components/notice/notice-feed";
import { getNotices } from "@/lib/notice-data";
import { noticePermissions } from "@/lib/notices";

export const metadata: Metadata = {
  title: "Notice Board",
  description: "Notices for your institution, department and classes.",
};

/**
 * Notice Board feed — Notice_Board_design.md §4.
 * One URL for all 18 institution roles; scope and posting rights come from
 * `noticePermissions()`, mirroring what the backend enforces.
 */
export default async function NoticesPage({
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
      {({ session, role }) => {
        const perms = noticePermissions(session.roles);
        const notices = getNotices(perms, role);

        return (
          <NoticeFeed
            notices={notices}
            perms={perms}
            emptyHint={
              role === "STUDENT"
                ? "Your teachers haven't posted any notices for your class yet."
                : role === "PARENT"
                  ? "No notices for your child's class yet."
                  : perms.canPost
                    ? "Post the first notice for your students or staff."
                    : "Nothing has been posted for you yet."
            }
          />
        );
      }}
    </InstitutionShell>
  );
}
