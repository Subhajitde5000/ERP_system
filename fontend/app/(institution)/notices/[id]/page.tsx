import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { NoticeDetail } from "@/components/notice/notice-detail";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { getNotice } from "@/lib/notice-data";
import { noticePermissions } from "@/lib/notices";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const notice = getNotice(id);
  return { title: notice?.title ?? "Notice" };
}

/**
 * Notice detail — Notice_Board_design.md §6.
 * Scope is re-checked here: a role that cannot see this scope gets 403 rather
 * than the content, mirroring the backend guard.
 */
export default async function NoticeDetailPage({
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

  const notice = getNotice(id);
  if (!notice) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session, role }) => {
        const perms = noticePermissions(session.roles);

        if (!perms.visibleScopes.includes(notice.targetScope)) {
          return (
            <PermissionDenied message="This notice isn't shared with your role." />
          );
        }

        // Author or admin sees receipts and moderation actions
        const isAuthor = notice.author.role === role;

        return (
          <NoticeDetail
            notice={notice}
            canModerate={perms.canModerate || isAuthor}
          />
        );
      }}
    </InstitutionShell>
  );
}
