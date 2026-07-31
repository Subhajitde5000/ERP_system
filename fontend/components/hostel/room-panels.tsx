"use client";

import { useState } from "react";
import {
  BedDouble,
  CalendarClock,
  Check,
  CheckCircle2,
  Phone,
  Plus,
  ShieldAlert,
  UserRoundX,
  X,
} from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import { timeAgo } from "@/lib/notices";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONE,
  HOSTEL_ATTENDANCE_LABELS,
  HOSTEL_ATTENDANCE_SHORT,
  HOSTEL_ATTENDANCE_TONE,
  HOSTEL_LEAVE_TONE,
  ROOM_TYPE_LABELS,
  amenityLabel,
  occupancyTone,
} from "@/lib/hostel";
import { pctTone } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { FieldRow } from "@/components/profile/field-row";
import {
  Card,
  EmptyState,
  ProgressBar,
  TONE_BG,
  TONE_TEXT,
} from "@/components/dashboard/primitives";
import type {
  HostelAttendanceStatus,
  HostelRoomSummary,
  RoomAttendanceHistory,
  RoomComplaint,
  RoomLeaveRequest,
  RoomOccupant,
} from "@/types/hostel";

/**
 * Hostel room panels — role_based_shared_pages.md PAGE 23 (C-RB-23).
 *
 * Warden: "Room info, bed occupants list, attendance history, complaints"
 *         with "Edit allotment, mark attendance, resolve complaints".
 * Student / Parent get the room info and occupant list only — same
 * components, less data (the data layer omits the rest).
 */

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const t = tone as keyof typeof TONE_BG;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONE_BG[t] ?? TONE_BG.muted,
        TONE_TEXT[t] ?? TONE_TEXT.muted,
      )}
    >
      {children}
    </span>
  );
}

/* ── Room info ──────────────────────────────────────────────────────────── */

/**
 * The room record. Every role gets this; the Parent's version is trimmed to
 * "block name + warden contact" per PAGE 23, which `compact` selects.
 */
export function RoomInfoPanel({
  room,
  compact,
}: {
  room: HostelRoomSummary;
  compact?: boolean;
}) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Room details
        </h2>
        <Pill tone={occupancyTone(room.occupiedBeds, room.capacity)}>
          {room.occupiedBeds}/{room.capacity} BEDS
        </Pill>
      </div>

      <dl className="min-w-0 divide-y divide-border border-t border-border">
        <FieldRow label="Block" value={room.blockName} />
        <FieldRow label="Room" value={room.roomNumber} mono />
        {!compact && (
          <>
            <FieldRow
              label="Floor"
              value={room.floor === 0 ? "Ground" : `Floor ${room.floor}`}
            />
            <FieldRow
              label="Type"
              value={`${ROOM_TYPE_LABELS[room.roomType] ?? room.roomType} · ${room.capacity} beds`}
            />
            <FieldRow
              label="Monthly fee"
              value={`₹${room.monthlyFee.toLocaleString("en-IN")}`}
            />
          </>
        )}
        <FieldRow
          label="Amenities"
          value={
            room.amenities.length
              ? room.amenities.map(amenityLabel).join(" · ")
              : null
          }
        />
      </dl>
    </Card>
  );
}

