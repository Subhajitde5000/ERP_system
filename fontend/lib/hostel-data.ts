import type {
  HostelAttendanceStatus,
  HostelRoomDetail,
  HostelRoomPermissions,
  HostelRoomSummary,
  RoomAttendanceHistory,
  RoomComplaint,
  RoomLeaveRequest,
  RoomOccupant,
  WardenContact,
} from "@/types/hostel";
import { getClassRoster } from "./attendance-data";

/**
 * Hostel data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (PAGE 23, C-RB-23; DB §8.2).
 *
 *   GET   /api/v1/hostel/rooms/:id                    room + block + warden
 *   GET   /api/v1/hostel/rooms/:id/occupants          active allotments
 *   PATCH /api/v1/hostel/allotments/:id               move / vacate a bed
 *   POST  /api/v1/hostel/rooms/:id/attendance         nightly roll-call
 *   GET   /api/v1/hostel/rooms/:id/attendance?days=   history
 *   GET   /api/v1/hostel/rooms/:id/complaints         complaints for the room
 *   PATCH /api/v1/hostel/complaints/:id               OPEN → IN_PROGRESS → RESOLVED
 *   PATCH /api/v1/hostel/leave-requests/:id           approve / reject
 *
 * The endpoint must scope by role: a student may read only the room they are
 * allotted to, and must receive roommate *names* and nothing else (PAGE 23).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY = 24 * 60 * 60 * 1000;
/** Fixed base so server and client agree — same T0 as every other fixture. */
const T0 = Date.UTC(2026, 6, 29);
const at = (daysAgo: number) => new Date(T0 - daysAgo * DAY).toISOString();
const on = (daysAgo: number) =>
  new Date(T0 - daysAgo * DAY).toISOString().slice(0, 10);

/** The signed-in student, matching the student-detail fixture. */
const OWN_STUDENT = { id: "s1", name: "Aryan Mehta", roomId: "A-104" };

const WARDENS: Record<string, WardenContact> = {
  "block-a": {
    name: "Ramesh Gowda",
    phone: "+91 98451 21234",
    email: "ramesh.g@abc-college.edu",
    officeRoom: "Block A · Ground floor",
  },
  "block-c": {
    name: "Sunita Pillai",
    phone: "+91 98451 24567",
    email: "sunita.p@abc-college.edu",
    officeRoom: "Block C · Ground floor",
  },
};

/**
 * Rooms. `A-104` is the room the student-detail page already allots to Aryan
 * Mehta (bed 2, 91% attendance), so the two pages tell the same story.
 * `C-012` is a girls' block room used to prove the "own room only" fence.
 */
const ROOMS: HostelRoomSummary[] = [
  {
    id: "A-104",
    roomNumber: "A-104",
    floor: 1,
    capacity: 3,
    roomType: "SHARED",
    monthlyFee: 4500,
    amenities: ["ATTACHED_BATH", "WIFI", "STUDY_DESK"],
    isActive: true,
    blockId: "block-a",
    blockName: "Block A · Boys",
    blockGender: "MALE",
    warden: WARDENS["block-a"]!,
    // Filled from the allotments below
    occupiedBeds: 0,
  },
  {
    id: "A-105",
    roomNumber: "A-105",
    floor: 1,
    capacity: 2,
    roomType: "SHARED",
    monthlyFee: 5200,
    amenities: ["AC", "ATTACHED_BATH", "WIFI"],
    isActive: true,
    blockId: "block-a",
    blockName: "Block A · Boys",
    blockGender: "MALE",
    warden: WARDENS["block-a"]!,
    occupiedBeds: 0,
  },
  {
    id: "C-012",
    roomNumber: "C-012",
    floor: 0,
    capacity: 2,
    roomType: "SHARED",
    monthlyFee: 4500,
    amenities: ["ATTACHED_BATH", "WIFI"],
    isActive: true,
    blockId: "block-c",
    blockName: "Block C · Girls",
    blockGender: "FEMALE",
    warden: WARDENS["block-c"]!,
    occupiedBeds: 0,
  },
];

