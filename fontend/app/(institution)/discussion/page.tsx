import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ThreadList } from "@/components/discussion/thread-list";
import { discussionPermissions } from "@/lib/discussion";
import { getThreads } from "@/lib/discussion-data";

export const metadata: Metadata = {
  title: "Discussion",
  description: "Ask questions and discuss with your class, subject or department.",
};

/**
 * Discussion Forum — role_based_shared_pages.md PAGE 3 (C-RB-03).
 * One URL; scope, posting and moderation all come from
 * `discussionPermissions()`, mirroring what the backend enforces.
 */
export default async function DiscussionPage({
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
        const perms = discussionPermissions(session.roles);

        // Roles with no forum access at all (§6)
        if (!perms.visibleScopes.length) {
          return (
            <PermissionDenied
              message={perms.note ?? "You don't have access to the discussion forum."}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <ThreadList
            threads={getThreads(perms)}
            perms={perms}
            emptyHint={
              role === "STUDENT"
                ? "No one has started a thread in your class or subjects yet."
                : perms.canPost
                  ? "Start a thread to get the conversation going."
                  : "Nothing has been posted in your scope yet."
            }
          />
        );
      }}
    </InstitutionShell>
  );
}