/** Warden contact — PAGE 23 lists it for both Student and Parent. */
export function WardenContactPanel({ room }: { room: HostelRoomSummary }) {
  const { warden } = room;
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 font-display text-[15px] font-bold text-foreground">
        Warden
      </h2>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-[14px] font-semibold text-accent"
          aria-hidden="true"
        >
          {warden.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {warden.name}
          </p>
          {warden.officeRoom && (
            <p className="truncate text-[11px] text-muted-foreground">
              {warden.officeRoom}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`tel:${warden.phone.replace(/\s/g, "")}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {warden.phone}
          </a>
        </div>
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
        <a
          href={`mailto:${warden.email}`}
          className="rounded text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
        >
          {warden.email}
        </a>
      </p>
    </Card>
  );
}

/* ── Occupants ──────────────────────────────────────────────────────────── */

/**
 * Bed occupants. PAGE 23 gives the Student "roommates (names only)", so the
 * extra fields are simply absent from the payload — this component renders
 * whatever it was given rather than deciding what to hide.
 */
export function OccupantsPanel({
  room,
  occupants,
  canEditAllotment,
  onAction,
}: {
  room: HostelRoomSummary;
  occupants: RoomOccupant[];
  canEditAllotment: boolean;
  onAction: (message: string) => void;
}) {
  // Empty beds are rendered too, so a vacancy is visible rather than implied
  const beds = Array.from({ length: room.capacity }, (_, i) => {
    const bedNumber = i + 1;
    return {
      bedNumber,
      occupant: occupants.find((o) => o.bedNumber === bedNumber) ?? null,
    };
  });

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <BedDouble className="h-4 w-4 text-accent" aria-hidden="true" />
            Occupants
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {room.occupiedBeds} of {room.capacity} beds allotted
          </p>
        </div>

        {canEditAllotment && room.occupiedBeds < room.capacity && (
          <button
            type="button"
            onClick={() =>
              onAction(
                "POST /hostel/allotments — API not connected yet (Dev-B, §8.2).",
              )
            }
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Allot bed
          </button>
        )}
      </div>

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {beds.map(({ bedNumber, occupant }) => (
          <li
            key={bedNumber}
            className="flex min-w-0 items-center gap-3 py-3"
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                occupant
                  ? "bg-accent-light text-accent"
                  : "border border-dashed border-border text-[#94A3B8]",
              )}
              aria-hidden="true"
            >
              {bedNumber}
            </span>

            {occupant ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                    <span className="min-w-0 truncate">
                      {occupant.studentName}
                    </span>
                    {occupant.isSelf && (
                      <span className="shrink-0 rounded-full border border-accent-border bg-accent-light px-2 py-0.5 text-[10px] font-semibold text-accent">
                        YOU
                      </span>
                    )}
                  </p>
                  {/* Only present when the role is entitled to it */}
                  {occupant.rollNo && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{occupant.rollNo}</span>
                      {occupant.className && ` · ${occupant.className}`}
                      {occupant.allottedFrom &&
                        ` · since ${formatDate(occupant.allottedFrom)}`}
                    </p>
                  )}
                </div>

                {occupant.attendancePct !== undefined && (
                  <span
                    className={cn(
                      "shrink-0 text-right text-[12px] text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-[13px] font-bold tabular-nums",
                        TONE_TEXT[pctTone(occupant.attendancePct)],
                      )}
                    >
                      {occupant.attendancePct}%
                    </span>
                    this term
                  </span>
                )}

                {occupant.todayStatus && (
                  <Pill tone={HOSTEL_ATTENDANCE_TONE[occupant.todayStatus]}>
                    {HOSTEL_ATTENDANCE_LABELS[occupant.todayStatus]}
                  </Pill>
                )}

                {canEditAllotment && (
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "PATCH /hostel/allotments/:id — API not connected yet (Dev-B).",
                      )
                    }
                    aria-label={`Move or vacate ${occupant.studentName}`}
                    className="shrink-0 rounded-field border border-border p-1.5 text-muted-foreground transition-colors hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <UserRoundX className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                  Vacant
                </p>
                {canEditAllotment && (
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "POST /hostel/allotments — API not connected yet (Dev-B, §8.2).",
                      )
                    }
                    className="shrink-0 rounded-field border border-border px-2.5 py-1.5 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    Assign
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Attendance history + marking ───────────────────────────────────────── */

const STATUSES: HostelAttendanceStatus[] = ["PRESENT", "ABSENT", "ON_LEAVE"];

/**
 * PAGE 23's "attendance history" plus "mark attendance".
 *
 * Tonight's roll-call is the editable row (it has no `markedByName` yet);
 * earlier nights are history. The grid is students × nights so the warden can
 * see a pattern rather than a single number.
 */
export function RoomAttendancePanel({
  occupants,
  history,
  canMark,
  onAction,
}: {
  occupants: RoomOccupant[];
  history: RoomAttendanceHistory;
  canMark: boolean;
  onAction: (message: string) => void;
}) {
  const [marks, setMarks] = useState<Record<string, HostelAttendanceStatus>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tonight = history.nights[0];
  const past = history.nights.slice(1);

  const statusFor = (studentId: string): HostelAttendanceStatus =>
    marks[studentId] ?? tonight?.entries[studentId] ?? "PRESENT";

  return (
    <div className="grid min-w-0 gap-4">
      {/* Tonight's roll-call */}
      {canMark && tonight && !tonight.markedByName && (
        <Card className="min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-bold text-foreground">
                Tonight&apos;s roll-call
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {formatDate(tonight.date)} · not yet marked
              </p>
            </div>
            {saved && (
              <Pill tone="success">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  SAVED
                </span>
              </Pill>
            )}
          </div>

          <ul className="min-w-0 divide-y divide-border border-t border-border">
            {occupants.map((o) => {
              const active = statusFor(o.studentId);
              return (
                <li
                  key={o.studentId}
                  className="flex min-w-0 flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {o.studentName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Bed {o.bedNumber}
                      {o.rollNo && ` · ${o.rollNo}`}
                    </p>
                  </div>

                  <div
                    role="group"
                    aria-label={`Attendance for ${o.studentName}`}
                    className="flex shrink-0 gap-1"
                  >
                    {STATUSES.map((s) => {
                      const on = active === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${HOSTEL_ATTENDANCE_LABELS[s]} — ${o.studentName}`}
                          onClick={() => {
                            setMarks((m) => ({ ...m, [o.studentId]: s }));
                            setSaved(false);
                          }}
                          className={cn(
                            "h-8 w-9 rounded-field border text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15",
                            on
                              ? cn(
                                  "border-transparent text-white",
                                  s === "PRESENT" && "bg-success",
                                  s === "ABSENT" && "bg-destructive",
                                  s === "ON_LEAVE" && "bg-warning",
                                )
                              : "border-border bg-white text-muted-foreground hover:border-accent",
                          )}
                        >
                          {HOSTEL_ATTENDANCE_SHORT[s]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>

          <Button
            type="button"
            loading={saving}
            loadingText="Saving…"
            onClick={async () => {
              setSaving(true);
              // TODO(Dev-B): POST /hostel/rooms/:id/attendance
              await new Promise((r) => setTimeout(r, 700));
              setSaving(false);
              setSaved(true);
              onAction(
                "POST /hostel/rooms/:id/attendance — API not connected yet (Dev-B, §8.2).",
              );
            }}
            className="mt-4 w-auto px-5"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Save roll-call
          </Button>
        </Card>
      )}

      {/* History grid */}
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-bold text-foreground">
              Attendance history
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Room average, last {past.length} nights ·{" "}
              {history.absentNights === 0
                ? "no absences"
                : `${history.absentNights} night${history.absentNights === 1 ? "" : "s"} with an absence`}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 font-display text-[22px] font-bold tabular-nums",
              TONE_TEXT[pctTone(history.overallPct)],
            )}
          >
            {history.overallPct}%
          </span>
        </div>

        <ProgressBar
          value={history.overallPct}
          tone={pctTone(history.overallPct)}
        />

        {/* The grid is students × nights, so it is intrinsically wider than a
            320px screen. `min-w-max` lets the table take its natural width and
            the wrapper scroll it; a percentage `w-full` here would instead
            paint outside the scroller. */}
        <div className="mt-4 w-full max-w-full overflow-x-auto">
          <table className="w-max min-w-full border-collapse">
            <caption className="sr-only">
              Nightly attendance by student for the last {past.length} nights
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Student
                </th>
                {past.map((n) => (
                  <th
                    key={n.date}
                    scope="col"
                    title={formatDate(n.date)}
                    className="pb-2 text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {new Date(n.date).getUTCDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {occupants.map((o) => (
                <tr key={o.studentId}>
                  <th
                    scope="row"
                    className="max-w-[120px] truncate py-2 pr-2 text-left text-[12px] font-medium text-foreground"
                  >
                    {o.studentName}
                  </th>
                  {past.map((n) => {
                    const s = n.entries[o.studentId] ?? "PRESENT";
                    return (
                      <td key={n.date} className="px-0.5 py-2 text-center">
                        <span
                          title={`${formatDate(n.date)}: ${HOSTEL_ATTENDANCE_LABELS[s]}`}
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold",
                            TONE_BG[HOSTEL_ATTENDANCE_TONE[s]],
                            TONE_TEXT[HOSTEL_ATTENDANCE_TONE[s]],
                          )}
                        >
                          {HOSTEL_ATTENDANCE_SHORT[s]}
                          <span className="sr-only">
                            {" "}
                            {HOSTEL_ATTENDANCE_LABELS[s]}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Complaints ─────────────────────────────────────────────────────────── */

/** PAGE 23's "complaints for this room" with "resolve complaints". */
export function ComplaintsPanel({
  complaints,
  canResolve,
  onAction,
}: {
  complaints: RoomComplaint[];
  canResolve: boolean;
  onAction: (message: string) => void;
}) {
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const open = complaints.filter(
    (c) => c.status !== "RESOLVED" && !resolved[c.id],
  );

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
          <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
          Complaints
        </h2>
        {open.length > 0 && (
          <Pill tone="danger">{open.length} OPEN</Pill>
        )}
      </div>

      {complaints.length === 0 ? (
        <EmptyState message="No complaints raised for this room." />
      ) : (
        <ul className="min-w-0 divide-y divide-border border-t border-border">
          {complaints.map((c) => {
            const status = resolved[c.id] ? "RESOLVED" : c.status;
            return (
              <li key={c.id} className="min-w-0 py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {COMPLAINT_CATEGORY_LABELS[c.category]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                    {c.raisedByName} · {timeAgo(c.createdAt)}
                  </span>
                  <Pill tone={COMPLAINT_STATUS_TONE[status]}>
                    {COMPLAINT_STATUS_LABELS[status].toUpperCase()}
                  </Pill>
                </div>

                <p className="mt-1 text-[13px] leading-6 text-[#334155]">
                  {c.description}
                </p>

                {c.resolvedByName && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Resolved by {c.resolvedByName}
                    {c.resolvedAt && ` · ${timeAgo(c.resolvedAt)}`}
                  </p>
                )}

                {canResolve && status !== "RESOLVED" && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResolved((r) => ({ ...r, [c.id]: true }));
                        onAction(
                          "PATCH /hostel/complaints/:id — API not connected yet (Dev-B, §8.2).",
                        );
                      }}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Mark resolved
                    </button>
                    {status === "OPEN" && (
                      <button
                        type="button"
                        onClick={() =>
                          onAction(
                            "PATCH /hostel/complaints/:id {status:IN_PROGRESS} — API not connected yet (Dev-B).",
                          )
                        }
                        className="inline-flex h-9 shrink-0 items-center rounded-field border border-border px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent hover:bg-accent-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                      >
                        Start work
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Leave requests ─────────────────────────────────────────────────────── */

/** §5.1 gives the warden leave approval; PAGE 23 scopes it to this room. */
export function RoomLeavePanel({
  requests,
  canReview,
  onAction,
}: {
  requests: RoomLeaveRequest[];
  canReview: boolean;
  onAction: (message: string) => void;
}) {
  const [decided, setDecided] = useState<Record<string, string>>({});

  if (requests.length === 0) return null;

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
        <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
        Leave requests
      </h2>

      <ul className="min-w-0 divide-y divide-border border-t border-border">
        {requests.map((r) => {
          const status = (decided[r.id] as RoomLeaveRequest["status"]) ?? r.status;
          return (
            <li key={r.id} className="min-w-0 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {r.studentName}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {formatDate(r.fromDate)} – {formatDate(r.toDate)}
                </span>
                <Pill tone={HOSTEL_LEAVE_TONE[status]}>{status}</Pill>
              </div>

              <p className="mt-1 text-[12px] leading-5 text-[#334155]">
                {r.reason}
              </p>
              {(r.destination || r.contactDuringLeave) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.destination}
                  {r.destination && r.contactDuringLeave && " · "}
                  {r.contactDuringLeave}
                </p>
              )}
              {r.reviewedByName && status !== "PENDING" && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Reviewed by {r.reviewedByName}
                </p>
              )}

              {canReview && status === "PENDING" && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDecided((d) => ({ ...d, [r.id]: "APPROVED" }));
                      onAction(
                        "PATCH /hostel/leave-requests/:id — API not connected yet (Dev-B, §8.2).",
                      );
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field bg-accent px-3.5 text-[12px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDecided((d) => ({ ...d, [r.id]: "REJECTED" }));
                      onAction(
                        "PATCH /hostel/leave-requests/:id — API not connected yet (Dev-B, §8.2).",
                      );
                    }}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field border border-destructive-border px-3 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive-light focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/15"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Reject
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
