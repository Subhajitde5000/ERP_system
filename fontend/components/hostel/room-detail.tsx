"use client";

import { useState } from "react";
import { BedDouble, Building2 } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { occupancyTone } from "@/lib/hostel";
import { pctTone } from "@/lib/attendance";
import { FormAlert } from "@/components/auth/form-alert";
import { Card, TONE_BG, TONE_TEXT } from "@/components/dashboard/primitives";
import {
  DetailBackLink,
  DetailHeader,
} from "@/components/shared/detail-layout";
import {
  ComplaintsPanel,
  OccupantsPanel,
  RoomAttendancePanel,
  RoomInfoPanel,
  RoomLeavePanel,
  WardenContactPanel,
} from "./room-panels";
import type {
  HostelRoomDetail,
  HostelRoomPermissions,
} from "@/types/hostel";

/**
 * Hostel room detail — role_based_shared_pages.md PAGE 23 (C-RB-23).
 *
 * "One URL. Different view for warden vs. student."
 *
 *   Warden           → room · occupants · attendance history · complaints
 *   Principal/VP/Adm → the same, read-only (§6 "● view" on optional modules)
 *   Student          → own room · roommate names · warden contact
 *   Parent           → child's room · block · warden contact
 *
 * The view kind is resolved server-side; this component dispatches on it and
 * never branches on a role name. Sections a role isn't entitled to are absent
 * from the payload, so there is nothing here to hide.
 */
export function HostelRoomView({
  detail,
  perms,
}: {
  detail: HostelRoomDetail;
  perms: HostelRoomPermissions;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const { room, occupants, attendance, complaints, leaveRequests, ownAllotment } =
    detail;
  const isStaff = perms.view === "MANAGE" || perms.view === "OVERSEE";

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <DetailBackLink href="/hostel/dashboard" label="Hostel" />

      {status && (
        <FormAlert variant="info" className="mb-4">
          {status}
        </FormAlert>
      )}

      <DetailHeader
        initial={room.roomNumber.charAt(0)}
        title={`Room ${room.roomNumber}`}
        badge={
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              TONE_BG[occupancyTone(room.occupiedBeds, room.capacity)],
              TONE_TEXT[occupancyTone(room.occupiedBeds, room.capacity)],
            )}
          >
            {room.occupiedBeds}/{room.capacity} OCCUPIED
          </span>
        }
        subtitle={
          <>
            <Building2
              className="mr-1 inline h-3 w-3 align-[-1px]"
              aria-hidden="true"
            />
            {room.blockName} ·{" "}
            {room.floor === 0 ? "Ground floor" : `Floor ${room.floor}`}
          </>
        }
        meta={
          <>
            {/* A resident's own bed and attendance lead; staff get room-level */}
            {ownAllotment ? (
              <>
                <span>
                  <span className="font-bold text-foreground">
                    Bed {ownAllotment.bedNumber}
                  </span>{" "}
                  <span className="text-muted-foreground">yours</span>
                </span>
                <span>
                  <span
                    className={cn(
                      "font-bold",
                      TONE_TEXT[pctTone(ownAllotment.attendancePct)],
                    )}
                  >
                    {ownAllotment.attendancePct}%
                  </span>{" "}
                  <span className="text-muted-foreground">
                    nights present this term
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Since {formatDate(ownAllotment.allottedFrom)}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <BedDouble className="h-3 w-3" aria-hidden="true" />
                  {room.capacity} beds
                </span>
                {attendance && (
                  <span>
                    <span
                      className={cn(
                        "font-bold",
                        TONE_TEXT[pctTone(attendance.overallPct)],
                      )}
                    >
                      {attendance.overallPct}%
                    </span>{" "}
                    <span className="text-muted-foreground">
                      room, last 13 nights
                    </span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  Warden {room.warden.name}
                </span>
              </>
            )}
          </>
        }
      />

      <div className="mt-4 grid min-w-0 gap-4">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    /* ── Parent — "child's room info, block name, warden contact" ─────── */
    if (perms.view === "GUARDIAN") {
      return (
        <>
          {ownAllotment && (
            <Card className="min-w-0 p-5 sm:p-6">
              <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
                {ownAllotment.studentName}
              </h2>
              <p className="text-[13px] leading-6 text-[#334155]">
                Allotted bed {ownAllotment.bedNumber} in{" "}
                {room.blockName}, room {room.roomNumber}, since{" "}
                {formatDate(ownAllotment.allottedFrom)}. Nightly attendance is{" "}
                <span
                  className={cn(
                    "font-semibold",
                    TONE_TEXT[pctTone(ownAllotment.attendancePct)],
                  )}
                >
                  {ownAllotment.attendancePct}%
                </span>{" "}
                this term.
              </p>
            </Card>
          )}
          <RoomInfoPanel room={room} compact />
          <WardenContactPanel room={room} />
        </>
      );
    }

    /* ── Student — own room, roommate names, warden contact ───────────── */
    if (perms.view === "RESIDENT") {
      return (
        <>
          <RoomInfoPanel room={room} />
          <OccupantsPanel
            room={room}
            occupants={occupants}
            canEditAllotment={false}
            onAction={setStatus}
          />
          <WardenContactPanel room={room} />
        </>
      );
    }

    /* ── Warden (and read-only oversight) ─────────────────────────────── */
    if (isStaff) {
      return (
        <>
          <RoomInfoPanel room={room} />
          <OccupantsPanel
            room={room}
            occupants={occupants}
            canEditAllotment={perms.canEditAllotment}
            onAction={setStatus}
          />
          {attendance && (
            <RoomAttendancePanel
              occupants={occupants}
              history={attendance}
              canMark={perms.canMarkAttendance}
              onAction={setStatus}
            />
          )}
          {leaveRequests && (
            <RoomLeavePanel
              requests={leaveRequests}
              canReview={perms.canReviewLeave}
              onAction={setStatus}
            />
          )}
          {complaints && (
            <ComplaintsPanel
              complaints={complaints}
              canResolve={perms.canResolveComplaints}
              onAction={setStatus}
            />
          )}
          {/* PAGE 23 lists the warden contact for Student/Parent. Staff get it
              too: a block has its own warden (DB §8.2 `hostel_blocks.warden_id`)
              and an oversight role needs to know whose room this is. */}
          <WardenContactPanel room={room} />
        </>
      );
    }

    return null;
  }
}
