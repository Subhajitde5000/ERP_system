import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { InstitutionShell } from "@/components/dashboard/institution-shell";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { HostelRoomView } from "@/components/hostel/room-detail";
import { hostelRoomPermissions } from "@/lib/hostel";
import { getOwnRoomId, getRoom, getRoomDetail } from "@/lib/hostel-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const room = getRoom(id);
  return { title: room ? `Room ${room.roomNumber}` : "Hostel room" };
}

/**
 * Hostel room detail — role_based_shared_pages.md PAGE 23 (C-RB-23).
 *
 * Three guards run server-side before any data is built:
 *
 *   1. module off      → the hostel module is optional (§3)
 *   2. no access       → 13 of the 18 roles
 *   3. own-room fence  → a student/parent may open only their own room
 *
 * The permission object is then passed *into* the data layer, so a roommate's
 * roll number and the room's complaint log never reach a student's payload.
 */
export default async function HostelRoomPage({
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

  if (!getRoom(id)) notFound();

  return (
    <InstitutionShell search={search}>
      {({ session }) => {
        // The hostel is an optional module — with it off, nobody has a room
        if (!session.enabledModules.includes("hostel")) {
          return (
            <PermissionDenied
              message="The Hostel module is switched off for this institution."
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        const perms = hostelRoomPermissions(session.roles);

        if (perms.view === "NONE") {
          return (
            <PermissionDenied
              message={perms.note}
              backHref="/dashboard"
              backLabel="Back to Dashboard"
            />
          );
        }

        // PAGE 23 scopes the Student to "own room" and the Parent to their
        // child's — the fence covers the whole record, not just a section.
        if (perms.ownRoomOnly && id !== getOwnRoomId()) {
          return (
            <PermissionDenied
              message={
                perms.view === "GUARDIAN"
                  ? "You can only view the room your child is allotted to."
                  : "You can only view the room you are allotted to."
              }
              backHref={`/hostel/rooms/${getOwnRoomId()}`}
              backLabel="Go to your room"
            />
          );
        }

        const detail = getRoomDetail(id, perms);
        if (!detail) notFound();

        return <HostelRoomView detail={detail} perms={perms} />;
      }}
    </InstitutionShell>
  );
}