/**
 * Active allotments, keyed by room. Students come from the shared class
 * roster so a name here matches attendance, exam halls and the submission
 * table.
 *
 * `A-104` is deliberately left one bed short of capacity: a full room hides
 * the warden's "assign bed" action, which is their main flow (the fixture
 * state trap from PAGE 19).
 */
const ROSTER = getClassRoster();
const byName = (n: string) => ROSTER.find((s) => s.name === n)!;

const ALLOTMENTS: Record<string, { bed: number; studentId: string }[]> = {
  "A-104": [
    { bed: 1, studentId: byName("Imran Shaikh").id },
    { bed: 2, studentId: byName("Aryan Mehta").id },
    // bed 3 vacant on purpose
  ],
  "A-105": [
    { bed: 1, studentId: byName("Kiran Patel").id },
    { bed: 2, studentId: byName("Kabir Singh").id },
  ],
  "C-012": [
    { bed: 1, studentId: byName("Sneha Rao").id },
    { bed: 2, studentId: byName("Divya Nair").id },
  ],
};

/** Nights of history the term-to-date percentage is computed over. */
const TERM_NIGHTS = 90;

/* ── Occupants ──────────────────────────────────────────────────────────── */

/**
 * Beds in a room.
 *
 * `detail` controls how much of each occupant is returned: PAGE 23 gives the
 * Student "roommates (names only)", so everything past the name is omitted
 * from the payload rather than hidden by the component.
 */
/**
 * Term-to-date nightly attendance for one student.
 *
 * Computed from the same `nightStatus()` the history grid uses — a
 * hand-written percentage sitting next to a derived grid is guaranteed to
 * disagree with it eventually (the phantom-clash lesson from PAGE 10).
 */
function attendancePctFor(studentId: string): number {
  let present = 0;
  for (let i = 0; i < TERM_NIGHTS; i++) {
    if (nightStatus(studentId, i) === "PRESENT") present += 1;
  }
  return Math.round((present / TERM_NIGHTS) * 100);
}

function buildOccupants(
  roomId: string,
  opts: { detail: boolean; selfId: string | null },
): RoomOccupant[] {
  const rows = ALLOTMENTS[roomId] ?? [];

  return rows
    .map(({ bed, studentId }) => {
      const student = ROSTER.find((s) => s.id === studentId)!;
      const isSelf = studentId === opts.selfId;

      const base: RoomOccupant = {
        bedNumber: bed,
        studentId,
        studentName: student.name,
        isSelf,
      };

      // A resident sees their own row in full — it is their record
      if (!opts.detail && !isSelf) return base;

      return {
        ...base,
        rollNo: student.rollNo,
        className: student.className,
        allottedFrom: on(300),
        status: "ACTIVE" as const,
        attendancePct: attendancePctFor(studentId),
        todayStatus: nightStatus(studentId, 0),
      };
    })
    .sort((a, b) => a.bedNumber - b.bedNumber);
}

/* ── Attendance history ─────────────────────────────────────────────────── */

/**
 * Deterministic roll-call for one student on one night.
 * Derived, so the history grid, the per-student percentages and the "absent
 * nights" count can never disagree with each other.
 */
function nightStatus(
  studentId: string,
  daysAgo: number,
): HostelAttendanceStatus {
  // Aryan is on approved leave for the two most recent nights, matching the
  // APPROVED leave request below
  if (studentId === "s1" && daysAgo <= 1) return "ON_LEAVE";

  // A per-student stride as well as an offset, so two students in the same
  // room don't land on the same pattern — identical percentages side by side
  // read as a copy-paste bug even when they're honestly derived.
  const n = Number(studentId.slice(1)) || 1;
  const seed = daysAgo * (5 + n) + n * 7;
  if (seed % (7 + (n % 3)) === 0) return "ABSENT";
  if (seed % 13 === 0) return "ON_LEAVE";
  return "PRESENT";
}

