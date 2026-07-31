import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { ContentView } from "@/components/content/content-view";
import { contentPermissions } from "@/lib/content";
import {
  getAllContent,
  getBrowsableContent,
  getDepartmentContent,
  getOwnContent,
} from "@/lib/content-data";
import { getChildren } from "@/lib/attendance-data";
import type { ContentPermissions } from "@/types/content";

export const metadata: Metadata = {
  title: "Study Material",
  description: "Upload and browse notes, slides, video and other material.",
};

/**
 * Content / Study Material — role_based_shared_pages.md PAGE 8 (C-RB-08).
 *
 * One URL: upload vs. browse. `contentPermissions()` resolves the view kind
 * server-side; the library structure is shared and only row actions differ.
 */
export default async function ContentPage({
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
        const perms = contentPermissions(session.roles);

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        return (
          <div className="mx-auto w-full min-w-0 max-w-5xl">
            <div className="mb-6">
              <h1 className="font-display text-[22px] font-bold text-foreground">
                Study Material
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {perms.note}
              </p>
            </div>

            {renderView(perms)}
          </div>
        );
      }}
    </InstitutionShell>
  );
}

function renderView(perms: ContentPermissions) {
  switch (perms.view) {
    case "MANAGE":
      return (
        <ContentView
          items={getOwnContent()}
          perms={perms}
          emptyHint="Upload your first notes, slides or lecture recording."
        />
      );

    case "DEPARTMENT":
      return (
        <ContentView
          items={getDepartmentContent()}
          perms={perms}
          showOwner
          emptyHint="No material uploaded in your department yet."
        />
      );

    case "INSTITUTION":
      return (
        <ContentView
          items={getAllContent()}
          perms={perms}
          showOwner
          emptyHint="No material uploaded across the institution yet."
        />
      );

    case "BROWSE":
      return (
        <ContentView
          items={getBrowsableContent()}
          perms={perms}
          emptyHint="Your teachers haven't shared any material yet."
        />
      );

    case "CHILD":
      return (
        <ContentView
          items={getBrowsableContent()}
          perms={perms}
          childOptions={getChildren()}
          emptyHint="No material shared for your child's subjects yet."
        />
      );

    default:
      return null;
  }
}
