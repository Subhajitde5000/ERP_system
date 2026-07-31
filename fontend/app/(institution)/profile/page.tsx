import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfile } from "@/lib/profile-data";
import { profilePermissions, redactHr } from "@/lib/profile";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View and update your account details.",
};

/**
 * Profile — role_based_shared_pages.md PAGE 4 (C-RB-04).
 * One URL for all 18 roles; visible sections and editable fields come from
 * `profilePermissions()`, mirroring what `GET /users/me` returns.
 */
export default async function ProfilePage({
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
        const data = getProfile(role, session.user.name, session.roles);

        // Sensitive HR columns are masked server-side, so the raw values never
        // reach the browser. Unmasking is an audited request (see lib/profile).
        if (data.hr) data.hr = redactHr(data.hr);

        return (
          <ProfileView
            data={data}
            perms={profilePermissions(session.roles)}
            roles={session.roles}
          />
        );
      }}
    </InstitutionShell>
  );
}
