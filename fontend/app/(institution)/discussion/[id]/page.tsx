import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ThreadDetail } from "@/components/discussion/thread-detail";
import { canModerateThread, discussionPermissions } from "@/lib/discussion";
import { getThread } from "@/lib/discussion-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getThread(id)?.title ?? "Thread" };
}

/**
 * Thread detail — PAGE 3.
 * Scope is re-checked here so a role that can't see this thread gets 403
 * rather than the content, mirroring the backend guard.
 */
export default async function ThreadPage({
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

  const thread = getThread(id);
  if (!thread) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        const perms = discussionPermissions(session.roles);

        const outOfScope =
          !perms.visibleScopes.includes(thread.scopeType) ||
          (perms.tagFilter && !thread.tags.includes(perms.tagFilter));

        if (outOfScope) {
          return (
            <PermissionDenied
              message="This thread isn't in your scope."
              backHref="/discussion"
              backLabel="Back to Discussion"
            />
          );
        }

        // Viewer id comes from the JWT once auth lands (Dev-A)
        const viewerId = session.user.email;
        const moderates = canModerateThread(perms, thread, viewerId);

        return (
          <ThreadDetail
            thread={thread}
            canModerate={moderates}
            // Teachers accept answers only in subjects they own (PAGE 3)
            canAcceptAnswer={perms.canAcceptAnswer && moderates}
            canReply={perms.canPost}
          />
        );
      }}
    </InstitutionShell>
  );
}
