import type { InstitutionRole } from "@/types/auth";
import type { Notice, NoticePermissions } from "@/types/notice";
import { isExpired } from "./notices";

/**
 * Notice feed data source.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(Dev-B): replace with the real endpoints (§7).
 *
 *   GET    /api/v1/notices/my?q=&scope=&is_pinned=&priority=&page=&perPage=20
 *   POST   /api/v1/notices
 *   GET    /api/v1/notices/:id
 *   POST   /api/v1/notices/:id/read
 *   PATCH  /api/v1/notices/:id/pin
 *   DELETE /api/v1/notices/:id            (soft — sets deleted_at)
 *   GET    /api/v1/notices/:id/reads      (author/admin only)
 *
 * The backend auto-scopes the feed by tenant_id + role scope, so the client
 * never sends scope filters for security — only for UI filtering. Everything
 * below is demo data shaped exactly like the API response.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

/** Fixed base time so server and client render identical timestamps. */
const T0 = Date.UTC(2026, 6, 29, 4, 30, 0);

const iso = (msAgo: number) => new Date(T0 - msAgo).toISOString();

const FEED: Notice[] = [
  {
    id: "n1",
    title: "Mid-term Examination Postponed to 12 August",
    body: "Due to the state-wide transport strike announced for 8–10 August, all mid-term examinations scheduled for that week are postponed. The revised timetable has been attached. Hall tickets remain valid — no re-issue is required. Students should report 30 minutes before each paper.",
    author: { id: "u1", name: "Deepak Iyer", role: "EXAM_CONTROLLER" },
    targetScope: "INSTITUTION",
    targetId: null,
    targetName: null,
    priority: "URGENT",
    isPinned: true,
    publishedAt: iso(2 * HOURS),
    expiresAt: null,
    attachments: [
      {
        id: "a1",
        fileName: "revised_exam_timetable.pdf",
        fileKey: "tenants/abc/notice-attachments/a1.pdf",
        fileSizeBytes: 1_258_291,
        mimeType: "application/pdf",
      },
    ],
    readCount: 128,
    audienceCount: 200,
    isRead: false,
  },
  {
    id: "n2",
    title: "Independence Day — Institution Holiday",
    body: "The institution will remain closed on Friday, 15 August for Independence Day. Flag hoisting begins at 8:00 AM in the main quadrangle; attendance is voluntary but encouraged. Regular classes resume Monday.",
    author: { id: "u2", name: "Meera Krishnan", role: "INSTITUTION_ADMIN" },
    targetScope: "INSTITUTION",
    targetId: null,
    targetName: null,
    priority: "IMPORTANT",
    isPinned: true,
    publishedAt: iso(1 * DAYS),
    expiresAt: iso(-17 * DAYS),
    attachments: [],
    readCount: 176,
    audienceCount: 200,
    isRead: true,
  },
  {
    id: "n3",
    title: "CS301 Assignment 3 deadline extended",
    body: "Following several requests, the deadline for the Binary Trees worksheet is extended to Sunday 11:59 PM. Late submissions after that will attract the usual penalty. Office hours on Friday 3–5 PM if you need help.",
    author: { id: "u3", name: "Priya Sharma", role: "TEACHER" },
    targetScope: "CLASS",
    targetId: "fy-a",
    targetName: "FY-A",
    priority: "NORMAL",
    isPinned: false,
    publishedAt: iso(5 * HOURS),
    expiresAt: null,
    attachments: [],
    readCount: 28,
    audienceCount: 32,
    isRead: false,
  },
  {
    id: "n4",
    title: "Department seminar — Advances in Distributed Systems",
    body: "The CSE department is hosting Dr. Anita Verma (IISc Bangalore) for a guest lecture on Thursday at 2:30 PM in Seminar Hall 2. All Sem 5 and Sem 7 students are expected to attend. Attendance will be marked.",
    author: { id: "u4", name: "Kavita Menon", role: "HOD" },
    targetScope: "DEPARTMENT",
    targetId: "cse",
    targetName: "CSE",
    priority: "NORMAL",
    isPinned: false,
    publishedAt: iso(1 * DAYS + 4 * HOURS),
    expiresAt: null,
    attachments: [
      {
        id: "a2",
        fileName: "seminar_abstract.pdf",
        fileKey: "tenants/abc/notice-attachments/a2.pdf",
        fileSizeBytes: 486_400,
        mimeType: "application/pdf",
      },
    ],
    readCount: 142,
    audienceCount: 180,
    isRead: true,
  },
  {
    id: "n5",
    title: "Hostel night attendance moved to 9:30 PM",
    body: "Effective this week, night attendance for all blocks will be taken at 9:30 PM instead of 10:00 PM. Residents returning later must record an entry with the security desk. Repeated late entries will be reported to the warden.",
    author: { id: "u5", name: "Ramesh Gowda", role: "HOSTEL_WARDEN" },
    targetScope: "HOSTEL",
    targetId: "block-a",
    targetName: "Block A · Boys",
    priority: "IMPORTANT",
    isPinned: false,
    publishedAt: iso(2 * DAYS),
    expiresAt: null,
    attachments: [],
    readCount: 64,
    audienceCount: 85,
    isRead: false,
  },
  {
    id: "n6",
    title: "Infosys campus drive — registrations close Friday",
    body: "Infosys will conduct a campus drive on 20 August for CSE, ECE and IT branches. Eligibility: 60% aggregate, no active backlogs. Register through the placement portal before Friday 5:00 PM. Pre-placement talk on 18 August.",
    author: { id: "u6", name: "Vikram Nair", role: "PLACEMENT_OFFICER" },
    targetScope: "PLACEMENT",
    targetId: "cse",
    targetName: "CSE · ECE · IT",
    priority: "IMPORTANT",
    isPinned: false,
    publishedAt: iso(3 * DAYS),
    expiresAt: null,
    attachments: [
      {
        id: "a3",
        fileName: "infosys_jd_2026.pdf",
        fileKey: "tenants/abc/notice-attachments/a3.pdf",
        fileSizeBytes: 892_000,
        mimeType: "application/pdf",
      },
      {
        id: "a4",
        fileName: "eligibility_criteria.pdf",
        fileKey: "tenants/abc/notice-attachments/a4.pdf",
        fileSizeBytes: 214_000,
        mimeType: "application/pdf",
      },
    ],
    readCount: 210,
    audienceCount: 320,
    isRead: false,
  },
  {
    id: "n7",
    title: "Payroll cut-off for August is 25th",
    body: "All leave records and overtime claims must be submitted before 25 August for inclusion in this month's payroll. Submissions after the cut-off will be carried to September. Contact HR for corrections.",
    author: { id: "u7", name: "Anita Desai", role: "HR_MANAGER" },
    targetScope: "STAFF",
    targetId: null,
    targetName: "All Staff",
    priority: "NORMAL",
    isPinned: false,
    publishedAt: iso(4 * DAYS),
    expiresAt: null,
    attachments: [],
    readCount: 71,
    audienceCount: 100,
    isRead: true,
  },
  {
    id: "n8",
    title: "Library closed Saturday for stock audit",
    body: "The central library will be closed on Saturday for the annual stock audit. The digital catalogue and e-resources remain available. Books due Saturday can be returned on Monday without a late fee.",
    author: { id: "u8", name: "Fatima Sheikh", role: "LIBRARIAN" },
    targetScope: "INSTITUTION",
    targetId: null,
    targetName: null,
    priority: "NORMAL",
    isPinned: false,
    publishedAt: iso(5 * DAYS),
    expiresAt: iso(4 * DAYS),
    attachments: [],
    readCount: 96,
    audienceCount: 200,
    isRead: true,
  },
];

/**
 * Fetch the scoped feed for a role.
 * Mirrors `GET /api/v1/notices/my` — the backend applies scope filters,
 * hides soft-deleted rows and drops expired notices for non-authors (§3, §10).
 */
export function getNotices(
  perms: NoticePermissions,
  role: InstitutionRole,
): Notice[] {
  return FEED.filter((n) => {
    if (!perms.visibleScopes.includes(n.targetScope)) return false;
    // Expired notices stay visible to moderators under the "Expired" tab (§10)
    if (isExpired(n) && !perms.canModerate && n.author.role !== role) return false;
    return true;
  }).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return +new Date(b.publishedAt) - +new Date(a.publishedAt);
  });
}

/** Mirrors `GET /api/v1/notices/:id`. */
export function getNotice(id: string): Notice | undefined {
  return FEED.find((n) => n.id === id);
}

/** Expired notices an author/moderator can still review (§10). */
export function getExpired(
  perms: NoticePermissions,
  role: InstitutionRole,
): Notice[] {
  if (!perms.canModerate) {
    return FEED.filter((n) => isExpired(n) && n.author.role === role);
  }
  return FEED.filter((n) => isExpired(n));
}
