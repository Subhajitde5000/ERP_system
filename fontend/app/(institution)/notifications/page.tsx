import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { NotificationInbox } from "@/components/notification/notification-inbox";
import { getNotifications } from "@/lib/notification-data";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Everything that needs your attention.",
};

/**
 * Notifications — role_based_shared_pages.md PAGE 15 (C-RB-15).
 *
 * "One URL. Same layout, different notification types per role." Unlike the
 * other role-based pages this is a *content* filter rather than a view
 * dispatch, so there's no view-kind switch and no permission-denied state —
 * every user has an inbox (DB §10.1). Which events arrive is decided by
 * `eventsForRoles()`.
 */
export default async function NotificationsPage({
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
      {({ session }) => (
        <div className="mx-auto w-full min-w-0 max-w-3xl">
          <NotificationInbox
            notifications={getNotifications(session.roles)}
            heading="Notifications"
          />
        </div>
      )}
    </InstitutionShell>
  );
}