function buildAttendance(roomId: string, nights = 14): RoomAttendanceHistory {
  const rows = ALLOTMENTS[roomId] ?? [];

  const list = Array.from({ length: nights }, (_, i) => {
    const entries: Record<string, HostelAttendanceStatus> = {};
    for (const { studentId } of rows) {
      entries[studentId] = nightStatus(studentId, i);
    }
    return {
      date: on(i),
      // Tonight's roll-call hasn't been taken yet
      markedByName: i === 0 ? null : "Ramesh Gowda",
      entries,
    };
  });

  const all = list.flatMap((n) => Object.values(n.entries));
  const present = all.filter((s) => s === "PRESENT").length;

  return {
    nights: list,
    overallPct: all.length ? Math.round((present / all.length) * 100) : 0,
    absentNights: list.filter((n) =>
      Object.values(n.entries).includes("ABSENT"),
    ).length,
  };
}

/* ── Complaints ─────────────────────────────────────────────────────────── */

const COMPLAINTS: Record<string, RoomComplaint[]> = {
  "A-104": [
    {
      id: "c1",
      category: "MAINTENANCE",
      description:
        "Ceiling fan in the room rattles at high speed and stops intermittently.",
      // Open on purpose so the warden's resolve action is demoable
      status: "OPEN",
      raisedByName: "Aryan Mehta",
      createdAt: at(2),
      resolvedByName: null,
      resolvedAt: null,
    },
    {
      id: "c2",
      category: "MAINTENANCE",
      description: "Bathroom tap leaking since the weekend.",
      status: "IN_PROGRESS",
      raisedByName: "Imran Shaikh",
      createdAt: at(6),
      resolvedByName: null,
      resolvedAt: null,
    },
    {
      id: "c3",
      category: "SECURITY",
      description: "Window latch on the corridor side does not lock.",
      status: "RESOLVED",
      raisedByName: "Imran Shaikh",
      createdAt: at(28),
      resolvedByName: "Ramesh Gowda",
      resolvedAt: at(25),
    },
  ],
  "A-105": [
    {
      id: "c4",
      category: "FOOD",
      description: "Mess breakfast is served cold on weekends.",
      status: "OPEN",
      raisedByName: "Kiran Patel",
      createdAt: at(4),
      resolvedByName: null,
      resolvedAt: null,
    },
  ],
};

/* ── Leave requests ─────────────────────────────────────────────────────── */

const LEAVE_REQUESTS: Record<string, RoomLeaveRequest[]> = {
  "A-104": [
    {
      id: "lr1",
      studentName: "Aryan Mehta",
      fromDate: on(1),
      toDate: on(-1),
      reason: "Family function at home.",
      destination: "Mysuru",
      contactDuringLeave: "+91 98451 87890",
      status: "APPROVED",
      reviewedByName: "Ramesh Gowda",
    },
    {
      id: "lr2",
      studentName: "Imran Shaikh",
      fromDate: on(-4),
      toDate: on(-6),
      reason: "Cousin's wedding.",
      destination: "Hyderabad",
      contactDuringLeave: "+91 98451 33221",
      // Pending so the warden has something to act on
      status: "PENDING",
      reviewedByName: null,
    },
  ],
};

/* ── Assembly ───────────────────────────────────────────────────────────── */

export function getRoom(id: string): HostelRoomSummary | undefined {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return undefined;
  return { ...room, occupiedBeds: (ALLOTMENTS[id] ?? []).length };
}

/** The room the signed-in student/parent is linked to (`hostel_allotments`). */
export function getOwnRoomId(): string {
  return OWN_STUDENT.roomId;
}

/**
 * The signed-in student's own allotment, so other modules (student detail)
 * can quote the same bed and percentage instead of hard-coding them.
 */
export function getOwnHostelAllotment(): {
  roomId: string;
  bedNumber: number;
  attendancePct: number;
} {
  const bed = (ALLOTMENTS[OWN_STUDENT.roomId] ?? []).find(
    (a) => a.studentId === OWN_STUDENT.id,
  );
  return {
    roomId: OWN_STUDENT.roomId,
    bedNumber: bed?.bed ?? 1,
    attendancePct: attendancePctFor(OWN_STUDENT.id),
  };
}

