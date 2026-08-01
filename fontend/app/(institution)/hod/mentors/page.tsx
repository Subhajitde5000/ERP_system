import type { Metadata } from "next";

import { HodPage } from "@/components/hod/hod-page";
import { MentorBoardView } from "@/components/hod/mentor-board";
import { getMentorBoard } from "@/lib/mentor-data";

export const metadata: Metadata = {
  title: "Mentors",
  description: "Assign students to mentors in your department.",
};

/**
 * C-HD-08 — Mentor Assignments.
 * "Assign students to mentors (if Mentor role enabled)"
 *
 * MENTOR is an optional *role*, not a module key, so the "enabled" gate is
 * whether anyone in the department holds the grant — `getMentorBoard()`
 * reports it as `mentorRoleInUse` and the page explains itself when nobody
 * does.
 */
export default async function HodMentorsPage({
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
    <HodPage search={search}>
      {({ departmentCode, canEdit }) => (
        <MentorBoardView board={getMentorBoard(departmentCode)} canEdit={canEdit} />
      )}
    </HodPage>
  );
}