/** Rooms the warden may switch between — used for the "not your room" copy. */
export function getRoomIds(): string[] {
  return ROOMS.map((r) => r.id);
}

/**
 * Mirrors `GET /api/v1/hostel/rooms/:id` with the caller's entitlements
 * applied. Sections the role doesn't own are omitted, so nothing extra
 * reaches the RSC payload.
 */
export function getRoomDetail(
  id: string,
  perms: HostelRoomPermissions,
): HostelRoomDetail | undefined {
  const room = getRoom(id);
  if (!room) return undefined;

  const isResident = perms.view === "RESIDENT" || perms.view === "GUARDIAN";
  const selfId = isResident ? OWN_STUDENT.id : null;

  const detail: HostelRoomDetail = {
    room,
    occupants: buildOccupants(id, {
      detail: perms.canSeeOccupantDetail,
      selfId,
    }),
  };

  // Warden + oversight roles only
  if (perms.view === "MANAGE" || perms.view === "OVERSEE") {
    detail.attendance = buildAttendance(id);
    detail.complaints = COMPLAINTS[id] ?? [];
    detail.leaveRequests = LEAVE_REQUESTS[id] ?? [];
  }

  if (isResident) {
    const mine = (ALLOTMENTS[id] ?? []).find(
      (a) => a.studentId === OWN_STUDENT.id,
    );
    if (mine) {
      detail.ownAllotment = {
        studentName: OWN_STUDENT.name,
        bedNumber: mine.bed,
        allottedFrom: on(300),
        status: "ACTIVE",
        attendancePct: attendancePctFor(OWN_STUDENT.id),
      };
    }
  }

  return detail;
}

/* ── Block-wide occupancy (PAGE 14 reports) ─────────────────────────────── */

/**
 * Occupancy and roll-call across every block.
 *
 * Beds and percentages come from the same `ALLOTMENTS` table and the same
 * `attendancePctFor()` the room page uses, so the Warden's report cannot
 * disagree with any room they open from it.
 *
 * TODO(Dev-B): `GET /api/v1/hostel/reports/occupancy`, a `GROUP BY block_id`
 * over `hostel_rooms` joined to active `hostel_allotments` (§8.2).
 */
export function getHostelOccupancy(): {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  byBlock: {
    blockId: string;
    blockName: string;
    capacity: number;
    occupied: number;
    occupancyPct: number;
  }[];
  residents: {
    studentId: string;
    name: string;
    roomNumber: string;
    attendancePct: number;
  }[];
} {
  const totalBeds = ROOMS.reduce((a, r) => a + r.capacity, 0);
  const occupiedBeds = ROOMS.reduce(
    (a, r) => a + (ALLOTMENTS[r.id] ?? []).length,
    0,
  );

  const blocks = new Map<
    string,
    { blockId: string; blockName: string; capacity: number; occupied: number }
  >();

  for (const room of ROOMS) {
    const cur = blocks.get(room.blockId) ?? {
      blockId: room.blockId,
      blockName: room.blockName,
      capacity: 0,
      occupied: 0,
    };
    cur.capacity += room.capacity;
    cur.occupied += (ALLOTMENTS[room.id] ?? []).length;
    blocks.set(room.blockId, cur);
  }

  const residents = ROOMS.flatMap((room) =>
    (ALLOTMENTS[room.id] ?? []).map(({ studentId }) => ({
      studentId,
      name: ROSTER.find((s) => s.id === studentId)?.name ?? "Unknown",
      roomNumber: room.roomNumber,
      attendancePct: attendancePctFor(studentId),
    })),
  );

  return {
    totalBeds,
    occupiedBeds,
    vacantBeds: totalBeds - occupiedBeds,
    occupancyPct: Math.round((occupiedBeds / totalBeds) * 100),
    byBlock: [...blocks.values()].map((b) => ({
      ...b,
      occupancyPct: Math.round((b.occupied / b.capacity) * 100),
    })),
    residents,
  };
}
